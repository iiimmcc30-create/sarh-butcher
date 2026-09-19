import type { ButcherProfile } from '@/services/butcherData';

export interface NativeButchersMapProps {
  region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  butchers: ButcherProfile[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function NativeButchersMap(props: NativeButchersMapProps): React.ReactNode;
