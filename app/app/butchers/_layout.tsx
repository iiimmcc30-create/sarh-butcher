// Powered by OnSpace.AI
// SAFAT — Butchers Section Layout

import { Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ButcherCartProvider } from '@/contexts/ButcherCartContext';
import { ButcherThemeScope } from '@/contexts/ButcherThemeScope';
import { useTheme } from '@/contexts/ThemeContext';
import { snapshotTheme } from '@/constants/theme';
import { getRtlDirection } from '@/lib/rtl';

const butcherPageBg = snapshotTheme('light').colors.bgDeep;

export default function ButchersLayout() {
  const parent = useTheme();
  const segments = useSegments() as readonly string[];
  const isChat = segments.includes('chat');
  const pageBg = isChat ? parent.colors.screenRoot : butcherPageBg;

  return (
    <ButcherThemeScope enabled={!isChat}>
    <StatusBar style={isChat && parent.isDark ? 'light' : 'dark'} />
    <ButcherCartProvider>
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: pageBg, ...getRtlDirection() },
        animation: 'slide_from_left',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="all" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="order" />
      <Stack.Screen name="cart" />
      <Stack.Screen name="order/[id]" />
      <Stack.Screen name="order-success" options={{ animation: 'fade' }} />
      <Stack.Screen name="chat" />
      <Stack.Screen name="register" />
      <Stack.Screen name="apply" />
      <Stack.Screen name="my-application" />
      <Stack.Screen name="application/[id]" />
      <Stack.Screen name="application/edit/[id]" />
      <Stack.Screen name="map" />
      <Stack.Screen name="my-orders" />
      <Stack.Screen name="offers" />
      <Stack.Screen name="more" />
      <Stack.Screen name="location" />
      <Stack.Screen name="favorites" />
      <Stack.Screen name="invoices" />
      <Stack.Screen name="invoice/[id]" />
      <Stack.Screen
        name="story-viewer"
        options={{ animation: 'fade', presentation: 'transparentModal' }}
      />
    </Stack>
    </ButcherCartProvider>
    </ButcherThemeScope>
  );
}
