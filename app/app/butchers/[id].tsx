// Powered by OnSpace.AI
// SAFAT — Butcher Profile Screen (صفحة الملحمة)
import { AppIcon } from '@/components/ui/FlaticonIcon';

import { Image } from '@/components/ui/AppImage';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Alert,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { butcherTypography } from '@/constants/butcherTypography';
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { cloudinaryFitUrl } from '@/lib/listingMedia';
import { rtlInputText } from '@/lib/rtl';
import { motion } from '@/design-system';
import { AppText } from '@/design-system/components';
import { Row, Screen } from '@/design-system/layout';
import { butcherMarket, butcherSearchFill } from '@/constants/butcherMarket';
import {
  fetchButcherFavoriteStatus,
  toggleButcherFavorite,
} from '@/services/butcherFavorites';
import { countries, Country } from '@/services/types';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE } from '@/services/api';
import {
  ButcherOffer,
  ButcherProduct,
  ButcherProfile,
  ButcherReview,
  ButcherStory,
  gccCurrencies,
  CATEGORY_LABELS,
  type CutType,
  type MeatCategory,
} from '@/services/butcherData';
import {
  fetchButcherDetail,
  fetchButcherStories,
  findCachedButcher,
  getCachedButcherDetail,
  getCachedButcherStories,
} from '@/services/butcherDirectory';
import { type ButcherStoreNavItem } from '@/components/butcher/ButcherCategoryBar';
import { ButcherMenuCategoryBar } from '@/components/butcher/ButcherMenuCategoryBar';
import { ButcherProductOptionsModal } from '@/components/butcher/ButcherProductOptionsModal';
import { ButcherStickyCartBar } from '@/components/butcher/ButcherStickyCartBar';
import { ButcherStoreHero } from '@/components/butcher/ButcherStoreHero';
import { ButcherStoreProductCard } from '@/components/butcher/ButcherStoreProductCard';
import { useButcherCart } from '@/contexts/ButcherCartContext';
import { showToast } from '@/lib/toast';
import {
  butcherChatRouteParams,
  fetchButcherChatAccess,
  type ButcherChatAccess,
} from '@/services/butcherChat';
import {
  butcherEtaLabel,
  butcherFeeLabel,
  butcherMinOrderLabel,
  butcherPickupLabel,
} from '@/lib/butcherStoreMeta';

// ─── Products list (filter owned by parent unified nav) ───────────────────────
const STORE_SEARCH_DEBOUNCE_MS = 200;

function StoreSearchBar({
  styles,
  colors,
  onQueryChange,
}: {
  styles: {
    searchWrap: object;
    searchPill: object;
    searchInput: object;
  };
  colors: ThemeColors;
  onQueryChange: (query: string) => void;
}) {
  const [text, setText] = useState('');
  const onQueryChangeRef = useRef(onQueryChange);
  onQueryChangeRef.current = onQueryChange;

  useEffect(() => {
    const timer = setTimeout(() => {
      onQueryChangeRef.current(text);
    }, STORE_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  return (
    <View style={styles.searchWrap}>
      <Row align="center" gap="sm" style={styles.searchPill}>
        <AppIcon name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="البحث في القائمة..."
          placeholderTextColor={colors.textMuted}
          style={[styles.searchInput, rtlInputText]}
          returnKeyType="search"
        />
      </Row>
    </View>
  );
}

function StoreProductsList({
  products,
  currencySymbol,
  onOpenOptions,
  heading,
}: {
  products: ButcherProduct[];
  currencySymbol: string;
  onOpenOptions: (p: ButcherProduct) => void;
  heading?: string;
}) {
  const colors = useTheme().colors;
  const emptyStyles = useThemedStyles(({ colors }) => createEmptyStyles(colors));

  if (!products.length) {
    return (
      <View>
        {heading ? <AppText style={emptyStyles.heading}>{heading}</AppText> : null}
        <View style={emptyStyles.wrap}>
          <AppIcon name="storefront-outline" size={36} color={colors.textMuted} />
          <View style={{ width: '100%' }}>
            <AppText style={emptyStyles.title}>لا منتجات حالياً</AppText>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View>
      {heading ? <AppText style={emptyStyles.heading}>{heading}</AppText> : null}
      {products.map((product, index) => (
        <ButcherStoreProductCard
          key={product.id}
          product={product}
          currencySymbol={currencySymbol}
          onPress={() => onOpenOptions(product)}
          onAdd={() => onOpenOptions(product)}
          showDivider={index < products.length - 1}
        />
      ))}
    </View>
  );
}

// ─── Tab: Offers ─────────────────────────────────────────────────────────────
function OffersTab({ offers, currencySymbol }: {
  offers: ButcherOffer[];
  currencySymbol: string;
}) {
  const { colors } = useTheme();
  const offersStyles = useThemedStyles(({ colors }) => createOffersStyles(colors));
  const emptyStyles = useThemedStyles(({ colors }) => createEmptyStyles(colors));
  if (!offers.length) {
    return (
      <View style={emptyStyles.wrap}>
        <AppIcon name="pricetag-outline" size={36} color={colors.textMuted} />
        <View style={{ width: '100%' }}>
          <AppText style={emptyStyles.title}>لا توجد عروض حالياً</AppText>
        </View>
      </View>
    );
  }

  return (
    <View>
      {offers.map((offer) => (
        <View key={offer.id} style={offersStyles.card}>
          <Image source={{ uri: cloudinaryFitUrl(offer.image, 'wide') ?? offer.image }} style={offersStyles.img} contentFit="cover" />
          <LinearGradient
            colors={[colors.amber + '33', colors.gold + '22']}
            style={offersStyles.body}
          >
            <View style={offersStyles.discountBadge}>
              <Text style={offersStyles.discountText}>-{offer.discountPercent}%</Text>
            </View>
            <View style={{ width: '100%' }}>
              <AppText style={offersStyles.offerTitle}>{offer.titleAr}</AppText>
            </View>
            <View style={{ width: '100%' }}>
              <AppText style={offersStyles.offerDesc} numberOfLines={2}>{offer.descriptionAr}</AppText>
            </View>
            <View style={offersStyles.priceRow}>
              <Text style={offersStyles.originalPrice}>
                {offer.originalPrice?.toLocaleString()}
              </Text>
              <Text style={offersStyles.offerPrice}>
                {offer.offerPrice?.toLocaleString()} {currencySymbol}
              </Text>
            </View>
            <View style={offersStyles.footer}>
              <Text style={offersStyles.validText}>
                صالح حتى: {new Date(offer.validUntil).toLocaleDateString('ar-SA')}
              </Text>
              <AppIcon name="calendar-outline" size={13} color={colors.textMuted} />
            </View>
          </LinearGradient>
        </View>
      ))}
    </View>
  );
}

// ─── Tab: Stories ─────────────────────────────────────────────────────────────
function StoriesTab({ stories }: { stories: ButcherStory[] }) {
  const { colors } = useTheme();
  const storiesStyles = useThemedStyles(({ colors }) => createStoriesStyles(colors));
  const emptyStyles = useThemedStyles(({ colors }) => createEmptyStyles(colors));
  if (!stories.length) {
    return (
      <View style={emptyStyles.wrap}>
        <AppIcon name="images-outline" size={36} color={colors.textMuted} />
        <View style={{ width: '100%' }}>
          <AppText style={emptyStyles.title}>لا توجد قصص بعد</AppText>
        </View>
      </View>
    );
  }

  const typeLabels: Record<string, string> = {
    daily_slaughter: 'ذبح يومي',
    offer: 'عرض',
    new_stock: 'مخزون جديد',
    update: 'تحديث',
  };

  return (
    <View style={storiesStyles.grid}>
      {stories.map((story) => (
        <Pressable key={story.id} style={storiesStyles.item}>
          <Image source={{ uri: cloudinaryFitUrl(story.thumbnail, 'card') ?? story.thumbnail }} style={storiesStyles.img} contentFit="cover" />
          <LinearGradient
            colors={['transparent', 'rgba(6,9,26,0.9)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={storiesStyles.badge}>
            <Text style={storiesStyles.badgeText}>{typeLabels[story.type]}</Text>
          </View>
          {story.captionAr ? (
            <View style={storiesStyles.captionShell}>
              <Text style={storiesStyles.caption} numberOfLines={2}>{story.captionAr}</Text>
            </View>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

// ─── Tab: About ───────────────────────────────────────────────────────────────
function AboutTab({ butcher }: { butcher: ButcherProfile }) {
  const { colors } = useTheme();
  const aboutStyles = useThemedStyles(({ colors }) => createAboutStyles(colors));
  if (!butcher) return null;
  const country = countries[butcher.country];

  return (
    <View style={aboutStyles.wrap}>
      {/* Bio */}
      <View style={aboutStyles.section}>
        <View style={{ width: '100%' }}>
          <AppText style={aboutStyles.sectionTitle}>عن الملحمة</AppText>
        </View>
        <View style={{ width: '100%' }}>
          <AppText style={aboutStyles.bio}>{butcher.bioAr}</AppText>
        </View>
      </View>

      {/* Info grid */}
      <View style={aboutStyles.infoGrid}>
        <InfoRow icon="map-marker-outline" label="الموقع" value={`${butcher.cityAr}، ${country.ar}`} />
        <InfoRow icon="clock-outline" label="ساعات العمل" value={`${butcher.workingHours.open} – ${butcher.workingHours.close}`} />
        <InfoRow icon="phone-outline" label="الهاتف" value={butcher.phone} />
        {butcher.commercialReg && (
          <InfoRow icon="file-document-outline" label="السجل التجاري" value={butcher.commercialReg} />
        )}
        <InfoRow icon="bag-check-outline" label="إجمالي الطلبات" value={butcher.totalOrders.toLocaleString()} />
        <InfoRow icon="trending-up" label="معدل الإتمام" value={`${butcher.orderCompletionRate}%`} />
      </View>

      {/* Specialties */}
      <View style={aboutStyles.section}>
        <View style={{ width: '100%' }}>
          <AppText style={aboutStyles.sectionTitle}>التخصصات</AppText>
        </View>
        <View style={aboutStyles.chipsWrap}>
          {butcher.specialties.map((s, i) => (
            <View key={i} style={aboutStyles.chip}>
              <Text style={aboutStyles.chipText}>{s}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Verification */}
      {butcher.subscriptionActive && (
        <LinearGradient
          colors={[colors.gold + '22', colors.amber + '11']}
          style={aboutStyles.verifiedCard}
        >
          <View style={{ flex: 1,  }}>
            <Text style={aboutStyles.verifiedTitle}>ملحمة موثّقة</Text>
            <Text style={aboutStyles.verifiedSub}>
              اشتراك نشط · صالح حتى {butcher.subscriptionExpiry
                ? new Date(butcher.subscriptionExpiry).toLocaleDateString('ar-SA')
                : 'غير محدد'}
            </Text>
          </View>
          <AppIcon name="shield-checkmark" size={28} color={colors.gold} />
        </LinearGradient>
      )}
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  const { colors } = useTheme();
  const aboutStyles = useThemedStyles(({ colors }) => createAboutStyles(colors));
  return (
    <View style={aboutStyles.infoRow}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText style={aboutStyles.infoValue}>{value}</AppText>
        <AppText style={aboutStyles.infoLabel}>{label}</AppText>
      </View>
      <AppIcon name={icon} size={16} color={colors.electricBright} />
    </View>
  );
}

// ─── Tab: Chat ────────────────────────────────────────────────────────────────
function ChatTab({
  butcherName,
  chatAccess,
  onOpenChat,
}: {
  butcherName: string;
  chatAccess: ButcherChatAccess | null;
  onOpenChat: () => void;
}) {
  const { colors } = useTheme();
  const chatStyles = useThemedStyles(({ colors }) => createChatStyles(colors));
  const router = useRouter();

  if (!chatAccess?.allowed) {
    return (
      <View style={chatStyles.wrap}>
        <View style={chatStyles.lockedCard}>
          <AppIcon name="chatbubble-outline" size={28} color={colors.textMuted} />
          <View style={{ width: '100%' }}>
            <AppText style={chatStyles.lockedTitle}>المحادثة غير متاحة</AppText>
          </View>
          <View style={{ width: '100%' }}>
            <AppText style={chatStyles.lockedSub}>
              {chatAccess?.messageAr ??
                'التواصل المباشر مع الملحمة غير متاح'}
            </AppText>
          </View>
          <Pressable
            style={chatStyles.ordersLink}
            onPress={() => router.push('/butchers/my-orders')}
          >
            <Text style={chatStyles.ordersLinkText}>عرض طلباتي</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={chatStyles.wrap}>
      <Pressable
        style={({ pressed }) => [chatStyles.openChatBtn, pressed && { opacity: motion.press.opacity }]}
        onPress={onOpenChat}
      >
        <LinearGradient
          colors={[colors.electric, colors.cyan]}
          style={chatStyles.openChatGrad}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <AppIcon name="chatbubbles-outline" size={20} color="#fff" />
          <Text style={chatStyles.openChatText}>فتح المحادثة مع {butcherName}</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

// ─── Reviews Strip ────────────────────────────────────────────────────────────
function RatingDistribution({
  average,
  total,
  distribution,
}: {
  average: number;
  total: number;
  distribution: Record<number, number>;
}) {
  const { colors } = useTheme();
  const distStyles = useThemedStyles(({ colors: c }) =>
    StyleSheet.create({
      wrap: { paddingHorizontal: spacing.lg, gap: spacing.md, marginBottom: spacing.md },
      summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
      avg: { ...typography.display, color: c.textPrimary },
      meta: { gap: 4 },
      count: { ...butcherTypography.secondary, color: c.textMuted },
      barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
      barLabel: { width: 14, ...butcherTypography.secondary, color: c.textMuted, textAlign: 'center' },
      barTrack: {
        flex: 1,
        height: 6,
        borderRadius: 3,
        backgroundColor: c.bgElevated,
        overflow: 'hidden',
      },
      barFill: { height: '100%', borderRadius: 3, backgroundColor: c.electric },
    }),
  );

  const max = Math.max(1, ...Object.values(distribution));

  return (
    <View style={distStyles.wrap}>
      <View style={distStyles.summaryRow}>
        <Text style={distStyles.avg}>{average.toFixed(1)}</Text>
        <View style={distStyles.meta}>
          <View style={{ flexDirection: 'row', gap: 2 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <AppIcon
                key={i}
                name="star"
                size={14}
                color={i <= Math.round(average) ? colors.gold : colors.borderSoft}
              />
            ))}
          </View>
          <Text style={distStyles.count}>{total.toLocaleString('ar-SA')} تقييم</Text>
        </View>
      </View>
      {[5, 4, 3, 2, 1].map((star) => {
        const count = distribution[star] ?? 0;
        const pct = (count / max) * 100;
        return (
          <View key={star} style={distStyles.barRow}>
            <Text style={distStyles.barLabel}>{star}</Text>
            <View style={distStyles.barTrack}>
              <View style={[distStyles.barFill, { width: `${pct}%` }]} />
            </View>
            <Text style={[distStyles.barLabel, { width: 28 }]}>{count}</Text>
          </View>
        );
      })}
    </View>
  );
}

function ReviewsStrip({ reviews }: { reviews: ButcherReview[] }) {
  const { colors } = useTheme();
  const reviewsStyles = useThemedStyles(({ colors }) => createReviewsStyles(colors));
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={reviewsStyles.row}>
      {reviews.map((r) => (
        <View key={r.id} style={reviewsStyles.card}>
          <View style={reviewsStyles.header}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText style={reviewsStyles.author}>{r.authorNameAr}</AppText>
              <View style={reviewsStyles.stars}>
                {[...Array(5)].map((_, i) => (
                  <AppIcon
                    key={i}
                    name="star"
                    size={11}
                    color={i < r.rating ? colors.gold : colors.borderSoft}
                  />
                ))}
              </View>
            </View>
            <Image source={{ uri: r.authorAvatar }} style={reviewsStyles.avatar} />
          </View>
          <View style={{ width: '100%' }}>
            <AppText style={reviewsStyles.comment} numberOfLines={3}>{r.commentAr}</AppText>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function mapOfferFromApi(o: any): ButcherOffer {
  return {
    id: o.id,
    butcherId: o.butcherId,
    title: o.titleAr || o.titleEn,
    titleAr: o.titleAr,
    description: o.descriptionEn,
    descriptionAr: o.descriptionAr,
    discountPercent: o.discountPercent,
    originalPrice: o.originalPrice,
    offerPrice: o.offerPrice,
    image: o.image || undefined,
    validUntil: o.validUntil,
    country: o.country,
  };
}

function offersFromCachedRaw(raw?: Record<string, unknown>): ButcherOffer[] {
  const list = raw?.offers;
  if (!Array.isArray(list)) return [];
  return list.map((o) => mapOfferFromApi(o));
}

const EMPTY_REVIEW_DISTRIBUTION: Record<number, number> = {
  1: 0, 2: 0, 3: 0, 4: 0, 5: 0,
};

function applyDirectorySeed(id: string | undefined) {
  const detail = id ? getCachedButcherDetail(id) : null;
  if (detail) {
    return {
      butcher: detail.profile,
      products: detail.products,
      offers: detail.offers,
      reviews: detail.reviews,
      reviewDistribution: detail.reviewDistribution,
      stories: getCachedButcherStories() ?? [],
      loading: false,
    };
  }
  const cached = id ? findCachedButcher(id) : null;
  if (cached) {
    return {
      butcher: cached.profile,
      products: [] as ButcherProduct[],
      offers: offersFromCachedRaw(cached.raw),
      reviews: [] as ButcherReview[],
      reviewDistribution: { ...EMPTY_REVIEW_DISTRIBUTION },
      stories: getCachedButcherStories() ?? [],
      loading: false,
    };
  }
  return {
    butcher: null as ButcherProfile | null,
    products: [] as ButcherProduct[],
    offers: [] as ButcherOffer[],
    reviews: [] as ButcherReview[],
    reviewDistribution: { ...EMPTY_REVIEW_DISTRIBUTION },
    stories: getCachedButcherStories() ?? [],
    loading: true,
  };
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ButcherProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors, gradients } = useTheme();
  const styles = useThemedStyles(({ colors, scheme }) => createMainStyles(colors, scheme));
  const { accessToken, user } = useAuth();
  const {
    setButcherMeta,
    itemCount,
    subtotal,
    addLine,
  } = useButcherCart();
  const [activeNavId, setActiveNavId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [infoOpen, setInfoOpen] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [optionsProduct, setOptionsProduct] = useState<ButcherProduct | null>(null);

  // Vertical scroll + section tracking
  const scrollViewRef = useRef<ScrollView>(null);
  const sectionOffsetsRef = useRef<Record<string, number>>({});
  const categoryBarOffsetRef = useRef<number>(0);
  const isUserScrollingRef = useRef<boolean>(false);

  const [hydratedId, setHydratedId] = useState(id);
  const [butcher, setButcher] = useState<ButcherProfile | null>(
    () => applyDirectorySeed(id).butcher,
  );
  const butcherRef = useRef<ButcherProfile | null>(null);
  butcherRef.current = butcher;
  const [products, setProducts] = useState<ButcherProduct[]>(
    () => applyDirectorySeed(id).products,
  );
  const [offers, setOffers] = useState<ButcherOffer[]>(() => applyDirectorySeed(id).offers);
  const [reviews, setReviews] = useState<ButcherReview[]>(() => applyDirectorySeed(id).reviews);
  const [reviewDistribution, setReviewDistribution] = useState<Record<number, number>>(
    () => applyDirectorySeed(id).reviewDistribution,
  );
  const [reviewDraft, setReviewDraft] = useState({ rating: 5, comment: '' });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [storiesList, setStoriesList] = useState<ButcherStory[]>(
    () => applyDirectorySeed(id).stories,
  );
  const [loading, setLoading] = useState(() => applyDirectorySeed(id).loading);
  const [refreshing, setRefreshing] = useState(false);
  const [chatAccess, setChatAccess] = useState<ButcherChatAccess | null>(null);

  if (id !== hydratedId) {
    const next = applyDirectorySeed(id);
    setHydratedId(id);
    setButcher(next.butcher);
    setProducts(next.products);
    setOffers(next.offers);
    setReviews(next.reviews);
    setReviewDistribution(next.reviewDistribution);
    setStoriesList(next.stories);
    setLoading(next.loading);
  }

  const stories = useMemo(
    () => storiesList.filter((s) => (butcher ? s.butcherId === butcher.id : false)),
    [storiesList, butcher],
  );

  /** Hunger-style bar: offers + product categories in menu order + stories. About is the info sheet. */
  const navItems = useMemo((): ButcherStoreNavItem[] => {
    const items: ButcherStoreNavItem[] = [];
    if (offers.length > 0) {
      items.push({ id: 'offers', label: 'عروضنا', kind: 'offers' });
    }
    const seen = new Set<string>();
    for (const p of products) {
      if (!p.category || seen.has(p.category)) continue;
      seen.add(p.category);
      const label =
        CATEGORY_LABELS[p.category as MeatCategory]?.ar ?? p.category;
      items.push({ id: p.category, label, kind: 'category' });
    }
    if (products.length > 0 && seen.size === 0) {
      items.push({ id: 'menu', label: 'المنتجات', kind: 'category' });
    }
    if (stories.length > 0) {
      items.push({ id: 'stories', label: 'القصص', kind: 'stories' });
    }
    return items;
  }, [products, stories.length, offers.length]);

  const activeNav = useMemo(() => {
    return (
      navItems.find((i) => i.id === activeNavId) ??
      navItems.find((i) => i.kind === 'category') ??
      navItems[0] ??
      null
    );
  }, [navItems, activeNavId]);

  useEffect(() => {
    if (!navItems.length) return;
    if (!navItems.some((i) => i.id === activeNavId)) {
      const firstCat = navItems.find((i) => i.kind === 'category');
      setActiveNavId(firstCat?.id ?? navItems[0].id);
    }
  }, [navItems, activeNavId]);

  const searching = searchQuery.trim().length > 0;
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return products.filter((p) => {
      const hay = `${p.nameAr} ${p.name ?? ''} ${p.descriptionAr ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [products, searchQuery]);

  const loadChatAccess = useCallback(async () => {
    if (!id) return;
    try {
      const access = await fetchButcherChatAccess(id, accessToken);
      setChatAccess(access);
    } catch {
      setChatAccess({
        allowed: false,
        reason: 'order_not_accepted',
        messageAr: 'المحادثة متاحة بعد تقديم الطلب وقبوله من الملحمة',
      });
    }
  }, [id, accessToken]);

  useEffect(() => {
    if (!id || !accessToken) {
      setFavorited(false);
      return;
    }
    let cancelled = false;
    void fetchButcherFavoriteStatus(accessToken, id)
      .then((value) => {
        if (!cancelled) setFavorited(value);
      })
      .catch(() => {
        if (!cancelled) setFavorited(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, accessToken]);

  useFocusEffect(
    useCallback(() => {
      void loadChatAccess();
    }, [loadChatAccess]),
  );

  useEffect(() => {
    let cancelled = false;
    if (!id) return;

    const cachedDetail = getCachedButcherDetail(id);
    if (cachedDetail) {
      setButcher(cachedDetail.profile);
      setProducts(cachedDetail.products);
      setOffers(cachedDetail.offers);
      setReviews(cachedDetail.reviews);
      setReviewDistribution(cachedDetail.reviewDistribution);
      setLoading(false);
    }
    const cachedStories = getCachedButcherStories();
    if (cachedStories) setStoriesList(cachedStories);

    const load = async (force = false) => {
      if (!butcherRef.current || butcherRef.current.id !== id) setLoading(true);
      try {
        // Stories are optional and must not block butcher details.
        const [snapshot, stories] = await Promise.all([
          fetchButcherDetail(id, { token: accessToken, force }),
          fetchButcherStories({ force }),
        ]);
        if (cancelled) return;
        if (snapshot) {
          if (snapshot.profile.id && String(snapshot.profile.id) !== String(id)) return;
          if (String(snapshot.profile.id) === String(id)) {
            setButcher(snapshot.profile);
            setProducts(snapshot.products);
            setOffers(snapshot.offers);
            setReviews(snapshot.reviews);
            setReviewDistribution(snapshot.reviewDistribution);
          }
        }
        setStoriesList(stories);
      } catch (err) {
        console.warn('[ButcherProfileScreen] Failed to fetch details:', err);
        if (cancelled) return;
        const have = butcherRef.current && butcherRef.current.id === id;
        const failed = true;
        if (failed && !have) return;
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [id, accessToken]);

  const onRefresh = useCallback(async () => {
    if (!id) return;
    setRefreshing(true);
    try {
      const [snapshot, stories] = await Promise.all([
        fetchButcherDetail(id, { token: accessToken, force: true }),
        fetchButcherStories({ force: true }),
      ]);
      if (snapshot && String(snapshot.profile.id) === String(id)) {
        setButcher(snapshot.profile);
        setProducts(snapshot.products);
        setOffers(snapshot.offers);
        setReviews(snapshot.reviews);
        setReviewDistribution(snapshot.reviewDistribution);
      }
      setStoriesList(stories);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [accessToken, id]);

  const onOpenChat = useCallback(() => {
    if (!chatAccess?.allowed || !id) return;
    router.push(
      butcherChatRouteParams({
        butcherId: id,
        orderId: chatAccess.orderId,
        receiverId: chatAccess.receiverId,
        receiverName: butcher?.nameAr,
        receiverAvatar: butcher?.logo,
      }),
    );
  }, [chatAccess, id, router, butcher?.nameAr, butcher?.logo]);

  useEffect(() => {
    if (!butcher) return;
    setButcherMeta({
      butcherId: butcher.id,
      butcherNameAr: butcher.nameAr,
      butcherLogo: butcher.logo,
    });
  }, [butcher?.id, butcher?.nameAr, butcher?.logo, setButcherMeta]);


  const handleOpenOptions = useCallback((product: ButcherProduct) => {
    if (!product.inStock) {
      Alert.alert('غير متوفر', 'هذا المنتج غير متوفر حالياً');
      return;
    }
    setOptionsProduct(product);
  }, []);

  const handleFavorite = useCallback(async () => {
    if (!accessToken || !user?.id || !id) {
      router.push('/auth/phone');
      return;
    }
    try {
      const next = await toggleButcherFavorite(accessToken, user.id, id, favorited);
      setFavorited(next);
    } catch {
      void showToast('تعذر تحديث المفضلة', 'error');
    }
  }, [accessToken, user?.id, id, favorited, router]);

  const currency = butcher
    ? gccCurrencies[butcher.country as Country] || gccCurrencies['SA']
    : gccCurrencies['SA'];

  // Scroll handler: update active category based on visible section
  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (isUserScrollingRef.current) return;
      const scrollY = e.nativeEvent.contentOffset.y;
      const threshold = categoryBarOffsetRef.current + 40;
      const offsets = sectionOffsetsRef.current;
      let bestId: string | null = null;
      for (const [id, offset] of Object.entries(offsets)) {
        if (scrollY + threshold >= offset) {
          bestId = id;
        }
      }
      if (bestId && bestId !== activeNavId) {
        setActiveNavId(bestId);
      }
    },
    [activeNavId],
  );

  // Category bar tap: update active id + scroll to section
  const handleCategoryChange = useCallback(
    (item: ButcherStoreNavItem) => {
      setActiveNavId(item.id);
      const offset = sectionOffsetsRef.current[item.id];
      if (offset !== undefined && scrollViewRef.current) {
        isUserScrollingRef.current = true;
        scrollViewRef.current.scrollTo({ y: Math.max(0, offset - categoryBarOffsetRef.current), animated: true });
        setTimeout(() => {
          isUserScrollingRef.current = false;
        }, 600);
      }
    },
    [],
  );

  const submitReview = async () => {
    if (!accessToken || !id) {
      router.push('/auth/phone');
      return;
    }
    setSubmittingReview(true);
    try {
      const res = await fetch(`${API_BASE}/api/butchers/${id}/reviews`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rating: reviewDraft.rating,
          comment: reviewDraft.comment.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        void showToast(json.message || 'لا يمكنك التقييم حالياً', 'error');
        return;
      }
      void showToast('تم إرسال تقييمك بنجاح', 'success');
      setReviewDraft({ rating: 5, comment: '' });
      const refresh = await fetch(`${API_BASE}/api/butchers/${id}/reviews`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (refresh.ok) {
        const rj = await refresh.json();
        const payload = rj.data;
        if (payload?.distribution) setReviewDistribution(payload.distribution);
      }
    } catch {
      void showToast('تعذر إرسال التقييم', 'error');
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading && (!butcher || butcher.id !== id)) {
    return (
      <Screen edges={['top']} pattern={false} style={styles.screen}>
        <AppText variant="body" align="center" style={{ color: '#fff', marginTop: 80 }}>
          جاري تحميل تفاصيل الملحمة...
        </AppText>
      </Screen>
    );
  }

  if (!butcher) {
    return (
      <Screen edges={['top']} pattern={false} style={styles.screen}>
        <AppText variant="body" align="center" style={{ color: '#fff', marginTop: 80 }}>
          الملحمة غير موجودة
        </AppText>
      </Screen>
    );
  }

  const handleAddToCart = (input: {
    product: ButcherProduct;
    cutType: CutType;
    weightRaw: string;
  }) => {
    const ok = addLine(input);
    if (!ok) {
      Alert.alert('خطأ', 'تعذر إضافة المنتج — تحقق من الوزن والسعر');
    }
  };

  // Build compact inline meta line for the header
  const metaLine = [
    butcher.cityAr || butcher.city,
    butcherMinOrderLabel(butcher),
    butcherFeeLabel(butcher) !== '—' ? `توصيل ${butcherFeeLabel(butcher)}` : null,
  ].filter(Boolean).join('  •  ');

  return (
    <Screen edges={['top']} pattern={false} style={styles.screen}>
      <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />

      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={handleScroll}
        scrollEventThrottle={100}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
        }
      >
        <ButcherStoreHero
          butcher={butcher}
          favorited={favorited}
          onBack={() => router.back()}
          onFavorite={() => void handleFavorite()}
          onInfo={() => setInfoOpen(true)}
        />

        {/* Compact header: name + inline meta line */}
        <View style={styles.profileHeader}>
          <AppText variant="sectionTitle" style={styles.name}>{butcher.nameAr}</AppText>
          {metaLine ? (
            <AppText variant="caption" color="textMuted" style={styles.metaLine}>
              {metaLine}
            </AppText>
          ) : null}
          {chatAccess?.allowed ? (
            <Pressable
              style={[styles.chatCta, styles.chatCtaActive]}
              onPress={onOpenChat}
            >
              <AppIcon name="chatbubble-outline" size={18} color={colors.electricBright} />
              <AppText variant="body" style={styles.chatCtaText}>محادثة</AppText>
            </Pressable>
          ) : null}
        </View>

        <StoreSearchBar
          styles={styles}
          colors={colors}
          onQueryChange={setSearchQuery}
        />

        {searching ? (
          <View style={styles.tabContent}>
            <StoreProductsList
              heading="نتائج البحث"
              products={searchResults}
              currencySymbol={currency.symbol}
              onOpenOptions={handleOpenOptions}
            />
          </View>
        ) : (
          <>
            {/* Horizontal category bar */}
            <View
              style={styles.stickyNav}
              onLayout={(e) => {
                categoryBarOffsetRef.current = e.nativeEvent.layout.y;
              }}
            >
              <ButcherMenuCategoryBar
                items={navItems}
                activeId={activeNav?.id ?? ''}
                onChange={handleCategoryChange}
              />
            </View>

            {/* Vertical product sections */}
            {navItems.length ? (
              navItems.map((item) => {
                let sectionContent: React.ReactNode;
                if (item.kind === 'offers') {
                  sectionContent = <OffersTab offers={offers} currencySymbol={currency.symbol} />;
                } else if (item.kind === 'stories') {
                  sectionContent = <StoriesTab stories={stories} />;
                } else {
                  const list =
                    item.id === 'menu'
                      ? products
                      : products.filter((p) => p.category === item.id);
                  sectionContent = (
                    <StoreProductsList
                      products={list}
                      currencySymbol={currency.symbol}
                      onOpenOptions={handleOpenOptions}
                    />
                  );
                }
                return (
                  <View
                    key={item.id}
                    onLayout={(e) => {
                      sectionOffsetsRef.current[item.id] = e.nativeEvent.layout.y;
                    }}
                  >
                    <View style={styles.sectionCategoryHeader}>
                      <AppText variant="heading3" style={styles.sectionCategoryTitle}>
                        {item.label}
                      </AppText>
                    </View>
                    {sectionContent}
                  </View>
                );
              })
            ) : (
              <View style={styles.tabContent}>
                <StoreProductsList
                  products={[]}
                  currencySymbol={currency.symbol}
                  onOpenOptions={handleOpenOptions}
                />
              </View>
            )}
          </>
        )}

        <View style={{ height: itemCount > 0 ? 120 : 100 }} />
      </ScrollView>

      <Modal
        visible={infoOpen}
        animationType="slide"
        onRequestClose={() => setInfoOpen(false)}
      >
        <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
          <Row align="center" justify="between" style={styles.infoHeader}>
            <AppText variant="cardTitle" style={styles.infoTitle}>عن الملحمة</AppText>
            <Pressable onPress={() => setInfoOpen(false)} accessibilityLabel="إغلاق">
              <AppIcon name="close" size={22} color={colors.textPrimary} />
            </Pressable>
          </Row>
          <ScrollView showsVerticalScrollIndicator={false}>
            <AboutTab butcher={butcher} />
            <View style={{ marginTop: spacing.xl }}>
              <View style={{ paddingHorizontal: spacing.lg, width: '100%' }}>
                <AppText variant="cardTitle" style={styles.sectionTitle}>
                  آراء العملاء ({butcher.reviewCount})
                </AppText>
              </View>
              <RatingDistribution
                average={butcher.rating}
                total={butcher.reviewCount}
                distribution={reviewDistribution}
              />
              {accessToken ? (
                <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.md }}>
                  <Row gap="sm">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Pressable key={star} onPress={() => setReviewDraft((d) => ({ ...d, rating: star }))}>
                        <AppIcon
                          name="star"
                          size={22}
                          color={star <= reviewDraft.rating ? colors.gold : colors.borderSoft}
                        />
                      </Pressable>
                    ))}
                  </Row>
                  <TextInput
                    style={{
                      borderWidth: 1,
                      borderColor: colors.borderSoft,
                      borderRadius: radius.lg,
                      padding: spacing.md,
                      color: colors.textPrimary,
                      ...rtlInputText,
                      minHeight: 80,
                    }}
                    placeholder="تعليق اختياري..."
                    placeholderTextColor={colors.textMuted}
                    value={reviewDraft.comment}
                    onChangeText={(t) => setReviewDraft((d) => ({ ...d, comment: t }))}
                    multiline
                  />
                  <Pressable
                    onPress={() => void submitReview()}
                    disabled={submittingReview}
                    style={{
                      backgroundColor: butcherMarket.action,
                      borderRadius: radius.pill,
                      paddingVertical: 12,
                      alignItems: 'center',
                    }}
                  >
                    <AppText variant="body" style={{ color: '#fff' }}>
                      {submittingReview ? 'جاري الإرسال...' : 'إرسال التقييم'}
                    </AppText>
                  </Pressable>
                </View>
              ) : null}
              {reviews.length > 0 ? <ReviewsStrip reviews={reviews} /> : null}
            </View>
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <ButcherProductOptionsModal
        visible={optionsProduct != null}
        product={optionsProduct}
        currencySymbol={currency.symbol}
        onClose={() => setOptionsProduct(null)}
        onAddToCart={handleAddToCart}
      />

      <ButcherStickyCartBar
        itemCount={itemCount}
        subtotal={subtotal}
        currencySymbol={currency.symbol}
        onPress={() =>
          router.push({
            pathname: '/butchers/cart',
            params: { butcherId: butcher.id },
          })
        }
      />
    </Screen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createMainStyles(colors: ThemeColors, scheme: 'light' | 'dark') {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenRoot },

  coverWrap: { height: 200, position: 'relative' },
  cover: { width: '100%', height: '100%' },
  backBtn: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(8,14,10,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverActions: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  coverAction: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(8,14,10,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  profileHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    gap: spacing.sm,
  },
  metaLine: {
    writingDirection: 'rtl',
  },
  sectionCategoryHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderHairline,
  },
  sectionCategoryTitle: {
    color: colors.textPrimary,
  },
  searchWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  searchPill: {
    alignItems: 'center',
    minHeight: 46,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    backgroundColor: butcherSearchFill(scheme),
  },
  searchInput: {
    ...butcherTypography.secondary,
    color: colors.textPrimary,
    flex: 1,
    paddingVertical: 0,
  },
  stickyNav: {
    backgroundColor: colors.screenRoot,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderHairline,
  },
  infoHeader: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderHairline,
  },
  infoTitle: {},
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  logoWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSoft,
    backgroundColor: colors.bgElevated,
    overflow: 'hidden',
    position: 'relative',
    flexShrink: 0,
  },
  logo: { width: '100%', height: '100%' },
  verifiedRing: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 12,
    backgroundColor: colors.bgDeep,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.gold,
  },
  nameBlock: { flex: 1, minWidth: 0 },
  name: {
    width: '100%',
    marginBottom: 6,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingScore: { ...butcherTypography.primary, color: colors.textPrimary },
  ratingCount: { ...butcherTypography.secondary, color: colors.textMuted, writingDirection: 'rtl' },
  serviceRow: {},
  serviceItem: {},
  serviceText: {},

  ctaRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  chatCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.electricBright + '88',
    backgroundColor: colors.electric + '11',
  },
  chatCtaFull: { flex: 1 },
  chatCtaText: { color: colors.textBrandStrong },
  chatCtaActive: {
    borderColor: colors.electricBright,
    backgroundColor: colors.electric + '22',
  },

  tabsRow: {
    flexDirection: 'row',
        justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
    gap: spacing.lg,
  },
  tabBtn: {
    alignItems: 'stretch',
    paddingBottom: 2,
  },
  tabCoverTrail: {
    flexDirection: 'row',
        justifyContent: 'flex-end',
  },
  tabTextShell: {
      },
  tabLabel: {
    ...typography.smallHeading,
    color: colors.textMuted,
  },
  tabLabelActive: { ...butcherTypography.emphasis, color: colors.electricBright },
  tabUnderline: {
    marginTop: 6,
    height: 3,
    width: '100%',
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  tabUnderlineActive: {
    backgroundColor: colors.electric,
  },
  tabContent: { paddingTop: spacing.lg },
  sectionTitle: {
    marginBottom: spacing.md,
  },
  });
}

function createEmptyStyles(colors: ThemeColors) {
  return StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 60, gap: spacing.sm, paddingHorizontal: spacing.lg },
  heading: {
    ...butcherTypography.title,
    color: colors.textPrimary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  title: {
    ...butcherTypography.title,
    color: colors.textMuted,
  },
  });
}

// Offers tab
function createOffersStyles(colors: ThemeColors) {
  return StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.gold + '44',
  },
  img: { width: '100%', height: 160 },
  body: { padding: spacing.lg },
  discountBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.danger,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    marginBottom: spacing.sm,
  },
  discountText: { ...butcherTypography.emphasis, color: '#fff' },
  offerTitle: {
    ...butcherTypography.title,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  offerDesc: {
    ...butcherTypography.secondary,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  priceRow: {
    flexDirection: 'row',
        justifyContent: 'flex-end',
    alignItems: 'baseline',
    gap: 10,
    marginTop: spacing.md,
  },
  offerPrice: { ...butcherTypography.title, color: colors.gold },
  originalPrice: {
    ...butcherTypography.body,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  footer: {
    flexDirection: 'row',
        justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 5,
    marginTop: spacing.sm,
  },
  validText: { ...butcherTypography.secondary, color: colors.textMuted, writingDirection: 'rtl' },
  });
}

// Stories tab
function createStoriesStyles(colors: ThemeColors) {
  return StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  item: {
    width: '47.5%',
    aspectRatio: 0.75,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.bgSurface,
    position: 'relative',
  },
  img: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.bgGlassStrong,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  badgeText: { ...butcherTypography.meta, color: colors.textBrand, writingDirection: 'rtl' },
  captionShell: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
      },
  caption: {
    ...butcherTypography.meta,
    color: '#fff',
    lineHeight: 14,
  },
  });
}

// About tab
function createAboutStyles(colors: ThemeColors) {
  return StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg },
  section: { marginBottom: spacing.xl },
  sectionTitle: {
    ...butcherTypography.title,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  bio: {
    ...butcherTypography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  infoGrid: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    marginBottom: spacing.xl,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
        alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  infoLabel: {
    ...butcherTypography.secondary,
    color: colors.textMuted,
  },
  infoValue: {
    ...butcherTypography.emphasis,
    color: colors.textPrimary,
  },
  chipsWrap: {
    flexDirection: 'row',
        justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderMid,
  },
  chipText: { ...butcherTypography.secondary, color: colors.textBrand },
  verifiedCard: {
    flexDirection: 'row',
        justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.gold + '44',
    marginBottom: spacing.xl,
  },
  verifiedTitle: {
    ...butcherTypography.primary,
    color: colors.gold,
  },
  verifiedSub: {
    ...butcherTypography.secondary,
    color: colors.textMuted,
    marginTop: 2,
  },
  });
}

// Chat tab
function createChatStyles(colors: ThemeColors) {
  return StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg },
  bubble: {
    maxWidth: '80%',
    marginBottom: spacing.md,
    borderRadius: radius.xl,
    padding: spacing.md,
  },
  bubbleMe: {
    alignSelf: 'flex-end',
    backgroundColor: colors.electric + 'CC',
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    alignSelf: 'flex-start',
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { ...butcherTypography.body, lineHeight: 20 },
  textMe: { color: '#fff' },
  textThem: { color: colors.textPrimary },
  bubbleTime: { ...butcherTypography.meta, color: 'rgba(255,255,255,0.5)', marginTop: 4,  },
  openChatBtn: {
    marginTop: spacing.xl,
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  openChatGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
  },
  openChatText: { ...butcherTypography.primary, color: '#fff' },
  lockedCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  lockedTitle: {
    ...butcherTypography.title,
    color: colors.textPrimary,
  },
  lockedSub: {
    ...butcherTypography.body,
    color: colors.textMuted,
    lineHeight: 22,
  },
  ordersLink: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.electric + '22',
    borderWidth: 1,
    borderColor: colors.electric + '55',
  },
  ordersLinkText: { ...butcherTypography.primary, color: colors.textBrandStrong },
  });
}

// Reviews
function createReviewsStyles(colors: ThemeColors) {
  return StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  card: {
    width: 220,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
        justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
  },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bgElevated },
  author: {
    ...butcherTypography.emphasis,
    color: colors.textPrimary,
  },
  stars: {
    flexDirection: 'row',
        justifyContent: 'flex-end',
    gap: 2,
    marginTop: 2,
  },
  comment: {
    ...butcherTypography.secondary,
    color: colors.textSecondary,
  },
  });
}
