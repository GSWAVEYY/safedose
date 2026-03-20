/**
 * SpringPressable — reusable spring scale press wrapper.
 *
 * Replaces ad-hoc Pressable + Animated.View combinations scattered throughout
 * the codebase. Provides a consistent spring-scale feel on press with an
 * optional haptic feedback.
 *
 * Animation:
 *   - Press in:  scale → scaleDown (default 0.96), spring damping:15 stiffness:200
 *   - Press out: scale → 1.0, same spring config
 *
 * Usage:
 *   <SpringPressable onPress={handlePress} haptic="light">
 *     <Card>...</Card>
 *   </SpringPressable>
 *
 *   <SpringPressable onPress={handlePress} scaleDown={0.92} haptic="medium">
 *     <BigTile />
 *   </SpringPressable>
 */

import React, { useCallback } from 'react';
import { Pressable, type PressableProps } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { haptics } from '../../lib/haptics';

type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

interface SpringPressableProps extends PressableProps {
  children: React.ReactNode;
  /**
   * Scale factor applied on press-in.
   * 0.96 (default) is a subtle, professional feel.
   * Go lower (e.g. 0.90) for larger card-style targets.
   */
  scaleDown?: number;
  /**
   * Optional haptic feedback type fired on press-in.
   * Omit or pass undefined for no haptics.
   */
  haptic?: HapticType;
}

const SPRING_CONFIG = { damping: 15, stiffness: 200 };

export function SpringPressable({
  children,
  scaleDown = 0.96,
  haptic,
  onPressIn,
  onPressOut,
  ...rest
}: SpringPressableProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(
    (event: Parameters<NonNullable<PressableProps['onPressIn']>>[0]) => {
      scale.value = withSpring(scaleDown, SPRING_CONFIG);
      if (haptic !== undefined) {
        haptics[haptic]();
      }
      onPressIn?.(event);
    },
    [scale, scaleDown, haptic, onPressIn],
  );

  const handlePressOut = useCallback(
    (event: Parameters<NonNullable<PressableProps['onPressOut']>>[0]) => {
      scale.value = withSpring(1, SPRING_CONFIG);
      onPressOut?.(event);
    },
    [scale, onPressOut],
  );

  return (
    <Pressable
      {...rest}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={animatedStyle}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
