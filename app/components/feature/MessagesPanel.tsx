// SAFAT — Messages inbox (Premium · RTL · Mobile-first)
import { AppIcon } from '@/components/ui/FlaticonIcon';
import { Image, uriSource } from '@/components/ui/AppImage';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { functional } from '@/design-system';
import { AppText, SarhButton, SarhInput } from '@/design-system/components';
import { Row, Stack } from '@/design-system/layout';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { radius, type ThemeColors } from '@/constants/theme';
import { space } from '@/design-system/tokens';
import { cloudinaryFitUrl } from '@/lib/listingMedia';
import { useLayout } from '@/hooks/useLayout';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { AppFlatList } from '@/components/ui/AppFlatList';
import {
  filterMessageThreads,
  useMessageThreads,
  type MessageThreadFilter,
  type MessageThreadItem,
} from '@/hooks/useMessageThreads';
import {
  formatListingPrice,
  getAllMessageListingContexts,
  type MessageListingPreview,
} from '@/lib/messageListingContext';
import { UserProfileLink } from '@/components/feature/UserProfileLink';

function formatThreadTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString('ar-SA', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  ) {
    return 'أمس';
  }
  return date.toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' });
}

interface MessagesPanelProps {
  variant?: 'embedded' | 'standalone';
  showHeader?: boolean;
}

export function MessagesPanel({
  variant = 'standalone',
  showHeader = true,
}: MessagesPanelProps) {
  const { colors } = useTheme();
  const { gutter } = useLayout();
  const styles = useThemedStyles(({ colors: c }) => createStyles(c));
  const router = useRouter();
  const listBottomPadding = variant === 'embedded' ? space[16] : space[24];
  const { accessToken } = useAuth();
  const { threads, loading, error, refetch } = useMessageThreads(accessToken, 'ALL');
  const filter: MessageThreadFilter = 'all';
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [listingByPeer, setListingByPeer] = useState<
    Record<string, MessageListingPreview>
  >({});
  const threadsLenRef = useRef(threads.length);
  const loadingRef = useRef(loading);
  const skipFirstFocusRef = useRef(true);
  threadsLenRef.current = threads.length;
  loadingRef.current = loading;

  useFocusEffect(
    useCallback(() => {
      if (skipFirstFocusRef.current) {
        skipFirstFocusRef.current = false;
        void getAllMessageListingContexts().then(setListingByPeer);
        return;
      }
      const forceEmpty = threadsLenRef.current === 0 && !loadingRef.current;
      void refetch(forceEmpty);
      void getAllMessageListingContexts().then(setListingByPeer);
    }, [refetch]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch(true);
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const listingTitlesByPeer = useMemo(() => {
    const map: Record<string, string | undefined> = {};
    for (const [peerId, preview] of Object.entries(listingByPeer)) {
      map[peerId] = preview.title;
    }
    return map;
  }, [listingByPeer]);

  const filteredChats = useMemo(
    () => filterMessageThreads(threads, filter, search, listingTitlesByPeer),
    [threads, filter, search, listingTitlesByPeer],
  );

  const openChat = useCallback((chat: MessageThreadItem) => {
    const p = chat.participant;
    if (!p) return;
    const isButcher = chat.type === 'BUTCHER';
    if (isButcher) {
      Alert.alert('المحادثة', 'التواصل المباشر مع الملحمة غير متاح');
      return;
    }
    const listing = listingByPeer[p.id];
    router.push({
      pathname: '/butchers/chat',
      params: {
        threadId: chat.id,
        receiverId: p.id,
        receiverName: isButcher
          ? chat.butcher?.nameAr || p.arabicName
          : p.arabicName,
        receiverAvatar: isButcher
          ? chat.butcher?.logo || p.avatar || ''
          : p.avatar ?? '',
        threadType: chat.type,
        accountType: isButcher
          ? 'BUTCHER'
          : listing
            ? 'LIVESTOCK_TRADER'
            : 'USER',
        ...(chat.butcherId ? { butcherId: chat.butcherId } : {}),
        ...(listing
          ? {
              listingId: listing.listingId,
              listingTitle: listing.title,
              listingPrice: String(listing.price),
              listingCurrency: listing.currency || 'SAR',
              listingImage: listing.image || '',
              listingLocation: listing.location || '',
            }
          : {}),
      },
    } as never);
  }, [listingByPeer, router]);

  const resolveListingPreview = (chat: MessageThreadItem) => {
    const peerId = chat.participant?.id;
    if (peerId && listingByPeer[peerId]) return listingByPeer[peerId];
    if (chat.type === 'BUTCHER' && chat.butcher) {
      return {
        listingId: chat.butcher.id,
        title: chat.butcher.nameAr,
        price: 0,
        image: chat.butcher.logo || undefined,
        peerUserId: peerId || '',
        location: undefined,
      } satisfies MessageListingPreview;
    }
    return null;
  };

  const listData = useMemo(
    () => filteredChats.filter((chat) => Boolean(chat.participant)),
    [filteredChats],
  );

  const renderThread = useCallback(
    ({ item: chat }: { item: MessageThreadItem }) => {
      const p = chat.participant;
      if (!p) return null;
      const isButcher = chat.type === 'BUTCHER';
      const title = isButcher
        ? chat.butcher?.nameAr || p.arabicName
        : p.arabicName;
      const avatarUri = isButcher
        ? chat.butcher?.logo || p.avatar
        : p.avatar;
      const listing = resolveListingPreview(chat);
      const showListingMeta =
        listing &&
        (listing.price > 0 || Boolean(listing.image) || Boolean(listing.title));

      return (
        <Pressable
          onPress={() => openChat(chat)}
          style={({ pressed }) => [
            styles.chatRow,
            { paddingHorizontal: gutter },
            pressed && styles.chatRowPressed,
          ]}
        >
          <Row gap="md" align="center">
            <Row gap="sm" align="center">
              {isButcher ? (
                <View style={styles.avatarWrap}>
                  <Image
                    source={{ uri: avatarUri }}
                    style={styles.avatar}
                    contentFit="cover"
                  />
                </View>
              ) : (
                <UserProfileLink userId={p.id}>
                  <View style={styles.avatarWrap}>
                    <Image
                      source={{ uri: avatarUri }}
                      style={styles.avatar}
                      contentFit="cover"
                    />
                    <View style={styles.onlineDot} />
                  </View>
                </UserProfileLink>
              )}
              {listing?.image ? (
                <Image
                  source={uriSource(cloudinaryFitUrl(listing.image, 'row'))}
                  style={styles.listingThumb}
                  contentFit="cover"
                />
              ) : null}
            </Row>

            <Stack gap="xs" style={styles.chatBody}>
              <Row justify="between" align="center" gap="sm">
                <Row gap="xs" align="center" fill>
                  <AppText variant="label" numberOfLines={1} style={styles.flex}>
                    {title}
                  </AppText>
                  {!isButcher && p.verified ? (
                    <AppIcon
                      name="checkmark-circle"
                      size={14}
                      color={colors.electricBright}
                    />
                  ) : null}
                </Row>
                <AppText variant="micro" color="textMuted">
                  {formatThreadTime(chat.lastMessageAt)}
                </AppText>
              </Row>

              {showListingMeta && listing.price > 0 ? (
                <AppText variant="caption" color="success" numberOfLines={1}>
                  {listing.title}
                  {' · '}
                  {formatListingPrice(listing.price, listing.currency)}
                </AppText>
              ) : showListingMeta && listing.title && isButcher ? (
                <AppText variant="caption" color="success" numberOfLines={1}>
                  {listing.title}
                </AppText>
              ) : null}

              <Row justify="between" align="center" gap="sm">
                <AppText variant="caption" color="textMuted" numberOfLines={1} style={styles.flex}>
                  {chat.isMine ? 'أنت: ' : ''}
                  {chat.lastMessage ?? '—'}
                </AppText>
                {chat.unread > 0 ? (
                  <View style={styles.unreadBadge}>
                    <AppText variant="caption" style={{ color: functional.onPrimary }}>
                      {chat.unread > 99 ? '99+' : chat.unread}
                    </AppText>
                  </View>
                ) : null}
              </Row>
            </Stack>
          </Row>
        </Pressable>
      );
    },
    [colors.electricBright, gutter, listingByPeer, openChat, styles],
  );

  const showInitialSpinner =
    (loading && threads.length === 0) ||
    (error === 'fetch_failed' && threads.length === 0);
  const showUnauthorized = error === 'unauthorized' && threads.length === 0;

  return (
    <View style={styles.root}>
      {showHeader ? <ScreenHeader variant="tab" title="الرسائل" /> : null}

      <View style={[styles.searchWrap, { paddingHorizontal: gutter }]}>
        <SarhInput
          value={search}
          onChangeText={setSearch}
          placeholder="البحث في الرسائل والإعلانات"
          returnKeyType="search"
          leadingIcon="search"
          clearButtonMode="while-editing"
        />
      </View>

      {showInitialSpinner ? (
        <Stack gap="sm" align="center" style={styles.empty}>
          <ActivityIndicator size="large" color={colors.electricBright} />
          <AppText variant="caption" color="textMuted" align="center">
            جاري تحميل المحادثات...
          </AppText>
        </Stack>
      ) : showUnauthorized ? (
        <Stack gap="sm" align="center" style={styles.empty}>
          <View style={styles.emptyIconWrap}>
            <AppIcon name="lock-closed-outline" size={28} color={colors.electricBright} />
          </View>
          <AppText variant="heading3" align="center">سجّل الدخول</AppText>
          <AppText variant="caption" color="textMuted" align="center">
            عرض رسائلك يتطلب تسجيل الدخول
          </AppText>
        </Stack>
      ) : (
        <AppFlatList
          style={styles.list}
          data={listData}
          keyExtractor={(item) => item.id}
          renderItem={renderThread}
          contentContainerStyle={{ paddingBottom: listBottomPadding, flexGrow: 1 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
          }
          ListEmptyComponent={
            <Stack gap="sm" align="center" style={[styles.emptyCard, { marginHorizontal: gutter }]}>
              <View style={styles.emptyIconWrap}>
                <AppIcon name="chatbubbles-outline" size={28} color={colors.electricBright} />
              </View>
              <AppText variant="heading3" align="center">ابدأ محادثة جديدة</AppText>
              <AppText variant="caption" color="textMuted" align="center">
                تواصل مع البائعين عبر الإعلانات أو الملاحم
              </AppText>
              <SarhButton
                title="استكشف الإعلانات"
                onPress={() => router.push('/(tabs)/market' as never)}
              />
            </Stack>
          }
        />
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1 },
    list: { flex: 1 },
    searchWrap: {
      paddingBottom: space[12],
    },
    chatRow: {
      paddingVertical: space[12],
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderSoft,
    },
    chatRowPressed: { backgroundColor: colors.bgSurface },
    avatarWrap: { position: 'relative' },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.bgElevated,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
    onlineDot: {
      position: 'absolute',
      bottom: 1,
      end: 1,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.emerald,
      borderWidth: 2,
      borderColor: colors.bgDeep,
    },
    listingThumb: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: colors.bgElevated,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
    chatBody: { flex: 1, minWidth: 0 },
    flex: { flex: 1, minWidth: 0 },
    unreadBadge: {
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      paddingHorizontal: 6,
      backgroundColor: colors.electricBright,
      alignItems: 'center',
      justifyContent: 'center',
    },
    empty: {
      paddingVertical: space[48],
      paddingHorizontal: space[24],
    },
    emptyCard: {
      marginTop: space[24],
      paddingVertical: space[32],
      paddingHorizontal: space[24],
      borderRadius: radius.xl,
      backgroundColor: colors.bgSurface,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
    emptyIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `${colors.emerald}24`,
      marginBottom: space[8],
    },
  });
}
