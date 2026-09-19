import { AppIcon } from '@/components/ui/FlaticonIcon';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { ButchersTabBar } from '@/components/butchers/ButchersTabBar';
import { CustomerOrderCard, CustomerOrderCardSkeleton } from '@/components/butchers/CustomerOrderCard';
import { AppText, SarhButton } from '@/design-system/components';
import { Screen, ScreenBody, Stack } from '@/design-system/layout';
import { space } from '@/design-system/tokens';
import { useFocusEffect, useRouter } from 'expo-router';
import { safePush } from '@/lib/safeNavigate';
import { useCallback, useState } from 'react';
import {
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import {
  ButcherOrderRecord,
  fetchMyButcherOrders,
  isActiveOrder,
} from '@/services/butcherOrders';
import { butcherChatRouteParams, isOrderChatEligible } from '@/services/butcherChat';

export default function MyOrdersScreen() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const [orders, setOrders] = useState<ButcherOrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) {
      setOrders([]);
      setLoading(false);
      return;
    }
    try {
      const data = await fetchMyButcherOrders(accessToken);
      setOrders(data);
    } catch {
      /* keep current orders */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const activeOrders = orders.filter(isActiveOrder);
  const pastOrders = orders.filter((o) => !isActiveOrder(o));

  const chatHandler = (order: ButcherOrderRecord) =>
    isOrderChatEligible(order.status)
      ? () =>
          safePush(
            butcherChatRouteParams({
              butcherId: order.butcherId,
              orderId: order.id,
              receiverName: order.butcher?.nameAr,
              receiverAvatar: order.butcher?.logo,
            }),
            undefined,
            router,
          )
      : undefined;

  const openOrder = (order: ButcherOrderRecord) =>
    safePush({ pathname: '/butchers/order/[id]', params: { id: order.id } }, undefined, router);

  return (
    <Screen edges={['top']}>
      <ScreenHeader variant="screen" title="طلباتي" />

      {loading && orders.length === 0 ? (
        <ScreenBody gutter={false} padBottom="lg" contentContainerStyle={styles.scroll}>
          {[0, 1, 2].map((i) => (
            <CustomerOrderCardSkeleton key={i} colors={colors} />
          ))}
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
          {orders.length === 0 ? (
            <Stack gap="sm" align="center" style={styles.empty}>
              <View style={styles.emptyIconWrap}>
                <AppIcon name="bag-outline" size={34} color={colors.electricBright} />
              </View>
              <View style={{ width: '100%' }}>
                <AppText variant="heading3" align="center">
                  لا توجد طلبات بعد
                </AppText>
              </View>
              <View style={{ width: '100%' }}>
                <AppText variant="caption" color="textMuted" align="center" style={styles.emptySub}>
                  تصفّح الملاحم واطلب منتجاتك المفضلة
                </AppText>
              </View>
              <SarhButton
                title="تصفح الملاحم"
                shape="pill"
                onPress={() => router.replace('/butchers')}
              />
            </Stack>
          ) : (
            <>
              {activeOrders.length > 0 ? (
                <View style={styles.section}>
                  <View style={{ width: '100%' }}>
                    <AppText variant="heading3">الطلبات الحالية</AppText>
                  </View>
                  {activeOrders.map((order) => (
                    <CustomerOrderCard
                      key={order.id}
                      order={order}
                      colors={colors}
                      onPress={() => openOrder(order)}
                      onChat={chatHandler(order)}
                      onReorder={
                        order.butcherId
                          ? () =>
                              safePush(
                                { pathname: '/butchers/[id]', params: { id: order.butcherId } },
                                undefined,
                                router,
                              )
                          : undefined
                      }
                    />
                  ))}
                </View>
              ) : null}

              {pastOrders.length > 0 ? (
                <View style={styles.section}>
                  <View style={{ width: '100%' }}>
                    <AppText variant="heading3">الطلبات السابقة</AppText>
                  </View>
                  {pastOrders.map((order) => (
                    <CustomerOrderCard
                      key={order.id}
                      order={order}
                      colors={colors}
                      onPress={() => openOrder(order)}
                      onChat={chatHandler(order)}
                      onReorder={
                        order.butcherId
                          ? () =>
                              safePush(
                                { pathname: '/butchers/[id]', params: { id: order.butcherId } },
                                undefined,
                                router,
                              )
                          : undefined
                      }
                    />
                  ))}
                </View>
              ) : null}
            </>
          )}
          <View style={{ height: space[12] }} />
        </ScreenBody>
      )}

      <ButchersTabBar active="orders" />
    </Screen>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    scroll: { padding: space[16], paddingBottom: space[16], gap: space[16] },
    section: { gap: space[12] },
    empty: {
      paddingVertical: 80,
    },
    emptyIconWrap: {
      width: 76,
      height: 76,
      borderRadius: 38,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.electric + '14',
      marginBottom: space[4],
    },
    emptySub: {
      paddingHorizontal: space[20],
    },
  });
}
