/**
 * Pao & Ly — Loomi's mascot pair.
 * Temporary, hand-built SVG illustrations: simple rounded blob characters
 * with a leaf sprout, closed happy eyes, and blush cheeks — matching the
 * approved brand mascot's spirit. Kept isolated in this one file so real
 * artwork can replace the SVG bodies later without touching any screen.
 */
import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Ellipse, Path, Circle } from 'react-native-svg';
import { colors, border } from '../../theme/tokens';

export type MascotVariant = 'pao' | 'ly';
export type MascotMood = 'happy' | 'sleepy' | 'celebrating';

interface MascotProps {
  variant?: MascotVariant;
  mood?: MascotMood;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/** One mascot character: rounded blob body, leaf sprout, simple face. */
export function Mascot({ variant = 'pao', mood = 'happy', size = 96, style }: MascotProps) {
  const bodyFill = variant === 'pao' ? colors.primaryContainer : colors.card;
  const bodyStroke = border.color;
  const leafFill = variant === 'pao' ? colors.primary : colors.primaryContainer;
  const blushFill = colors.tertiaryContainer;

  return (
    <View style={style}>
      <Svg width={size} height={size * 1.05} viewBox="0 0 100 105">
        {/* leaf sprout */}
        <Path d="M50 18 C40 8 28 6 22 10 C28 20 40 22 50 18 Z" fill={leafFill} />
        <Path d="M50 18 C60 6 74 4 80 9 C74 20 60 23 50 18 Z" fill={leafFill} />
        {/* body */}
        <Ellipse cx="50" cy="62" rx="40" ry="38" fill={bodyFill} stroke={bodyStroke} strokeWidth={border.width} />
        {/* blush */}
        <Circle cx="28" cy="66" r="6" fill={blushFill} opacity={0.55} />
        <Circle cx="72" cy="66" r="6" fill={blushFill} opacity={0.55} />
        {/* face */}
        {mood === 'sleepy' ? (
          <>
            <Path d="M28 58 h12" stroke={colors.charcoal} strokeWidth={2.5} strokeLinecap="round" />
            <Path d="M60 58 h12" stroke={colors.charcoal} strokeWidth={2.5} strokeLinecap="round" />
          </>
        ) : (
          <>
            <Path d="M24 56 Q34 66 44 56" stroke={colors.charcoal} strokeWidth={2.5} fill="none" strokeLinecap="round" />
            <Path d="M56 56 Q66 66 76 56" stroke={colors.charcoal} strokeWidth={2.5} fill="none" strokeLinecap="round" />
          </>
        )}
        <Path
          d={mood === 'celebrating' ? 'M40 78 Q50 90 60 78' : 'M42 78 Q50 84 58 78'}
          stroke={colors.charcoal}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

/** The pair together — Home hero, empty states, celebratory moments. */
export function PaoAndLy({ size = 140, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' }, style]}>
      <Mascot variant="pao" size={size * 0.72} style={{ marginRight: -size * 0.12, zIndex: 2 }} />
      <Mascot variant="ly" size={size * 0.62} />
    </View>
  );
}
