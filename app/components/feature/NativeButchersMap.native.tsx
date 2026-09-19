import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors, type ThemeColors } from '@/constants/theme';
import type { ButcherProfile } from '@/services/butcherData';
import { useThemedStyles } from '@/hooks/useThemedStyles';

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

export function NativeButchersMap({
  region,
  butchers,
  selectedId,
  onSelect,
}: NativeButchersMapProps) {
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const [MapModule, setMapModule] = useState<typeof import('react-native-maps') | null>(null);

  useEffect(() => {
    let active = true;
    import('react-native-maps')
      .then((mod) => {
        if (active) setMapModule(mod);
      })
      .catch(() => {
        if (active) setMapModule(null);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!MapModule) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.electricBright} />
      </View>
    );
  }

  const { default: MapView, Marker, PROVIDER_GOOGLE } = MapModule;

  return (
    <MapView
      style={StyleSheet.absoluteFill}
      provider={PROVIDER_GOOGLE}
      region={region}
      showsUserLocation
      showsMyLocationButton
    >
      {butchers.map((butcher) => (
        <Marker
          key={butcher.id}
          coordinate={{ latitude: butcher.lat, longitude: butcher.lng }}
          title={butcher.nameAr}
          description={butcher.cityAr}
          pinColor={butcher.subscriptionActive ? colors.gold : colors.electric}
          onPress={() => onSelect(selectedId === butcher.id ? null : butcher.id)}
        />
      ))}
    </MapView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgSurface,
  },
});
}
