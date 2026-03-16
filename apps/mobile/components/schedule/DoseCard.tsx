/**
 * DoseCard — single dose item in the today's schedule timeline.
 *
 * Shows: scheduled time, medication name, strength (if provided), status badge.
 * Supports swipe-right-to-confirm via react-native-gesture-handler.
 * Haptic feedback on confirmation (graceful fallback if expo-haptics absent).
 * Fully accessible — VoiceOver/TalkBack labels for all states.
 */

import React, { useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
} from 'react-native';
import {
  GestureDetector,
  Gesture,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

import type { DoseItem, DoseStatus } from '../../store/schedule';

// ---------------------------------------------------------------------------
// Haptic helper — graceful fallback if expo-haptics not installed
// ---------------------------------------------------------------------------

// expo-haptics is not in package.json for this sprint.
// This stub is a no-op today; replace with real implementation when the
// package is added in a future sprint.
function triggerHaptic(_type: 'light' | 'success'): void {
  // No-op until expo-haptics is added to dependencies.
}

// ---------------------------------------------------------------------------
// Status display config
// ---------------------------------------------------------------------------

interface StatusConfig {
  label: string;
  /** NativeWind class for badge background */
  badgeBg: string;
  /** NativeWind class for badge text */
  badgeText: string;
  /** NativeWind class for card left border accent */
  borderColor: string;
  /** Accessible description for VoiceOver */
  accessibilityHint: string;
}

const STATUS_CONFIG: Record<DoseStatus, StatusConfig> = {
  upcoming: {
    label: 'Upcoming',
    badgeBg: 'bg-neutral-100',
    badgeText: 'text-neutral-500',
    borderColor: 'border-neutral-200',
    accessibilityHint: 'This dose is scheduled for later today.',
  },
  due: {
    label: 'Due Now',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-700',
    borderColor: 'border-blue-400',
    accessibilityHint: 'This dose is due now. Tap to confirm.',
  },
  taken: {
    label: 'Taken',
    badgeBg: 'bg-green-100',
    badgeText: 'text-green-700',
    borderColor: 'border-green-500',
    accessibilityHint: 'This dose has been confirmed as taken.',
  },
  late: {
    label: 'Taken Late',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
    borderColor: 'border-amber-500',
    accessibilityHint: 'This dose was taken late.',
  },
  missed: {
    label: 'Missed',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
    borderColor: 'border-amber-400',
    accessibilityHint:
      'This dose was missed. You can still log it if you took it.',
  },
  skipped: {
    label: 'Skipped',
    badgeBg: 'bg-neutral-100',
    badgeText: 'text-neutral-500',
    borderColor: 'border-neutral-300',
    accessibilityHint: 'This dose was intentionally skipped.',
  },
};

// ---------------------------------------------------------------------------
// Format time display
// ---------------------------------------------------------------------------

function formatTimeDisplay(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DoseCardProps {
  dose: DoseItem;
  onPress: (dose: DoseItem) => void;
  onSwipeConfirm: (dose: DoseItem) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SWIPE_THRESHOLD = 80; // px to trigger confirmation
const SPRING_CONFIG = { damping: 20, stiffness: 200 };

export function DoseCard({ dose, onPress, onSwipeConfirm }: DoseCardProps) {
  const translateX = useSharedValue(0);
  const swipeConfirmed = useRef(false);

  const config = STATUS_CONFIG[dose.status];
  const isActionable = dose.status === 'due' || dose.status === 'upcoming' || dose.status === 'missed';
  const isCompleted = dose.status === 'taken' || dose.status === 'late' || dose.status === 'skipped';

  const handleSwipeConfirm = useCallback(() => {
    if (!isActionable) return;
    void triggerHaptic('success');
    onSwipeConfirm(dose);
  }, [isActionable, onSwipeConfirm, dose]);

  const panGesture = Gesture.Pan()
    .enabled(isActionable)
    .activeOffsetX([10, 9999]) // only respond to rightward swipe
    .onUpdate((event) => {
      // Clamp to [0, SWIPE_THRESHOLD * 1.5] — don't drag past indicator
      translateX.value = Math.max(0, Math.min(event.translationX, SWIPE_THRESHOLD * 1.5));
    })
    .onEnd((event) => {
      if (event.translationX >= SWIPE_THRESHOLD && !swipeConfirmed.current) {
        swipeConfirmed.current = true;
        runOnJS(handleSwipeConfirm)();
        translateX.value = withSpring(0, SPRING_CONFIG);
      } else {
        translateX.value = withSpring(0, SPRING_CONFIG);
      }
      swipeConfirmed.current = false;
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const swipeRevealOpacity = useAnimatedStyle(() => ({
    opacity: withTiming(
      translateX.value > 20 ? Math.min(translateX.value / SWIPE_THRESHOLD, 1) : 0,
      { duration: 100 }
    ),
  }));

  const timeDisplay = formatTimeDisplay(dose.scheduledAt);
  const accessibilityLabel = [
    timeDisplay,
    dose.medicationName,
    dose.strengthLabel ? dose.strengthLabel : '',
    config.label,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <View className="relative mx-4 mb-3">
      {/* Swipe-to-confirm reveal background */}
      {isActionable && (
        <Animated.View
          style={swipeRevealOpacity}
          className="absolute inset-0 rounded-xl bg-green-500 items-center justify-end flex-row pr-4"
          accessibilityElementsHidden
        >
          <Text className="text-white font-semibold text-sm">Mark Taken</Text>
        </Animated.View>
      )}

      {/* Card */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={cardStyle}>
          <Pressable
            onPress={() => onPress(dose)}
            disabled={isCompleted && dose.status !== 'missed'}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            accessibilityHint={
              isActionable
                ? `${config.accessibilityHint} Swipe right to mark as taken.`
                : config.accessibilityHint
            }
            accessibilityState={{ disabled: !isActionable && !isCompleted }}
          >
            <View
              className={`bg-white rounded-xl p-4 border-l-4 ${config.borderColor} shadow-sm`}
              style={
                // Subtle opacity for completed/skipped doses so the timeline
                // is visually scannable — completed items fade back.
                isCompleted ? { opacity: 0.7 } : undefined
              }
            >
              <View className="flex-row items-center justify-between">
                {/* Left: time + medication info */}
                <View className="flex-1 mr-3">
                  <Text
                    className="text-neutral-400 text-sm font-medium mb-1"
                    allowFontScaling
                    accessibilityElementsHidden
                  >
                    {timeDisplay}
                  </Text>
                  <Text
                    className="text-neutral-800 text-base font-semibold"
                    numberOfLines={1}
                    allowFontScaling
                  >
                    {dose.medicationName}
                  </Text>
                  {dose.strengthLabel !== '' && (
                    <Text
                      className="text-neutral-500 text-sm mt-0.5"
                      allowFontScaling
                    >
                      {dose.strengthLabel}
                    </Text>
                  )}
                  {dose.withFood && (
                    <Text
                      className="text-brand-600 text-xs mt-1 font-medium"
                      allowFontScaling
                    >
                      Take with food
                    </Text>
                  )}
                </View>

                {/* Right: status badge */}
                <View className={`px-3 py-1 rounded-full ${config.badgeBg}`}>
                  <Text
                    className={`text-xs font-semibold ${config.badgeText}`}
                    allowFontScaling={false}
                  >
                    {config.label}
                  </Text>
                </View>
              </View>
            </View>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
