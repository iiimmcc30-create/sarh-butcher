import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'sarh:butchers:deliveryLocation';

/** Customer delivery location for the butchers market (UI-only, stored locally). */
export type DeliveryLocation = {
  /** Short label e.g. "المنزل" / "العمل". */
  label?: string;
  /** House / building number or free description. */
  houseNumber?: string;
  /** Resolved street/address line. */
  address?: string;
  /** Resolved city (Arabic when available). */
  cityAr?: string;
  lat?: number | null;
  lng?: number | null;
  updatedAt?: string;
};

export async function loadDeliveryLocation(): Promise<DeliveryLocation | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DeliveryLocation;
  } catch {
    return null;
  }
}

export async function saveDeliveryLocation(
  location: DeliveryLocation,
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...location, updatedAt: new Date().toISOString() }),
    );
  } catch {
    // Non-fatal: delivery hint is a convenience only.
  }
}

/** One-line summary for the home location bar. */
export function deliveryLocationSummary(location: DeliveryLocation | null): string {
  if (!location) return '';
  const parts = [location.houseNumber, location.address || location.cityAr]
    .map((p) => p?.trim())
    .filter(Boolean);
  return parts.join('، ');
}

/** Full address line stored on the butcher order (max 300 on API). */
export function formatDeliveryAddressLine(location: DeliveryLocation | null): string {
  if (!location) return '';
  const parts = [location.label, location.houseNumber, location.address, location.cityAr]
    .map((p) => p?.trim())
    .filter(Boolean);
  return parts.join('، ').slice(0, 300);
}
