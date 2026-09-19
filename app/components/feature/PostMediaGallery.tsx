// SAFAT — Post media gallery: single image, swipeable multi-image carousel,
// or video. Each image lazily fades in once loaded, with a shimmer skeleton
// shown while it downloads. Tap any image to open full-screen viewer.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  PixelRatio,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewStyle,
} from 'react-native';
import { ScrollView } from 'react-native';
import { Image, uriSource } from '@/components/ui/AppImage';
import { StoryVideoPlayer } from '@/components/feature/StoryVideoPlayer';
import { ImageViewerModal } from '@/components/ui/ImageViewerModal';
import { radius, typography, type ThemeColors } from '@/constants/theme';
import { postFeedImageUrl } from '@/lib/listingMedia';

const ASPECT_RATIO = 16 / 11;

const ABS_FILL: ViewStyle = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };

function postFeedDeliveryUri(uri: string): string {
  const screenW = Dimensions.get('window').width;
  const dpr = typeof PixelRatio.get === 'function' ? PixelRatio.get() : 2;
  return postFeedImageUrl(uri, screenW, dpr) ?? uri;
}

interface PostMediaGalleryProps {
  images: string[];
  video?: string | null;
  colors: ThemeColors;
  scheme: 'light' | 'dark';
}

function MediaSkeleton({ colors }: { colors: ThemeColors }) {
  const pulse = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.7, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.35, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.bgElevated, opacity: pulse }]}
    />
  );
}

function GalleryImage({
  uri,
  colors,
  onPress,
}: {
  uri: string;
  colors: ThemeColors;
  onPress?: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;

  const handleLoad = useCallback(() => {
    setLoaded(true);
    Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [opacity]);

  return (
    <Pressable style={StyleSheet.absoluteFill} onPress={onPress}>
      {!loaded && !failed ? <MediaSkeleton colors={colors} /> : null}
      {!failed ? (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity }]}>
          <Image
            source={uriSource(postFeedDeliveryUri(uri))}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            onLoad={handleLoad}
            onError={() => setFailed(true)}
          />
        </Animated.View>
      ) : null}
    </Pressable>
  );
}

export function PostMediaGallery({ images, video, colors, scheme }: PostMediaGalleryProps) {
  const [width, setWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const openViewer = useCallback((idx: number) => {
    setViewerIndex(idx);
    setViewerVisible(true);
  }, []);

  const onLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number } } }) => setWidth(e.nativeEvent.layout.width),
    [],
  );

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!width) return;
      const idx = Math.round(e.nativeEvent.contentOffset.x / width);
      setActiveIndex(idx);
    },
    [width],
  );

  const containerStyle = [
    styles.container,
    {
      borderColor: scheme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
    },
  ];

  if (video) {
    return (
      <View style={containerStyle} onLayout={onLayout}>
        <StoryVideoPlayer
          uri={video}
          posterUri={images[0] ? postFeedDeliveryUri(images[0]) : images[0]}
          style={ABS_FILL}
          autoPlay={false}
          muted={false}
          nativeControls
        />
      </View>
    );
  }

  if (images.length === 0) return null;

  if (images.length === 1) {
    return (
      <>
        <View style={containerStyle} onLayout={onLayout}>
          <GalleryImage uri={images[0]} colors={colors} onPress={() => openViewer(0)} />
        </View>
        <ImageViewerModal
          visible={viewerVisible}
          images={images}
          initialIndex={0}
          onClose={() => setViewerVisible(false)}
        />
      </>
    );
  }

  const pageWidth = width || Dimensions.get('window').width;

  return (
    <>
      <View style={containerStyle} onLayout={onLayout}>
        <ScrollView
          style={StyleSheet.absoluteFill}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          decelerationRate="fast"
        >
          {images.map((uri, idx) => (
            <View key={`${uri}-${idx}`} style={{ width: pageWidth }}>
              <GalleryImage uri={uri} colors={colors} onPress={() => openViewer(idx)} />
            </View>
          ))}
        </ScrollView>

        <View style={styles.countBadge} pointerEvents="none">
          <Text style={styles.countText}>
            {activeIndex + 1}/{images.length}
          </Text>
        </View>

        <View style={styles.dotsRow} pointerEvents="none">
          {images.map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.dot,
                idx === activeIndex && {
                  backgroundColor: '#fff',
                  width: 7,
                },
              ]}
            />
          ))}
        </View>
      </View>

      <ImageViewerModal
        visible={viewerVisible}
        images={images}
        initialIndex={viewerIndex}
        onClose={() => setViewerVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: ASPECT_RATIO,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: 340,
  },
  countBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  countText: {
    ...typography.badge,
    color: '#fff',
  },
  dotsRow: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
});

export default PostMediaGallery;
