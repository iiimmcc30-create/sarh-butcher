import { ListingCard } from '@/components/feature/ListingCard';
import { space } from '@/design-system';
import { AppText } from '@/design-system/components';
import { Row } from '@/design-system/layout';
import { useAuth } from '@/contexts/AuthContext';
import { useLayout } from '@/hooks/useLayout';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { HOME_LATEST_LISTINGS_LIMIT } from '@/lib/homeQuickAccess';
import { safePush } from '@/lib/safeNavigate';
import { getBootstrappedListingsPage, searchListingsPage } from '@/services/listings';
import type { Listing } from '@/services/types';
import { useFocusEffect, useRouter } from 'expo-router';
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

const HOME_LISTINGS_TTL_MS = 60_000;

export type HomeLatestListingsHandle = {
  refresh: () => Promise<void>;
};

export const HomeLatestListings = forwardRef<HomeLatestListingsHandle>(function HomeLatestListings(
  _props,
  ref,
) {
  const router = useRouter();
  const { gutter } = useLayout();
  const { accessToken } = useAuth();
  const styles = useThemedStyles(() => createStyles());
  const [items, setItems] = useState<Listing[]>([]);
  const inflightRef = useRef(false);
  const lastAt = useRef(0);
  const needsFailureRecoveryRef = useRef(false);
  const itemsLenRef = useRef(0);
  itemsLenRef.current = items.length;
  if (items.length > 0) needsFailureRecoveryRef.current = false;

  const load = useCallback(
    async (force = false) => {
      const now = Date.now();
      if (
        !force &&
        itemsLenRef.current > 0 &&
        now - lastAt.current < HOME_LISTINGS_TTL_MS &&
        lastAt.current > 0
      ) {
        return;
      }
      if (inflightRef.current) return;
      inflightRef.current = true;
      try {
        if (!force) {
          const boot = getBootstrappedListingsPage(accessToken);
          if (boot?.listings.length) {
            setItems(boot.listings.slice(0, HOME_LATEST_LISTINGS_LIMIT));
            lastAt.current = Date.now();
            inflightRef.current = false;
            return;
          }
        }
        const page = await searchListingsPage({}, accessToken);
        setItems(page.listings.slice(0, HOME_LATEST_LISTINGS_LIMIT));
        lastAt.current = Date.now();
        if (page.listings.length === 0) needsFailureRecoveryRef.current = false;
      } catch {
        if (itemsLenRef.current === 0) needsFailureRecoveryRef.current = true;
      } finally {
        inflightRef.current = false;
      }
    },
    [accessToken],
  );

  useImperativeHandle(ref, () => ({
    refresh: () => load(true),
  }));

  useFocusEffect(
    useCallback(() => {
      const shouldForce = itemsLenRef.current === 0 && needsFailureRecoveryRef.current;
      void load(shouldForce);
    }, [load]),
  );

  if (items.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Row
        align="center"
        justify="between"
        style={[styles.sectionHead, { paddingHorizontal: gutter }]}
      >
        <AppText variant="heading2" color="textPrimary" style={styles.sectionTitle} numberOfLines={1}>
          أحدث الإعلانات
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="عرض كل الإعلانات"
          onPress={() => safePush('/(tabs)/market', undefined, router)}
          hitSlop={8}
          style={styles.seeAllBtn}
        >
          <AppText variant="caption" color="primary" numberOfLines={1}>
            عرض الكل
          </AppText>
        </Pressable>
      </Row>
      {items.map((item) => (
        <ListingCard
          key={item.id}
          listing={item}
          variant="list"
          listMode="market"
          onPress={() =>
            safePush({ pathname: '/listing/[id]', params: { id: item.id } }, undefined, router)
          }
        />
      ))}
    </View>
  );
});

function createStyles() {
  return StyleSheet.create({
    wrap: {
      paddingBottom: space[8],
      gap: space[4],
    },
    sectionHead: {
      paddingTop: space[8],
      paddingBottom: space[8],
    },
    sectionTitle: {
      flex: 1,
      minWidth: 0,
    },
    seeAllBtn: {
      flexShrink: 0,
      paddingStart: space[8],
    },
  });
}

export default HomeLatestListings;
