import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PENDING_CART_INTENT_KEY,
  cartIntentResumeHref,
  parsePendingCartIntent,
  serializePendingCartIntent,
  type PendingCartIntent,
} from '@/lib/requireCustomerForCart';

export async function savePendingCartIntent(intent: PendingCartIntent): Promise<void> {
  await AsyncStorage.setItem(PENDING_CART_INTENT_KEY, serializePendingCartIntent(intent));
}

export async function peekPendingCartIntent(): Promise<PendingCartIntent | null> {
  const raw = await AsyncStorage.getItem(PENDING_CART_INTENT_KEY);
  return parsePendingCartIntent(raw);
}

export async function peekPendingCartResumeHref(): Promise<string> {
  const intent = await peekPendingCartIntent();
  return cartIntentResumeHref(intent);
}

export async function consumePendingCartIntent(): Promise<PendingCartIntent | null> {
  const intent = await peekPendingCartIntent();
  if (intent) {
    await AsyncStorage.removeItem(PENDING_CART_INTENT_KEY);
  }
  return intent;
}
