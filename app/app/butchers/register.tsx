// Legacy route — redirects to governed butcher application flow.

import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { LoadingState } from '@/components/butcherApplication/LoadingState';
import { Screen, ScreenBody } from '@/design-system/layout';
import { useTheme } from '@/hooks/useTheme';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';

export default function ButcherRegisterRedirectScreen() {
  const { gradients } = useTheme();
  const router = useRouter();

  useEffect(() => {
    router.replace('/butchers/apply');
  }, [router]);

  return (
    <Screen edges={['top']} pattern={false}>
      <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
      <ScreenBody scroll={false}>
        <LoadingState message="جاري التحويل إلى بوابة التسجيل..." />
      </ScreenBody>
    </Screen>
  );
}
