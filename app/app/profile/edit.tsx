// Powered by OnSpace.AI
// SAFAT — Edit Profile Screen (تعديل الملف الشخصي)
import { AppIcon } from '@/components/ui/FlaticonIcon';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Image } from '@/components/ui/AppImage';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { radius, spacing, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { useAppUser } from '@/hooks/useApp';
import { Country } from '@/services/types';
import { showToast } from '@/lib/toast';
import { AppText, SarhButton, SarhInput } from '@/design-system/components';
import { BottomAction, Row, Screen, ScreenBody, Stack } from '@/design-system/layout';

const GCC_COUNTRIES: { code: Country; ar: string; flag: string }[] = [
  { code: 'SA', ar: 'السعودية', flag: '🇸🇦' },
];

export default function EditProfileScreen() {
  const { colors, gradients } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const router = useRouter();
  const { me, updateMe } = useAppUser();

  const [arabicName, setArabicName] = useState(me.arabicName || me.displayName);
  const [username, setUsername] = useState(me.username);
  const [bio, setBio] = useState(me.bio);
  const [country, setCountry] = useState<Country>(me.country);
  const [saving, setSaving] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [coverUri, setCoverUri] = useState<string | null>(null);

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('إذن مطلوب', 'يرجى السماح للتطبيق بالوصول إلى مكتبة الصور');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const handlePickCover = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('إذن مطلوب', 'يرجى السماح للتطبيق بالوصول إلى مكتبة الصور');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setCoverUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!arabicName.trim() || !username.trim()) {
      void showToast('يرجى ملء جميع الحقول المطلوبة', 'warning');
      return;
    }
    setSaving(true);
    const name = arabicName.trim();
    const updates: any = { displayName: name, arabicName: name, username, bio, country };
    if (avatarUri) updates.avatar = avatarUri;
    if (coverUri) updates.coverImage = coverUri;
    const result = await updateMe(updates);
    setSaving(false);
    if (result.ok) {
      if (result.error) {
        void showToast(result.error, 'warning');
      } else {
        void showToast('تم حفظ التغييرات بنجاح', 'success');
      }
      router.back();
    } else {
      void showToast(result.error || 'فشل حفظ التغييرات، يرجى المحاولة مجدداً.', 'error');
    }
  };

  return (
    <Screen edges={['top']} keyboard>
      <ScreenHeader variant="screen" title="تعديل الملف الشخصي" showBack />
      <ScreenBody padTop="lg" gap="section" width="form" bottomInset="action" padBottom="xl">
        <Stack gap="sm">
          <View style={styles.coverWrap}>
            {coverUri || me.coverImage ? (
              <Image
                source={{ uri: coverUri ?? me.coverImage }}
                style={styles.coverImage}
                contentFit="cover"
              />
            ) : (
              <LinearGradient
                colors={gradients.royal}
                style={styles.coverImage}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
            )}
            <Pressable
              style={styles.coverCameraBtn}
              onPress={handlePickCover}
              accessibilityRole="button"
              accessibilityLabel="تغيير صورة الغلاف"
            >
              <AppIcon name="camera-outline" size={16} color="#fff" />
            </Pressable>
          </View>
          <AppText variant="meta" color="textMuted" align="center">
            {coverUri ? '✓ تم اختيار صورة الغلاف' : 'اضغط لتغيير صورة الغلاف'}
          </AppText>
        </Stack>

        <Stack gap="sm" align="center">
          <View style={styles.avatarWrap}>
            <Image source={{ uri: avatarUri ?? me.avatar }} style={styles.avatar} contentFit="cover" />
            <Pressable
              style={styles.avatarCameraBtn}
              onPress={handlePickAvatar}
              accessibilityRole="button"
              accessibilityLabel="تغيير الصورة الشخصية"
            >
              <AppIcon name="camera" size={16} color="#fff" />
            </Pressable>
          </View>
          <AppText variant="meta" color="textMuted">
            {avatarUri ? '✓ تم اختيار الصورة' : 'اضغط لتغيير الصورة'}
          </AppText>
        </Stack>

        <Stack gap="lg">
          <SarhInput
            appearance="theme"
            label="الاسم *"
            value={arabicName}
            onChangeText={setArabicName}
            placeholder="اسمك الكامل"
          />

          <Stack gap="xs">
            <SarhInput
              appearance="theme"
              label="اسم المستخدم *"
              value={username}
              onChangeText={(t) => setUsername(t.replace(/\s/g, '').toLowerCase())}
              placeholder="اسم_المستخدم"
              autoCapitalize="none"
              autoCorrect={false}
              leadingIcon={
                <AppText variant="body" color="textMuted">
                  @
                </AppText>
              }
              ltr
            />
            <AppText variant="meta" color="textMuted">
              sarhsa.online/@{username}
            </AppText>
          </Stack>

          <Stack gap="xs">
            <SarhInput
              appearance="theme"
              label="السيرة الذاتية"
              value={bio}
              onChangeText={setBio}
              placeholder="أخبرنا عن نفسك..."
              multiline
              numberOfLines={3}
              maxLength={160}
              style={styles.bioInput}
            />
            <AppText variant="meta" color="textMuted">
              {bio.length}/160
            </AppText>
          </Stack>

          <Stack gap="sm">
            <AppText variant="label" color="textSecondary">
              الدولة
            </AppText>
            <Row gap="sm" wrap>
              {GCC_COUNTRIES.map((c) => {
                const selected = country === c.code;
                return (
                  <Pressable
                    key={c.code}
                    onPress={() => setCountry(c.code)}
                    style={[styles.countryChip, selected ? styles.countryChipActive : null]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={c.ar}
                  >
                    <Row gap="xs" align="center">
                      <AppText variant="body">{c.flag}</AppText>
                      <AppText variant="caption" color={selected ? 'primary' : 'textMuted'}>
                        {c.ar}
                      </AppText>
                    </Row>
                  </Pressable>
                );
              })}
            </Row>
          </Stack>
        </Stack>
      </ScreenBody>

      <BottomAction width="form">
        <SarhButton
          title="حفظ"
          onPress={handleSave}
          loading={saving}
          fullWidth
          accessibilityLabel="حفظ التعديلات"
        />
      </BottomAction>
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    coverWrap: {
      width: '100%',
      height: 120,
      borderRadius: radius.lg,
      overflow: 'hidden',
      position: 'relative',
      backgroundColor: colors.bgSurface,
    },
    coverImage: { width: '100%', height: '100%' },
    /** Logical inset so the control keeps its corner in both directions. */
    coverCameraBtn: {
      position: 'absolute',
      bottom: spacing.sm,
      start: spacing.sm,
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.borderMid,
      zIndex: 2,
    },
    avatarWrap: { position: 'relative' },
    avatar: {
      width: 90,
      height: 90,
      borderRadius: 45,
      borderWidth: 3,
      borderColor: colors.electric,
    },
    /** Logical inset so the badge keeps its corner in both directions. */
    avatarCameraBtn: {
      position: 'absolute',
      bottom: 0,
      start: 0,
      width: 28,
      height: 28,
      borderRadius: 16,
      backgroundColor: colors.electric,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.bgDeep,
    },
    bioInput: {
      height: 80,
      textAlignVertical: 'top',
    },
    countryChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: 7,
      borderRadius: radius.pill,
      backgroundColor: colors.bgSurface,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
    countryChipActive: {
      borderColor: colors.electric,
      backgroundColor: `${colors.electric}20`,
    },
  });
}
