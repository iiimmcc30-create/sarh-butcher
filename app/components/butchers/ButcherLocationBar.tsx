import { AppIcon } from '@/components/ui/FlaticonIcon';
import { butcherTypography } from '@/constants/butcherTypography';
import { butcherMarket } from '@/constants/butcherMarket';
import { spacing, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { getRtlRow } from '@/lib/rtl';
import { safePush } from '@/lib/safeNavigate';
import {
  deliveryLocationSummary,
  loadDeliveryLocation,
  type DeliveryLocation,
} from '@/services/butcherDeliveryLocation';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { motion } from '@/design-system';
import { AppText } from '@/design-system/components';

type Props = {
  compact?: boolean;
};

export function ButcherLocationBar({ compact = false }: Props) {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const [location, setLocation] = useState<DeliveryLocation | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void loadDeliveryLocation().then((loc) => {
        if (active) setLocation(loc);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const summary = deliveryLocationSummary(location);
  const hasLocation = Boolean(summary);
  const label = location?.label?.trim() || (hasLocation ? 'التوصيل إلى' : 'حدّد موقعك');

  return (
    <Pressable
      style={({ pressed }) => [styles.bar, compact && styles.compact, pressed && styles.pressed]}
      onPress={() => safePush('/butchers/location', undefined, router)}
      accessibilityRole="button"
      accessibilityLabel="تحديد موقع التوصيل"
    >
      <View style={[styles.cluster, getRtlRow()]}>
        <View style={styles.pin}>
          <AppIcon name="location" size={16} color={butcherMarket.pin} />
        </View>
        <View style={styles.copy}>
          <AppText variant="label" numberOfLines={1}>
            {label}
          </AppText>
          <View style={[styles.addressRow, getRtlRow()]}>
            <AppIcon name="chevron-down" size={14} color={colors.textMuted} />
            <AppText variant="caption" color="textMuted" numberOfLines={1} style={styles.address}>
              {hasLocation ? summary : 'اضغط لاختيار موقع التوصيل'}
            </AppText>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    bar: {
      flex: 1,
      minWidth: 0,
      backgroundColor: 'transparent',
    },
    compact: {
      paddingVertical: 0,
    },
    pressed: { opacity: motion.press.opacity },
    cluster: {
      alignItems: 'center',
      gap: spacing.sm,
    },
    pin: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bgField,
    },
    copy: {
      flex: 1,
      minWidth: 0,
    },
    addressRow: {
      alignItems: 'center',
      gap: 4,
    },
    address: {
      flexShrink: 1,
    },
  });
}

export default ButcherLocationBar;
