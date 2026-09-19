import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { ButcherProduct, CutType, DeliveryType } from '@/services/butcherData';
import {
  cartItemsCount,
  cartSubtotal,
  createCartLineItem,
  emptyCartSnapshot,
  type ButcherCartLineItem,
} from '@/services/butcherCart';
import {
  computeProductLineTotal,
  resolveLineWeightKg,
} from '@/lib/butcherOrderPricing';

type ButcherCartContextValue = {
  butcherId: string | null;
  butcherNameAr: string;
  butcherLogo?: string;
  deliveryType: DeliveryType;
  deliveryAddress: string;
  notes: string;
  items: ButcherCartLineItem[];
  itemCount: number;
  subtotal: number;
  setButcherMeta: (meta: {
    butcherId: string;
    butcherNameAr: string;
    butcherLogo?: string;
  }) => void;
  setDeliveryType: (type: DeliveryType) => void;
  setDeliveryAddress: (address: string) => void;
  setNotes: (notes: string) => void;
  addLine: (input: {
    product: ButcherProduct;
    cutType: CutType;
    weightRaw: string;
  }) => boolean;
  updateLineWeight: (lineId: string, weightRaw: string) => void;
  removeLine: (lineId: string) => void;
  clearCart: () => void;
};

const ButcherCartContext = createContext<ButcherCartContextValue | null>(null);

export function ButcherCartProvider({ children }: { children: ReactNode }) {
  const [butcherId, setButcherId] = useState<string | null>(null);
  const [butcherNameAr, setButcherNameAr] = useState('');
  const [butcherLogo, setButcherLogo] = useState<string | undefined>();
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('pickup');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ButcherCartLineItem[]>([]);

  const setButcherMeta = useCallback(
    (meta: { butcherId: string; butcherNameAr: string; butcherLogo?: string }) => {
      setButcherId((prev) => {
        if (prev && prev !== meta.butcherId) {
          setItems([]);
          setDeliveryType('pickup');
          setDeliveryAddress('');
          setNotes('');
        }
        return meta.butcherId;
      });
      setButcherNameAr(meta.butcherNameAr);
      setButcherLogo(meta.butcherLogo);
    },
    [],
  );

  const addLine = useCallback(
    (input: { product: ButcherProduct; cutType: CutType; weightRaw: string }) => {
      const line = createCartLineItem(input);
      if (!line) return false;
      setItems((prev) => [...prev, line]);
      return true;
    },
    [],
  );

  const updateLineWeight = useCallback((lineId: string, weightRaw: string) => {
    setItems((prev) =>
      prev.map((line) => {
        if (line.id !== lineId) return line;
        const weightKg = resolveLineWeightKg(weightRaw, line.product);
        const lineTotal = computeProductLineTotal(line.product, weightKg);
        return { ...line, weightKg, lineTotal };
      }),
    );
  }, []);

  const removeLine = useCallback((lineId: string) => {
    setItems((prev) => prev.filter((l) => l.id !== lineId));
  }, []);

  const clearCart = useCallback(() => {
    if (!butcherId) return;
    const empty = emptyCartSnapshot(butcherId);
    setDeliveryType(empty.deliveryType);
    setDeliveryAddress(empty.deliveryAddress);
    setNotes(empty.notes);
    setItems([]);
  }, [butcherId]);

  const value = useMemo<ButcherCartContextValue>(
    () => ({
      butcherId,
      butcherNameAr,
      butcherLogo,
      deliveryType,
      deliveryAddress,
      notes,
      items,
      itemCount: cartItemsCount(items),
      subtotal: cartSubtotal(items),
      setButcherMeta,
      setDeliveryType,
      setDeliveryAddress,
      setNotes,
      addLine,
      updateLineWeight,
      removeLine,
      clearCart,
    }),
    [
      butcherId,
      butcherNameAr,
      butcherLogo,
      deliveryType,
      deliveryAddress,
      notes,
      items,
      setButcherMeta,
      addLine,
      updateLineWeight,
      removeLine,
      clearCart,
    ],
  );

  return (
    <ButcherCartContext.Provider value={value}>{children}</ButcherCartContext.Provider>
  );
}

export function useButcherCart() {
  const ctx = useContext(ButcherCartContext);
  if (!ctx) {
    throw new Error('useButcherCart must be used within ButcherCartProvider');
  }
  return ctx;
}
