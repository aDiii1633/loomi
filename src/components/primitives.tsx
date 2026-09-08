/** Core UI primitives — Neo-Chubby Brutalism component system. */
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { colors, border, radii, space, type, layout, elevation } from '../theme/tokens';
import { haptic } from '../state/ui';
import { Icon, type IconName } from './Icon';
import { Image as ExpoImage } from 'expo-image';
import { PaoAndLy } from './illustrations/Mascot';
import { LoomiIllustration } from './illustrations/LoomiIllustration';
import type { IllustrationKey } from './illustrations/registry';

/* --------------------------------- Buttons -------------------------------- */

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'rose' | 'yellow';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({ label, onPress, variant = 'primary', icon, disabled, loading, style }: ButtonProps) {
  const bg =
    variant === 'primary'
      ? colors.primaryContainer
      : variant === 'rose'
        ? colors.softPink
        : variant === 'yellow'
          ? colors.tertiaryFixed
          : variant === 'secondary'
            ? colors.card
            : 'transparent';
  const fg = variant === 'ghost' ? colors.ink : colors.charcoal;
  const hasBorder = variant !== 'ghost';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      onPress={() => {
        haptic('light');
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        hasBorder && styles.buttonBorder,
        hasBorder && (pressed ? elevation.pressed : elevation.card),
        {
          backgroundColor: bg,
          opacity: disabled ? 0.5 : 1,
          transform: pressed && hasBorder
            ? [{ translateX: 2 }, { translateY: 2 }]
            : [{ translateX: 0 }, { translateY: 0 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={18} color={fg} /> : null}
          <Text style={[styles.buttonLabel, { color: fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

/* ---------------------------------- Chips ---------------------------------- */

export function Chip({
  label,
  icon,
  active,
  onPress,
  tone = 'default',
}: {
  label: string;
  icon?: IconName;
  active?: boolean;
  onPress?: () => void;
  tone?: 'default' | 'mint' | 'white' | 'rose' | 'yellow' | 'sage' | 'blue';
}) {
  const bgMap: Record<string, string> = {
    default: active ? colors.primaryContainer : colors.cardWhite,
    mint: active ? colors.primaryContainer : colors.cardWhite,
    white: active ? colors.primaryContainer : colors.cardWhite,
    rose: colors.softPink,
    yellow: colors.tertiaryFixed,
    sage: colors.softSage,
    blue: colors.powderBlue,
  };
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={
        onPress
          ? () => {
              haptic('light');
              onPress();
            }
          : undefined
      }
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: bgMap[tone] ?? bgMap.default,
          transform: pressed && onPress
            ? [{ translateX: 1 }, { translateY: 1 }]
            : [{ translateX: 0 }, { translateY: 0 }],
        },
        pressed && onPress ? elevation.pressed : elevation.badge,
      ]}
    >
      {icon ? <Icon name={icon} size={14} color={colors.charcoal} /> : null}
      <Text style={[styles.chipLabel, { color: colors.charcoal }]}>{label}</Text>
    </Pressable>
  );
}

/* ----------------------------------- Card ---------------------------------- */

export function Card({
  children,
  style,
  onPress,
  padding = 'compact',
  tone = 'card',
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  padding?: 'compact' | 'default';
  tone?: 'card' | 'white' | 'rose' | 'yellow' | 'sage' | 'mint' | 'blue' | 'peach' | 'lavender' | 'forest';
}) {
  const bgMap: Record<string, string> = {
    card: colors.card,
    white: colors.cardWhite,
    rose: colors.softPink,
    yellow: colors.tertiaryFixed,
    sage: colors.softSage,
    mint: colors.lightMint,
    blue: colors.powderBlue,
    peach: colors.peach,
    lavender: colors.softLavender,
    forest: colors.forest,
  };
  const inner: ViewStyle[] = [
    styles.card as ViewStyle,
    { padding: padding === 'compact' ? space.cardPaddingCompact : space.cardPadding } as ViewStyle,
    { backgroundColor: bgMap[tone] ?? bgMap.card } as ViewStyle,
    style as ViewStyle,
  ];
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          haptic('light');
          onPress();
        }}
        style={({ pressed }) => [
          ...inner,
          pressed ? elevation.pressed : elevation.card,
          {
            transform: pressed
              ? [{ translateX: 1 }, { translateY: 1 }]
              : [{ translateX: 0 }, { translateY: 0 }],
          },
        ]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[...inner, elevation.card]}>{children}</View>;
}

/* ---------------------------------- Avatar --------------------------------- */

export function Avatar({ name, size = 40, uri }: { name: string; size?: number; uri?: string }) {
  const initial = name.charAt(0).toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: uri ? 'transparent' : colors.softSage,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: border.width,
        borderColor: border.color,
        overflow: 'hidden',
        ...elevation.badge,
      }}
    >
      {uri ? (
        <ExpoImage source={{ uri }} style={{ width: size, height: size }} contentFit="cover" />
      ) : (
        <Text style={{ ...type.labelLg, color: colors.charcoal, fontSize: size * 0.4 }}>{initial}</Text>
      )}
    </View>
  );
}

/* ---------------------------------- Inputs --------------------------------- */

export function Input({
  label,
  error,
  ...inputProps
}: TextInputProps & { label?: string; error?: string }) {
  return (
    <View style={{ marginBottom: space.md }}>
      {label ? <Text style={styles.inputLabel}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.outlineVariant}
        {...inputProps}
        style={[
          styles.input,
          inputProps.style,
          inputProps.multiline && { height: 96, paddingTop: space.sm, textAlignVertical: 'top' },
          error && { borderColor: colors.error },
        ]}
      />
      {error ? (
        <Text style={{ ...type.bodySm, color: colors.error, marginTop: space.xs }}>{error}</Text>
      ) : null}
    </View>
  );
}

/* --------------------------------- Progress -------------------------------- */

export function ProgressBar({ ratio, height = 12 }: { ratio: number; height?: number }) {
  const clamped = Math.max(0, Math.min(1, ratio));
  return (
    <View
      accessibilityRole="progressbar"
      style={{
        width: '100%',
        height,
        borderRadius: height / 2,
        backgroundColor: colors.surfaceContainer,
        borderWidth: border.widthThin,
        borderColor: border.color,
        overflow: 'hidden',
        padding: 1,
      }}
    >
      <View
        style={{
          width: `${clamped * 100}%`,
          height: '100%',
          borderRadius: height / 2,
          backgroundColor: colors.primaryContainer,
        }}
      />
    </View>
  );
}

/* -------------------------------- Empty state ------------------------------- */

export function EmptyState({
  icon,
  illustration,
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon: IconName;
  illustration?: 'mascot' | IllustrationKey;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      {illustration === 'mascot' ? (
        <PaoAndLy size={104} style={{ marginBottom: space.sm }} />
      ) : illustration ? (
        <LoomiIllustration asset={illustration} size={140} style={{ marginBottom: space.sm }} />
      ) : (
        <View style={styles.emptyIcon}>
          <Icon name={icon} size={26} color={colors.primary} />
        </View>
      )}
      <Text style={{ ...type.headlineSm, color: colors.charcoal }}>{title}</Text>
      <Text style={{ ...type.bodySm, color: colors.inkVariant, textAlign: 'center', marginTop: space.xs }}>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <View style={{ marginTop: space.md }}>
          <Button label={actionLabel} onPress={onAction} variant="secondary" />
        </View>
      ) : null}
    </View>
  );
}

/* ------------------------------ Loading skeleton --------------------------- */

export function SkeletonCard({ height = 96 }: { height?: number }) {
  return <View style={[styles.skeleton, { height }]} />;
}

/* ---------------------------------- Error --------------------------------- */

export function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.errorBox}>
      <Icon name="alert-circle" size={16} color={colors.error} />
      <Text style={{ ...type.bodySm, color: colors.error, flex: 1 }}>{children}</Text>
    </View>
  );
}

/* --------------------------------- Badge ---------------------------------- */

export function Badge({
  label,
  icon,
  tone = 'sage',
}: {
  label: string;
  icon?: IconName;
  tone?: 'sage' | 'rose' | 'yellow' | 'blue' | 'primary';
}) {
  const bgMap: Record<string, string> = {
    sage: colors.softSage,
    rose: colors.softPink,
    yellow: colors.tertiaryFixed,
    blue: colors.powderBlue,
    primary: colors.primaryContainer,
  };
  return (
    <View style={[styles.badge, { backgroundColor: bgMap[tone] ?? bgMap.sage }]}>
      {icon ? <Icon name={icon} size={12} color={colors.charcoal} /> : null}
      <Text style={{ ...type.labelCaps, color: colors.charcoal, textTransform: 'uppercase' }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    height: layout.primaryButtonHeight,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: space.xs,
    paddingHorizontal: space.xl,
  },
  buttonBorder: {
    borderWidth: border.width,
    borderColor: border.color,
  },
  buttonLabel: { ...type.labelLg, letterSpacing: 0.2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.sm,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: border.widthThin,
    borderColor: border.color,
  },
  chipLabel: { ...type.labelMd },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii['2xl'],
    borderWidth: border.width,
    borderColor: border.color,
  },
  inputLabel: { ...type.labelMd, color: colors.inkVariant, marginBottom: space.xs },
  input: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: border.width,
    borderColor: border.color,
    paddingHorizontal: space.md,
    height: 48,
    color: colors.charcoal,
    ...type.bodyMd,
  },
  empty: { alignItems: 'center', padding: space['2xl'], gap: space['2xs'] },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.lightMint,
    borderWidth: border.widthThin,
    borderColor: border.color,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
    ...elevation.badge,
  },
  skeleton: {
    borderRadius: radii.xl,
    backgroundColor: colors.surfaceContainer,
    borderWidth: border.widthThin,
    borderColor: border.color,
    marginBottom: space.md,
  },
  errorBox: {
    flexDirection: 'row',
    gap: space.xs,
    alignItems: 'center',
    backgroundColor: colors.errorContainer,
    borderRadius: radii.md,
    borderWidth: border.widthThin,
    borderColor: border.color,
    padding: space.sm,
    marginBottom: space.md,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: border.widthThin,
    borderColor: border.color,
    ...elevation.badge,
  },
});
