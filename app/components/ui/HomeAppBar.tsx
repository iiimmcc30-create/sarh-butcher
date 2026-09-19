import { AppIcon } from '@/components/ui/FlaticonIcon';
import { NotificationBellButton } from '@/components/notifications/NotificationBellButton';
import { ds } from '@/constants/designSystem';
import { type ThemeColors } from '@/constants/theme';
import { radius, space } from '@/design-system';
import { AppText, SarhAvatar, SarhSurface } from '@/design-system/components';
import { Row } from '@/design-system/layout';
import { useLayout } from '@/hooks/useLayout';
import { useTheme } from '@/hooks/useTheme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { HOME_SEARCH_PLACEHOLDER } from '@/lib/homeQuickAccess';
import { Pressable, StyleSheet, View } from 'react-native';

export const HOME_APP_BAR_H = ds.homeAppBar.height;
const BAR_H = space[48];
const TOOL = space[48];
const ICON_SIZE = space[20];
const SEARCH_H = space[48];
const SEARCH_ICON = space[20];
/** Measured chrome stack: padding + identity row + gap + search. */
export const HOME_APP_BAR_STACK_H = space[8] + BAR_H + space[4] + SEARCH_H + space[8];

type HomeAppBarProps = {
  onSearch: () => void;
  onProfilePress: () => void;
  onAvatarPress: () => void;
  displayName: string;
  avatarUri?: string | null;
};

/** Home header: avatar + name + notifications, then a full-width search field. */
export function HomeAppBar({
  onSearch,
  onProfilePress,
  onAvatarPress,
  displayName,
  avatarUri,
}: HomeAppBarProps) {
  const { colors: themeColors } = useTheme();
  const { gutter } = useLayout();
  const colorStyles = useThemedStyles(({ colors }) => createColorStyles(colors));

  return (
    <SarhSurface tone="background" style={[styles.shell, colorStyles.shell]}>
      <View style={[styles.inner, { paddingHorizontal: gutter }]}>
        <Row justify="between" align="center" style={styles.bar}>
          <Row align="center" gap="md" style={styles.profileCluster}>
            <Pressable
              onPress={onAvatarPress}
              style={styles.avatarBtn}
              hitSlop={space[4]}
              accessibilityRole="button"
              accessibilityLabel="القائمة الجانبية"
            >
              <SarhAvatar
                uri={avatarUri}
                name={displayName}
                size="md"
                accessibilityLabel={displayName}
                style={[styles.avatar, colorStyles.avatar]}
              />
            </Pressable>

            <Pressable
              onPress={onProfilePress}
              style={styles.nameTap}
              hitSlop={space[4]}
              accessibilityRole="button"
              accessibilityLabel={displayName}
            >
              <AppText variant="heading3" color="textPrimary" numberOfLines={1} ellipsizeMode="tail">
                {displayName}
              </AppText>
            </Pressable>
          </Row>

          <Row align="center" gap="xs" style={styles.toolsCluster}>
            <NotificationBellButton
              bare
              size={TOOL}
              iconSize={ICON_SIZE}
              style={styles.iconBtn}
              iconColor={themeColors.textPrimary}
              badgeBorderColor={themeColors.screenRoot}
            />
          </Row>
        </Row>

        <Pressable
          onPress={onSearch}
          style={[styles.searchBar, colorStyles.searchBar]}
          accessibilityRole="search"
          accessibilityLabel={HOME_SEARCH_PLACEHOLDER}
        >
          <Row align="center" gap="sm" fill>
            <AppIcon name="search" size={SEARCH_ICON} color={themeColors.textMuted} />
            <AppText variant="bodySmall" color="textMuted" numberOfLines={1} style={styles.searchPlaceholder}>
              {HOME_SEARCH_PLACEHOLDER}
            </AppText>
          </Row>
        </Pressable>
      </View>
    </SarhSurface>
  );
}

function createColorStyles(colors: ThemeColors) {
  return StyleSheet.create({
    shell: { borderBottomColor: colors.borderHairline },
    avatar: {
      borderColor: colors.electric,
      backgroundColor: colors.bgField,
    },
    searchBar: {
      backgroundColor: colors.bgField,
      borderColor: colors.borderSoft,
    },
  });
}

const styles = StyleSheet.create({
  shell: {
    flexGrow: 0,
    flexShrink: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  inner: {
    width: '100%',
    paddingTop: space[8],
    paddingBottom: space[8],
    gap: space[4],
  },
  bar: {
    width: '100%',
    minHeight: BAR_H,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toolsCluster: {
    alignItems: 'center',
    gap: space[4],
  },
  iconBtn: {
    width: TOOL,
    height: TOOL,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  profileCluster: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: space[12],
  },
  nameTap: {
    flexShrink: 1,
    minWidth: 0,
    maxWidth: '70%',
    minHeight: space[48],
    justifyContent: 'center',
  },
  avatarBtn: {
    flexShrink: 0,
    minWidth: space[48],
    minHeight: space[48],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: space[40],
    height: space[40],
    borderRadius: radius[999],
    borderWidth: 2,
  },
  searchBar: {
    width: '100%',
    height: SEARCH_H,
    paddingHorizontal: space[16],
    borderRadius: radius[999],
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  searchPlaceholder: {
    flex: 1,
    minWidth: 0,
  },
});

export default HomeAppBar;
