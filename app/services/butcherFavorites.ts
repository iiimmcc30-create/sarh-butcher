import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '@/services/api';
import { ButcherProfile, mapButcherFromApi } from '@/services/butcherData';

const storageKey = (userId: string) => `@sarh/butcher-favorites/${userId}`;

export async function getFavoriteButcherIds(userId: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

async function saveFavoriteIds(userId: string, ids: string[]) {
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(ids));
}

export async function addFavoriteLocal(userId: string, butcherId: string) {
  const ids = await getFavoriteButcherIds(userId);
  if (!ids.includes(butcherId)) {
    await saveFavoriteIds(userId, [butcherId, ...ids]);
  }
}

export async function removeFavoriteLocal(userId: string, butcherId: string) {
  const ids = (await getFavoriteButcherIds(userId)).filter((id) => id !== butcherId);
  await saveFavoriteIds(userId, ids);
}

export async function fetchButcherFavoriteStatus(
  accessToken: string,
  butcherId: string,
): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/butchers/${butcherId}/favorite`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json().catch(() => ({}));
  return Boolean(res.ok && json.data?.favorited);
}

export async function toggleButcherFavorite(
  accessToken: string,
  userId: string,
  butcherId: string,
  currentlyFavorited: boolean,
): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/butchers/${butcherId}/favorite`, {
    method: currentlyFavorited ? 'DELETE' : 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.messageAr || json.message || 'تعذر تحديث المفضلة');
  }

  if (currentlyFavorited) {
    await removeFavoriteLocal(userId, butcherId);
    return false;
  }
  await addFavoriteLocal(userId, butcherId);
  return true;
}

export async function fetchFavoriteButchers(
  accessToken: string,
  userId: string,
): Promise<ButcherProfile[]> {
  const ids = await getFavoriteButcherIds(userId);
  if (!ids.length) return [];

  const results = await Promise.all(
    ids.map(async (id) => {
      try {
        const [butcherRes, favRes] = await Promise.all([
          fetch(`${API_BASE}/api/butchers/${id}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
          fetch(`${API_BASE}/api/butchers/${id}/favorite`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
        ]);
        const butcherJson = await butcherRes.json().catch(() => ({}));
        const favJson = await favRes.json().catch(() => ({}));
        if (!butcherRes.ok || !butcherJson.data) return null;
        if (!favJson.data?.favorited) {
          await removeFavoriteLocal(userId, id);
          return null;
        }
        return mapButcherFromApi(butcherJson.data as Record<string, unknown>);
      } catch {
        return null;
      }
    }),
  );

  return results.filter((b): b is ButcherProfile => Boolean(b));
}
