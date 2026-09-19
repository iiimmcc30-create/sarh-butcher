import { Injectable } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { logger } from '../../shared/lib/logger';
import {
  PLATFORM_REFERENCE_LAT,
  PLATFORM_REFERENCE_LNG,
  MIN_ORDERS_FOR_RATING,
  computeNewButcherBoost,
  computeRankingScore,
  distanceKm,
  invertDistanceScore,
  minMaxNormalize,
  speedRawScore,
  type PlatformBounds,
} from '../lib/butcher-ranking.util';

const BOUNDS_CACHE_KEY = 'butcher:ranking:bounds:v1';
const BOUNDS_TTL_SEC = 300;

type ButcherMetrics = {
  id: string;
  createdAt: Date;
  lat: number | null;
  lng: number | null;
  completedOrdersCount: number;
  favoritesCount: number;
  rating: number;
  reviewCount: number;
  avgAcceptMinutes: number | null;
  avgPrepMinutes: number | null;
  avgCompleteMinutes: number | null;
};

@Injectable()
export class ButcherRankingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async onOrderDelivered(butcherId: string): Promise<void> {
    await this.refreshButcherOperationalMetrics(butcherId);
    await this.recalculateButcher(butcherId);
  }

  async onOrderCancelled(butcherId: string): Promise<void> {
    await this.refreshCompletionRate(butcherId);
    await this.recalculateButcher(butcherId);
  }

  async onReviewChanged(butcherId: string): Promise<void> {
    await this.recalculateButcher(butcherId);
  }

  async onFavoriteChanged(butcherId: string): Promise<void> {
    const count = await this.prisma.butcherFavorite.count({
      where: { butcherId },
    });
    await this.prisma.butcher.update({
      where: { id: butcherId },
      data: { favoritesCount: count },
    });
    await this.recalculateButcher(butcherId);
  }

  async onButcherCreated(butcherId: string): Promise<void> {
    await this.recalculateButcher(butcherId);
  }

  async recalculateButcher(butcherId: string): Promise<void> {
    const butcher = await this.prisma.butcher.findFirst({
      where: { id: butcherId, deletedAt: null },
      select: {
        id: true,
        createdAt: true,
        lat: true,
        lng: true,
        completedOrdersCount: true,
        favoritesCount: true,
        rating: true,
        reviewCount: true,
        avgAcceptMinutes: true,
        avgPrepMinutes: true,
        avgCompleteMinutes: true,
      },
    });
    if (!butcher) return;

    const bounds = await this.getPlatformBounds();
    const normalized = this.normalizeButcher(butcher, bounds);
    const newButcherBoost = computeNewButcherBoost(butcher.createdAt);
    const rankingScore = computeRankingScore({
      ...normalized,
      newButcherBoost,
    });

    await this.prisma.butcher.update({
      where: { id: butcherId },
      data: {
        ...normalized,
        newButcherBoost,
        rankingScore,
        lastRankingUpdate: new Date(),
      },
    });

    await this.redis.cacheDel(BOUNDS_CACHE_KEY);
    await this.redis.cacheDelPattern('butchers:v4:*');
    logger.info({ butcherId, rankingScore }, 'Butcher ranking recalculated');
  }

  async recalculateAll(): Promise<number> {
    const ids = await this.prisma.butcher.findMany({
      where: { deletedAt: null },
      select: { id: true },
    });
    for (const { id } of ids) {
      await this.refreshButcherOperationalMetrics(id);
    }
    await this.redis.cacheDel(BOUNDS_CACHE_KEY);
    for (const { id } of ids) {
      await this.recalculateButcher(id);
    }
    return ids.length;
  }

  private normalizeButcher(butcher: ButcherMetrics, bounds: PlatformBounds) {
    const ratingEligible =
      butcher.completedOrdersCount >= MIN_ORDERS_FOR_RATING &&
      butcher.reviewCount > 0;
    const ratingValue = ratingEligible ? butcher.rating : 0;

    const speedRaw = speedRawScore(
      butcher.avgAcceptMinutes,
      butcher.avgPrepMinutes,
      butcher.avgCompleteMinutes,
    );

    let distanceKmValue = bounds.maxDistanceKm;
    if (butcher.lat != null && butcher.lng != null) {
      distanceKmValue = distanceKm(
        butcher.lat,
        butcher.lng,
        PLATFORM_REFERENCE_LAT,
        PLATFORM_REFERENCE_LNG,
      );
    }

    return {
      normalizedOrders: minMaxNormalize(
        butcher.completedOrdersCount,
        bounds.minOrders,
        bounds.maxOrders,
      ),
      normalizedRating: minMaxNormalize(
        ratingValue,
        bounds.minRating,
        bounds.maxRating,
      ),
      normalizedFavorites: minMaxNormalize(
        butcher.favoritesCount,
        bounds.minFavorites,
        bounds.maxFavorites,
      ),
      normalizedDistance: invertDistanceScore(
        distanceKmValue,
        bounds.minDistanceKm,
        bounds.maxDistanceKm,
      ),
      normalizedSpeed: minMaxNormalize(
        speedRaw,
        bounds.minSpeed,
        bounds.maxSpeed,
      ),
    };
  }

  private async getPlatformBounds(): Promise<PlatformBounds> {
    const cached = await this.redis.cacheGet<PlatformBounds>(BOUNDS_CACHE_KEY);
    if (cached) return cached;

    const butchers = await this.prisma.butcher.findMany({
      where: { deletedAt: null },
      select: {
        completedOrdersCount: true,
        favoritesCount: true,
        rating: true,
        reviewCount: true,
        avgAcceptMinutes: true,
        avgPrepMinutes: true,
        avgCompleteMinutes: true,
        lat: true,
        lng: true,
      },
    });

    const orders = butchers.map((b) => b.completedOrdersCount);
    const favorites = butchers.map((b) => b.favoritesCount);
    const ratings = butchers
      .filter(
        (b) =>
          b.completedOrdersCount >= MIN_ORDERS_FOR_RATING && b.reviewCount > 0,
      )
      .map((b) => b.rating);
    const speeds = butchers.map((b) =>
      speedRawScore(b.avgAcceptMinutes, b.avgPrepMinutes, b.avgCompleteMinutes),
    );
    const distances = butchers
      .filter((b) => b.lat != null && b.lng != null)
      .map((b) =>
        distanceKm(
          b.lat!,
          b.lng!,
          PLATFORM_REFERENCE_LAT,
          PLATFORM_REFERENCE_LNG,
        ),
      );

    const bounds: PlatformBounds = {
      minOrders: orders.length ? Math.min(...orders) : 0,
      maxOrders: orders.length ? Math.max(...orders) : 0,
      minRating: ratings.length ? Math.min(...ratings) : 0,
      maxRating: ratings.length ? Math.max(...ratings) : 5,
      minFavorites: favorites.length ? Math.min(...favorites) : 0,
      maxFavorites: favorites.length ? Math.max(...favorites) : 0,
      minSpeed: speeds.length ? Math.min(...speeds) : 0,
      maxSpeed: speeds.length ? Math.max(...speeds) : 100,
      minDistanceKm: distances.length ? Math.min(...distances) : 0,
      maxDistanceKm: distances.length ? Math.max(...distances) : 100,
    };

    await this.redis.cacheSet(BOUNDS_CACHE_KEY, bounds, BOUNDS_TTL_SEC);
    return bounds;
  }

  async refreshButcherOperationalMetrics(butcherId: string): Promise<void> {
    const completed = await this.prisma.butcherOrder.count({
      where: { butcherId, status: 'delivered' },
    });

    const [deliveredCount, cancelledCount] = await Promise.all([
      this.prisma.butcherOrder.count({
        where: { butcherId, status: 'delivered' },
      }),
      this.prisma.butcherOrder.count({
        where: { butcherId, status: 'cancelled' },
      }),
    ]);
    const total = deliveredCount + cancelledCount;
    const orderCompletionRate =
      total > 0 ? Math.round((deliveredCount / total) * 1000) / 10 : 100;

    const speed = await this.computeSpeedAverages(butcherId);

    await this.prisma.butcher.update({
      where: { id: butcherId },
      data: {
        completedOrdersCount: completed,
        totalOrders: completed,
        orderCompletionRate,
        ...speed,
      },
    });
  }

  private async refreshCompletionRate(butcherId: string): Promise<void> {
    const [deliveredCount, cancelledCount] = await Promise.all([
      this.prisma.butcherOrder.count({
        where: { butcherId, status: 'delivered' },
      }),
      this.prisma.butcherOrder.count({
        where: { butcherId, status: 'cancelled' },
      }),
    ]);
    const total = deliveredCount + cancelledCount;
    const orderCompletionRate =
      total > 0 ? Math.round((deliveredCount / total) * 1000) / 10 : 100;
    await this.prisma.butcher.update({
      where: { id: butcherId },
      data: { orderCompletionRate },
    });
  }

  private async computeSpeedAverages(butcherId: string) {
    const orders = await this.prisma.butcherOrder.findMany({
      where: { butcherId, status: 'delivered' },
      select: {
        createdAt: true,
        timeline: { select: { status: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const accept: number[] = [];
    const prep: number[] = [];
    const complete: number[] = [];

    for (const order of orders) {
      const t = new Map<OrderStatus, Date>();
      t.set('pending', order.createdAt);
      for (const row of order.timeline) {
        t.set(row.status, row.createdAt);
      }
      const pending = t.get('pending');
      const confirmed = t.get('confirmed');
      const preparing = t.get('preparing');
      const delivered = t.get('delivered');

      if (pending && confirmed) {
        accept.push((confirmed.getTime() - pending.getTime()) / 60000);
      }
      if (confirmed && preparing) {
        prep.push((preparing.getTime() - confirmed.getTime()) / 60000);
      }
      if (preparing && delivered) {
        complete.push((delivered.getTime() - preparing.getTime()) / 60000);
      } else if (confirmed && delivered && !preparing) {
        complete.push((delivered.getTime() - confirmed.getTime()) / 60000);
      }
    }

    const avg = (arr: number[]) =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

    return {
      avgAcceptMinutes: avg(accept),
      avgPrepMinutes: avg(prep),
      avgCompleteMinutes: avg(complete),
    };
  }
}
