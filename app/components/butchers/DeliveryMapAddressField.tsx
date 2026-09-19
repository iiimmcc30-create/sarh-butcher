// SAFAT — Delivery address via map picker (not free-text)
import { AppIcon } from '@/components/ui/FlaticonIcon';
import { butcherTypography } from '@/constants/butcherTypography';
import { spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import {
  formatDeliveryAddressLine,
  loadDeliveryLocation,
  type DeliveryLocation,
} from '@/services/butcherDeliveryLocation';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { rtlForwardIcon } from '@/lib/rtl';
import { motion } from '@/design-system';
import { CoverTrailRow } from '@/components/ui/CoverTrailRow';
import { AppText } from '@/components/ui/AppText';

type Props = {
  onAddressChange?: (addressLine: string) => void;
};

export function DeliveryMapAddressField({ onAddressChange }: Props) {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const [location, setLocation] = useState<DeliveryLocation | null>(null);

  const onAddressChangeRef = useRef(onAddressChange);
  onAddressChangeRef.current = onAddressChange;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void loadDeliveryLocation().then((loc) => {
        if (!active) return;
        setLocation(loc);
        onAddressChangeRef.current?.(formatDeliveryAddressLine(loc));
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const summary = formatDeliveryAddressLine(location);
  const hasLocation = Boolean(summary);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => router.push('/butchers/location')}
      accessibilityRole="button"
      accessibilityLabel="اختيار عنوان التوصيل على الخريطة"
    >
      <CoverTrailRow justify="flex-end" gap={10} style={styles.coverTrail}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText style={styles.title}>عنوان التوصيل</AppText>
          <AppText style={styles.value} numberOfLines={2}>
            {hasLocation ? summary : 'اضغط لتحديد الموقع على الخريطة'}
          </AppText>
        </View>
        <View style={styles.iconWrap}>
          <AppIcon name="location" size={20} color={colors.electricBright} />
        </View>
      </CoverTrailRow>
      <View style={styles.ctaRow}>
        <AppIcon name={rtlForwardIcon()} size={14} color={colors.textMuted} />
        <Text style={styles.cta}>
          {hasLocation ? 'تعديل الموقع على الخريطة' : 'فتح الخريطة'}
        </Text>
      </View>
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.bgField,
      borderRadius: 14,
      paddingHorizontal: spacing.lg,
      paddingVertical: 14,
      gap: spacing.sm,
    },
    pressed: { opacity: motion.press.opacityCard },
    coverTrail: {
      width: '100%',
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bgDeep,
      flexShrink: 0,
    },
    title: {
      ...butcherTypography.secondary,
      color: colors.textMuted,
    },
    value: {
      ...typography.body,
      color: colors.textPrimary,
      marginTop: 2,
    },
    ctaRow: {
      flexDirection: 'row',
            alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 4,
    },
    cta: {
      ...butcherTypography.emphasis,
      color: colors.electricBright,
      writingDirection: 'rtl',
    },
  });
}

export default DeliveryMapAddressField;
