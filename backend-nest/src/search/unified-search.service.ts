import { Injectable } from '@nestjs/common';
import { LoggerService } from '../common/services/logger.service';
import { RedisCacheService } from '../redis/services/redis-cache.service';
import type { SearchType, UnifiedSearchQueryDto } from './dto/search.dto';
import {
  clampSearchQuery,
  normalizeArabicSearchText,
  tokenizeSearchQuery,
} from './lib/arabic-search.util';
import { rankSearchResults, scoreSearchMatch } from './lib/search-ranking.util';
import { UnifiedSearchRepository } from './repositories/unified-search.repository';

export type SearchResultItem = {
  type: 'listings' | 'posts' | 'butchers' | 'news' | 'services' | 'users';
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  relevance: number;
  createdAt?: string;
  data: Record<string, unknown>;
};

export type SearchGroup = {
  type: Exclude<SearchType, 'all'>;
  items: SearchResultItem[];
  page: number;
  limit: number;
  hasMore: boolean;
};

const DEFAULT_LIMIT = 20;
const ALL_TYPE_PER_GROUP = 8;
const SUGGEST_CACHE_TTL_SEC = 90;

@Injectable()
export class UnifiedSearchService {
  constructor(
    private readonly repo: UnifiedSearchRepository,
    private readonly cache: RedisCacheService,
    private readonly logger: LoggerService,
  ) {}

  async search(dto: UnifiedSearchQueryDto) {
    const started = Date.now();
    const query = clampSearchQuery(dto.q);
    const tokens = tokenizeSearchQuery(query);
    const type = dto.type ?? 'all';
    const limit = Math.min(dto.limit ?? DEFAULT_LIMIT, 50);
    const page = dto.page ?? 1;
    const skip = (page - 1) * limit;

    const filters = {
      categoryId: dto.categoryId,
      subcategoryId: dto.subcategoryId,
      country: dto.country,
      minPrice: dto.minPrice,
      maxPrice: dto.maxPrice,
      region: dto.region,
    };

    const typesToSearch: Array<Exclude<SearchType, 'all'>> =
      type === 'all'
        ? ['listings', 'posts', 'butchers', 'news', 'services']
        : [type as Exclude<SearchType, 'all'>];

    const groups: SearchGroup[] = [];

    for (const groupType of typesToSearch) {
      const groupLimit = type === 'all' ? ALL_TYPE_PER_GROUP : limit;
      const groupSkip = type === 'all' ? 0 : skip;
      const fetchTake = groupLimit + 1;

      let items: SearchResultItem[] = [];

      switch (groupType) {
        case 'listings':
          items = await this.mapListings(
            query,
            tokens,
            await this.repo.searchListings(
              tokens,
              filters,
              groupSkip,
              fetchTake,
            ),
          );
          break;
        case 'posts':
          items = this.mapPosts(
            query,
            tokens,
            await this.repo.searchPosts(tokens, groupSkip, fetchTake),
          );
          break;
        case 'butchers':
          items = this.mapButchers(
            query,
            tokens,
            await this.repo.searchButchers(tokens, groupSkip, fetchTake),
          );
          break;
        case 'news':
          items = this.mapNews(
            query,
            tokens,
            await this.repo.searchNews(tokens, groupSkip, fetchTake),
          );
          break;
        case 'services':
          items = this.mapServices(
            query,
            tokens,
            await this.repo.searchServices(tokens, groupSkip, fetchTake),
          );
          break;
        case 'users':
          items = this.mapUsers(
            query,
            tokens,
            await this.repo.searchUsers(tokens, groupSkip, fetchTake),
          );
          break;
        default:
          break;
      }

      const hasMore = items.length > groupLimit;
      const trimmed = hasMore ? items.slice(0, groupLimit) : items;

      groups.push({
        type: groupType,
        items: trimmed,
        page: type === 'all' ? 1 : page,
        limit: groupLimit,
        hasMore,
      });
    }

    const durationMs = Date.now() - started;
    const resultCount = groups.reduce((n, g) => n + g.items.length, 0);
    this.logger.info(
      { durationMs, resultCount, type, tokenCount: tokens.length },
      'Unified search completed',
    );

    return {
      query,
      type,
      groups,
      durationMs,
    };
  }

  async suggest(q: string, limit = 8) {
    const prefix = normalizeArabicSearchText(clampSearchQuery(q, 60));
    if (prefix.length < 2) {
      return { suggestions: [] as Array<{ text: string; kind: string }> };
    }

    const cacheKey = `search:suggest:v2:${prefix}:${limit}`;
    if (this.cache.isEnabled()) {
      const cached =
        await this.cache.get<Array<{ text: string; kind: string }>>(cacheKey);
      if (cached) return { suggestions: cached };
    }

    const rows = await this.repo.suggestPrefixes(prefix, limit);
    const seen = new Set<string>();
    const suggestions: Array<{ text: string; kind: string }> = [];

    for (const row of rows.sort((a, b) => b.weight - a.weight)) {
      const key = normalizeArabicSearchText(row.text);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      suggestions.push({ text: row.text.trim(), kind: row.kind });
      if (suggestions.length >= limit) break;
    }

    if (this.cache.isEnabled()) {
      await this.cache
        .set(cacheKey, suggestions, SUGGEST_CACHE_TTL_SEC)
        .catch(() => {});
    }

    return { suggestions };
  }

  private async mapListings(
    query: string,
    tokens: string[],
    rows: Awaited<ReturnType<UnifiedSearchRepository['searchListings']>>,
  ): Promise<SearchResultItem[]> {
    const scored = rows.map((row) => {
      const relevance = scoreSearchMatch(query, tokens, {
        title: row.arabicTitle || row.title,
        subtitle: row.arabicLocation || row.location,
        description: row.arabicDescription || row.description,
        category: row.marketCategory?.nameAr ?? row.category,
        keywords: [row.breed ?? ''].filter(Boolean),
        createdAt: row.createdAt,
        boost: (row.featured ? 2 : 0) + (row.promoted ? 1 : 0),
      });
      return {
        type: 'listings' as const,
        id: row.id,
        title: row.arabicTitle || row.title,
        subtitle: row.arabicLocation || row.location,
        imageUrl: row.thumbnailUrl ?? row.images?.[0] ?? null,
        relevance,
        createdAt: row.createdAt.toISOString(),
        data: row as unknown as Record<string, unknown>,
      };
    });
    return rankSearchResults(scored);
  }

  private mapPosts(
    query: string,
    tokens: string[],
    rows: Awaited<ReturnType<UnifiedSearchRepository['searchPosts']>>,
  ): SearchResultItem[] {
    const scored = rows.map((row) => {
      const body = row.arabicContent || row.content;
      const relevance = scoreSearchMatch(query, tokens, {
        title: body.slice(0, 120),
        description: body,
        createdAt: row.createdAt,
      });
      return {
        type: 'posts' as const,
        id: row.id,
        title: body.slice(0, 140),
        subtitle:
          row.author.arabicName ||
          row.author.displayName ||
          row.author.username,
        imageUrl: row.images?.[0] ?? null,
        relevance,
        createdAt: row.createdAt.toISOString(),
        data: row as unknown as Record<string, unknown>,
      };
    });
    return rankSearchResults(scored);
  }

  private mapButchers(
    query: string,
    tokens: string[],
    rows: Awaited<ReturnType<UnifiedSearchRepository['searchButchers']>>,
  ): SearchResultItem[] {
    const scored = rows.map((row) => {
      const relevance = scoreSearchMatch(
        query,
        tokens,
        {
          title: row.nameAr || row.nameEn,
          subtitle: row.cityAr || row.city,
          description: row.bioAr,
          createdAt: row.createdAt,
          boost: Math.min(3, (row.rankingScore ?? 0) / 100),
        },
        { boost: 3 },
      );
      return {
        type: 'butchers' as const,
        id: row.id,
        title: row.nameAr || row.nameEn,
        subtitle: [
          row.cityAr || row.city,
          row.rating ? `⭐ ${row.rating.toFixed(1)}` : '',
        ]
          .filter(Boolean)
          .join(' · '),
        imageUrl: row.logo ?? row.cover ?? null,
        relevance,
        createdAt: row.createdAt.toISOString(),
        data: row as unknown as Record<string, unknown>,
      };
    });
    return rankSearchResults(scored);
  }

  private mapNews(
    query: string,
    tokens: string[],
    rows: Awaited<ReturnType<UnifiedSearchRepository['searchNews']>>,
  ): SearchResultItem[] {
    const scored = rows.map((row) => {
      const relevance = scoreSearchMatch(
        query,
        tokens,
        {
          title: row.titleAr,
          description: row.bodyAr,
          createdAt: row.publishedAt ?? row.createdAt,
        },
        { title: 50, description: 10 },
      );
      return {
        type: 'news' as const,
        id: row.id,
        title: row.titleAr,
        subtitle: row.bodyAr.slice(0, 100),
        imageUrl: row.imageUrl,
        relevance,
        createdAt: (row.publishedAt ?? row.createdAt).toISOString(),
        data: row as unknown as Record<string, unknown>,
      };
    });
    return rankSearchResults(scored);
  }

  private mapServices(
    query: string,
    tokens: string[],
    rows: Awaited<ReturnType<UnifiedSearchRepository['searchServices']>>,
  ): SearchResultItem[] {
    const scored = rows.map((row) => {
      const relevance = scoreSearchMatch(
        query,
        tokens,
        {
          title: row.title,
          description: row.description,
          category: row.category,
          createdAt: row.createdAt,
        },
        { category: 10 },
      );
      return {
        type: 'services' as const,
        id: row.id,
        title: row.title,
        subtitle: row.category,
        imageUrl: null,
        relevance,
        createdAt: row.createdAt.toISOString(),
        data: row as unknown as Record<string, unknown>,
      };
    });
    return rankSearchResults(scored);
  }

  private mapUsers(
    query: string,
    tokens: string[],
    rows: Awaited<ReturnType<UnifiedSearchRepository['searchUsers']>>,
  ): SearchResultItem[] {
    const scored = rows.map((row) => {
      const relevance = scoreSearchMatch(query, tokens, {
        title: row.arabicName || row.displayName || row.username,
        subtitle: row.username,
        description: row.bio,
        createdAt: row.createdAt,
        boost: row.verified ? 1 : 0,
      });
      return {
        type: 'users' as const,
        id: row.id,
        title: row.arabicName || row.displayName || row.username,
        subtitle: `@${row.username}`,
        imageUrl: row.avatar,
        relevance,
        createdAt: row.createdAt.toISOString(),
        data: row as unknown as Record<string, unknown>,
      };
    });
    return rankSearchResults(scored);
  }
}
