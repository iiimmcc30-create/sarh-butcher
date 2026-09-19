import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { AppIcon } from '@/components/ui/FlaticonIcon';
import { Image, uriSource } from '@/components/ui/AppImage';
import { AppText, SarhButton } from '@/design-system/components';
import { Row, Screen, ScreenBody, Stack } from '@/design-system/layout';
import { space } from '@/design-system/tokens';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { radius, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { cloudinaryFitUrl } from '@/lib/listingMedia';
import { safePush } from '@/lib/safeNavigate';
import { useAuth } from '@/contexts/AuthContext';
import { ButcherProfile } from '@/services/butcherData';
import {
  fetchFavoriteButchers,
  removeFavoriteLocal,
  toggleButcherFavorite,
} from '@/services/butcherFavorites';

const COVER_FALLBACK =
  'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=800&q=80';

export default function ButcherFavoritesScreen() {
  const router = useRouter();
  const { accessToken, user } = useAuth();
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const [favorites, setFavorites] = useState<ButcherProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const userId = user?.id ?? '';

  const load = useCallback(async () => {
    if (!accessToken || !userId) {
      setFavorites([]);
      setLoading(false);
      return;
    }
    try {
      const data = await fetchFavoriteButchers(accessToken, userId);
      setFavorites(data);
    } catch {
      /* keep current favorites */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken, userId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleRemove = async (butcher: ButcherProfile) => {
    if (!accessToken || !userId) return;
    try {
      await toggleButcherFavorite(accessToken, userId, butcher.id, true);
    } catch {
      await removeFavoriteLocal(userId, butcher.id);
    }
    setFavorites((prev) => prev.filter((b) => b.id !== butcher.id));
  };

  return (
    <Screen edges={['top']}>
      <ScreenHeader variant="screen" title="تفضيلاتي" showBack />

      {loading && favorites.length === 0 ? (
        <ScreenBody scroll={false} gutter={false}>
          <ActivityIndicator size="large" color={colors.electricBright} style={styles.loader} />
        </ScreenBody>
      ) : (
        <ScreenBody
          gutter={false}
          padBottom="lg"
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
              tintColor={colors.electricBright}
            />
          }
        >
          {favorites.length === 0 ? (
            <Stack gap="sm" align="center" style={styles.empty}>
              <AppText variant="display">❤️</AppText>
              <AppText variant="heading3">لا توجد ملاحم مفضلة</AppText>
              <AppText variant="caption" color="textMuted" align="center" style={styles.emptySub}>
                أضف ملاحمك المفضلة من قائمة الملاحم
              </AppText>
              <SarhButton
                title="تصفح الملاحم"
                shape="pill"
                onPress={() => safePush('/butchers', undefined, router)}
              />
            </Stack>
          ) : (
            favorites.map((butcher) => {
              const isOpen = butcher.workingHours.isOpen;
              return (
                <Row key={butcher.id} gap="none" align="stretch" style={styles.card}>
                  <View style={styles.thumbWrap}>
                    <Image
                      source={uriSource(
                        cloudinaryFitUrl(butcher.cover || butcher.logo, 'card') ?? COVER_FALLBACK,
                      )}
                      style={styles.thumb}
                      contentFit="cover"
                    />
                  </View>
                  <View style={styles.cardBody}>
                    <AppText variant="label" numberOfLines={1}>
                      {butcher.nameAr}
                    </AppText>
                    <Row gap="xs" align="center">
                      <AppIcon name="star" size={14} color={colors.gold} />
                      <AppText variant="label" style={{ color: colors.gold }}>
                        {butcher.rating.toFixed(1)}
                      </AppText>
                      <AppText variant="caption" color="textMuted">
                        ({butcher.reviewCount})
                      </AppText>
                    </Row>
                    <View
                      style={[
                        styles.openBadge,
                        { backgroundColor: isOpen ? colors.success + '22' : colors.danger + '22' },
                      ]}
                    >
                      <AppText
                        variant="label"
                        style={{ color: isOpen ? colors.success : colors.danger }}
                      >
                        {isOpen ? 'مفتوح الآن' : 'مغلق حالياً'}
                      </AppText>
                    </View>
                    <Row gap="sm" align="center" style={styles.actions}>
                      <Pressable
                        style={styles.visitBtn}
                        onPress={() =>
                          safePush({ pathname: '/butchers/[id]', params: { id: butcher.id } }, undefined, router)
                        }
                      >
                        <AppText variant="label" style={{ color: colors.electricBright }}>
                          زيارة الملحمة
                        </AppText>
                      </Pressable>
                      <Pressable style={styles.removeBtn} onPress={() => void handleRemove(butcher)}>
                        <AppIcon name="heart" size={18} color={colors.rose} />
                      </Pressable>
                    </Row>
                  </View>
                </Row>
              );
            })
          )}
        </ScreenBody>
      )}
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    loader: { marginTop: 60 },
    scroll: { padding: space[16], paddingBottom: space[40], gap: space[12] },
    card: {
      backgroundColor: colors.bgSurface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      overflow: 'hidden',
      minHeight: 120,
    },
    thumbWrap: {
      width: 120,
      flexShrink: 0,
      alignSelf: 'stretch',
      backgroundColor: colors.bgElevated,
      overflow: 'hidden',
    },
    thumb: {
      ...StyleSheet.absoluteFillObject,
    },
    cardBody: {
      flex: 1,
      padding: space[12],
      gap: 6,
      justifyContent: 'center',
    },
    openBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: space[8],
      paddingVertical: 3,
      borderRadius: radius.pill,
    },
    actions: { marginTop: space[8] },
    visitBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: radius.lg,
      backgroundColor: colors.electric + '18',
      borderWidth: 1,
      borderColor: colors.electric + '44',
      alignItems: 'center',
    },
    removeBtn: {
      width: 40,
      height: 40,
      borderRadius: radius.md,
      backgroundColor: colors.bgElevated,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
    empty: {
      paddingVertical: 80,
    },
    emptySub: {
      paddingHorizontal: space[20],
    },
  });
}
