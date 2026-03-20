/**
 * Skeleton — animated shimmer placeholder for loading states.
 *
 * Replaces spinners for content that has a known shape.
 * Uses an opacity pulse (0.3 → 0.7) on a loop so the user can see
 * that something is loading without a disruptive spinner.
 *
 * Usage:
 *   <Skeleton width={120} height={16} borderRadius={8} />
 *   <Skeleton width="100%" height={48} borderRadius={12} className="mb-3" />
 */

import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

interface SkeletonProps {
  /** Pixel width, or a percentage string (e.g. "100%") */
  width: number | `${number}%`;
  /** Pixel height */
  height: number;
  /** Border radius in pixels */
  borderRadius?: number;
  /** Additional NativeWind className for margins / positioning */
  className?: string;
}

export function Skeleton({
  width,
  height,
  borderRadius = 8,
  className = '',
}: SkeletonProps) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1, // infinite
      true, // reverse — creates smooth back-and-forth pulse
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      accessibilityRole="none"
      aria-hidden={true}
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: '#E2E8F0', // neutral-200 — matches bg-neutral-200
        },
        animatedStyle,
      ]}
      className={className}
    />
  );
}
