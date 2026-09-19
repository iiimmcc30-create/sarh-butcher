import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { PostItem } from '@/components/feature/PostItem';
import { AppFlatList } from '@/components/ui/AppFlatList';
import { useAuth } from '@/contexts/AuthContext';
import { AppText, SarhButton } from '@/design-system/components';
import { Screen, ScreenBody, Stack } from '@/design-system/layout';
import { useApp } from '@/hooks/useApp';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { openPostDetail } from '@/lib/openPost';
import { requireAuth, sharePost, showPostMenu } from '@/lib/postInteractions';
import { safePush } from '@/lib/safeNavigate';
import type { Post } from '@/services/types';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ListRenderItemInfo,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { type ThemeColors } from '@/constants/theme';

export default function FavoritesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors: c }) => createStyles(c));
  const { isAuthenticated } = useAuth();
  const {
    me,
    posts,
    likedPosts,
    bookmarkedPosts,
    toggleLike,
    toggleBookmark,
    deletePost,
    fetchPosts,
  } = useApp();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (opts?: { refresh?: boolean }) => {
      if (opts?.refresh) setRefreshing(true);
      else setLoading(true);
      try {
        await fetchPosts('for_you', { force: opts?.refresh });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fetchPosts],
  );

  useFocusEffect(
    useCallback(() => {
      if (posts.length === 0) {
        void load();
      }
    }, [load, posts.length]),
  );

  const favorites = useMemo(
    () => posts.filter((post) => bookmarkedPosts.has(post.id)),
    [posts, bookmarkedPosts],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Post>) => (
      <PostItem
        post={{
          ...item,
          liked: likedPosts.has(item.id),
          bookmarked: true,
        }}
        onPress={() => openPostDetail(router, item.id)}
        onLike={() => requireAuth(isAuthenticated, 'الإعجاب') && toggleLike(item.id)}
        onComment={() => openPostDetail(router, item.id, { focusComment: isAuthenticated })}
        onBookmark={() => requireAuth(isAuthenticated, 'الحفظ') && toggleBookmark(item.id)}
        onShare={() => sharePost(item)}
        onMenu={() => showPostMenu(item, me, router, deletePost, isAuthenticated)}
      />
    ),
    [
      likedPosts,
      isAuthenticated,
      toggleLike,
      toggleBookmark,
      deletePost,
      me,
      router,
    ],
  );

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader variant="screen" title="المفضلة" showBack />
      <ScreenBody scroll={false} gutter={false}>
        {loading && favorites.length === 0 ? (
          <ActivityIndicator size="large" color={colors.electricBright} style={styles.loader} />
        ) : (
          <AppFlatList
            data={favorites}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={favorites.length === 0 ? styles.emptyList : styles.list}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void load({ refresh: true })}
                tintColor={colors.electricBright}
              />
            }
            ListEmptyComponent={
              <Stack gap="sm" align="center" fill style={styles.empty}>
                <AppText variant="display">🔖</AppText>
                <AppText variant="heading3">لا توجد عناصر مفضلة</AppText>
                <AppText variant="body" color="textMuted" align="center">
                  احفظ المنشورات من مجلس سرح لتظهر هنا
                </AppText>
                <SarhButton
                  title="تصفح مجلس سرح"
                  onPress={() => safePush('/(tabs)/posts', undefined, router)}
                />
              </Stack>
            }
          />
        )}
      </ScreenBody>
    </Screen>
  );
}

function createStyles(_colors: ThemeColors) {
  return StyleSheet.create({
    loader: {
      marginTop: 60,
    },
    list: {
      paddingBottom: 32,
    },
    emptyList: {
      flexGrow: 1,
      paddingBottom: 32,
    },
    empty: {
      justifyContent: 'center',
      paddingHorizontal: 24,
      paddingTop: 80,
    },
  });
}
