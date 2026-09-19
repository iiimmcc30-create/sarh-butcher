// SAFAT — Butchers delivery location picker (خريطة ذكية لموقع التوصيل)
import { LocationMapPreview } from '@/components/feature/LocationMapPreview';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { AppText, SarhButton, SarhChip, SarhInput } from '@/design-system/components';
import { Row, Screen, ScreenBody, Stack } from '@/design-system/layout';
import { spacing, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { reverseGeocodeToAddress } from '@/lib/formatAddress';
import {
  loadDeliveryLocation,
  saveDeliveryLocation,
} from '@/services/butcherDeliveryLocation';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  StyleSheet,
  View,
} from 'react-native';

const LABEL_OPTIONS = ['المنزل', 'العمل', 'آخر'];

export default function ButcherLocationScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [cityAr, setCityAr] = useState('');
  const [address, setAddress] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [label, setLabel] = useState('المنزل');
  const [locating, setLocating] = useState(false);
  const [initializing, setInitializing] = useState(true);

  const applyReverseGeocode = async (lat: number, lng: number) => {
    const resolved = await reverseGeocodeToAddress(lat, lng);
    if (resolved) {
      setCityAr(resolved.cityAr);
      setAddress((prev) => prev || resolved.addressAr);
    }
  };

  const locate = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('إذن الموقع', 'يرجى السماح بالوصول للموقع لتحديد مكان التوصيل.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setCoords(next);
      await applyReverseGeocode(next.lat, next.lng);
    } catch {
      Alert.alert('خطأ', 'تعذّر الحصول على موقعك، حاول مجدداً.');
    } finally {
      setLocating(false);
    }
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      const saved = await loadDeliveryLocation();
      if (!active) return;
      if (saved) {
        setLabel(saved.label || 'المنزل');
        setHouseNumber(saved.houseNumber || '');
        setAddress(saved.address || '');
        setCityAr(saved.cityAr || '');
        if (saved.lat != null && saved.lng != null) {
          setCoords({ lat: saved.lat, lng: saved.lng });
        }
        setInitializing(false);
        return;
      }
      setInitializing(false);
      void locate();
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSave = async () => {
    await saveDeliveryLocation({
      label: label.trim() || undefined,
      houseNumber: houseNumber.trim() || undefined,
      address: address.trim() || undefined,
      cityAr: cityAr.trim() || undefined,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
    });
    router.back();
  };

  const canSave = Boolean(address.trim() || cityAr.trim() || coords);

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader variant="screen" title="موقع التوصيل" showBack />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
      >
        <ScreenBody gap="lg" padTop="lg" padBottom="xxl">
          <AppText variant="body">
            اضغط على الخريطة لتحديد موقعك، أو استخدم «موقعي الحالي».
          </AppText>

          <LocationMapPreview
            country="SA"
            cityLabel={cityAr}
            lat={coords?.lat ?? null}
            lng={coords?.lng ?? null}
            height={220}
            showLocateButton
            onLocate={() => void locate()}
            locating={locating}
            onPick={(lat, lng) => {
              setCoords({ lat, lng });
              void applyReverseGeocode(lat, lng);
            }}
          />

          {initializing ? (
            <ActivityIndicator color={colors.electricBright} style={{ marginTop: spacing.lg }} />
          ) : null}

          <Stack gap="sm">
            <AppText variant="bodyMedium">نوع العنوان</AppText>
            <Row wrap gap="sm">
              {LABEL_OPTIONS.map((opt) => (
                <SarhChip
                  appearance="filter"
                  key={opt}
                  label={opt}
                  selected={label === opt}
                  onPress={() => setLabel(opt)}
                />
              ))}
            </Row>
          </Stack>

          <SarhInput
            appearance="theme"
            label="رقم المنزل / المبنى"
            value={houseNumber}
            onChangeText={setHouseNumber}
            placeholder="مثال: 5243"
            keyboardType="numbers-and-punctuation"
            ltr
          />

          <SarhInput
            appearance="theme"
            label="العنوان / الحي"
            value={address}
            onChangeText={setAddress}
            placeholder="اسم الحي أو وصف مختصر للعنوان"
            multiline
          />
        </ScreenBody>

        <View style={styles.footer}>
          <SarhButton
            title="حفظ الموقع"
            fullWidth
            disabled={!canSave}
            leftIcon="checkmark"
            onPress={() => void onSave()}
            accessibilityLabel="حفظ الموقع"
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    footer: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderSoft,
      backgroundColor: colors.screenRoot,
    },
  });
}
