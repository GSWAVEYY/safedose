/**
 * DoseConfirmSheet — bottom sheet for dose confirmation options.
 *
 * Options:
 *   - Take Now       → logs eventType='taken' at current time
 *   - Skip           → logs eventType='skipped' with optional note
 *   - Snooze 30 min  → schedules a follow-up notification (no log entry)
 *   - Taken Earlier  → shows a time picker, logs eventType='late'
 *
 * Uses react-native-reanimated for the slide-up sheet animation.
 * No third-party bottom sheet library required — avoids adding a new dep.
 *
 * PHI RULE: This component receives the DoseItem and uses medicationName for
 * display within the app. This is inside the app, not in a notification.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { DoseItem } from '../../store/schedule';
import type { DoseEventType } from '@safedose/shared-types';
import { scheduleMissedDoseFollowup } from '../../lib/notifications/index';
import { haptics } from '../../lib/haptics';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DoseConfirmResult {
  eventType: Extract<DoseEventType, 'taken' | 'skipped' | 'late'>;
  confirmedAt?: string;
  notes?: string;
}

export interface DoseConfirmSheetProps {
  dose: DoseItem | null;
  visible: boolean;
  onConfirm: (result: DoseConfirmResult) => Promise<void>;
  onSnooze: (dose: DoseItem) => void;
  onDismiss: () => void;
}

// ---------------------------------------------------------------------------
// Time picker helpers
// ---------------------------------------------------------------------------

/** Format a Date as HH:mm for display in the earlier-time input */
function formatHHMM(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * Parse user-entered HH:mm and return a full ISO string anchored to today.
 * Returns null if the input is unparseable or the time is in the future.
 */
function parseEarlierTime(hhmmInput: string, scheduledAt: Date): string | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmmInput.trim());
  if (match === null) return null;

  const hours = parseInt(match[1] as string, 10);
  const minutes = parseInt(match[2] as string, 10);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  const result = new Date(scheduledAt);
  result.setHours(hours, minutes, 0, 0);

  // Must be in the past
  if (result > new Date()) return null;

  return result.toISOString();
}

// ---------------------------------------------------------------------------
// Sheet animation constants
// ---------------------------------------------------------------------------

const SHEET_HEIGHT = 420;
const SPRING_CONFIG = { damping: 24, stiffness: 280 };

// ---------------------------------------------------------------------------
// Option button component
// ---------------------------------------------------------------------------

interface OptionButtonProps {
  label: string;
  description: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'warning' | 'destructive';
  disabled?: boolean;
  loading?: boolean;
}

function OptionButton({
  label,
  description,
  onPress,
  variant = 'secondary',
  disabled = false,
  loading = false,
}: OptionButtonProps) {
  const bgClass = {
    primary: 'bg-brand-600',
    secondary: 'bg-neutral-100',
    warning: 'bg-amber-50',
    destructive: 'bg-neutral-50',
  }[variant];

  const textClass = {
    primary: 'text-white',
    secondary: 'text-neutral-800',
    warning: 'text-amber-700',
    destructive: 'text-neutral-500',
  }[variant];

  const descClass = {
    primary: 'text-white/70',
    secondary: 'text-neutral-500',
    warning: 'text-amber-600',
    destructive: 'text-neutral-400',
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={description}
      accessibilityState={{ disabled: disabled || loading }}
      className={`${bgClass} rounded-xl px-4 py-3.5 mb-2.5 flex-row items-center justify-between ${
        disabled ? 'opacity-50' : ''
      }`}
    >
      <View className="flex-1">
        <Text className={`text-base font-semibold ${textClass}`} allowFontScaling>
          {label}
        </Text>
        <Text className={`text-sm mt-0.5 ${descClass}`} allowFontScaling>
          {description}
        </Text>
      </View>
      {loading && (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? '#ffffff' : '#64748B'}
        />
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DoseConfirmSheet({
  dose,
  visible,
  onConfirm,
  onSnooze,
  onDismiss,
}: DoseConfirmSheetProps) {
  const translateY = useSharedValue(SHEET_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  const [mode, setMode] = useState<'options' | 'skip-note' | 'taken-earlier'>('options');
  const [skipNote, setSkipNote] = useState('');
  const [earlierTime, setEarlierTime] = useState('');
  const [earlierTimeError, setEarlierTimeError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset internal state whenever the sheet opens on a new dose.
  useEffect(() => {
    if (visible && dose !== null) {
      setMode('options');
      setSkipNote('');
      setEarlierTime(formatHHMM(dose.scheduledAt));
      setEarlierTimeError('');
      setIsSubmitting(false);
    }
  }, [visible, dose]);

  // Animate in/out
  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, SPRING_CONFIG);
      backdropOpacity.value = withTiming(1, { duration: 200 });
    } else {
      translateY.value = withSpring(SHEET_HEIGHT, SPRING_CONFIG);
      backdropOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible, translateY, backdropOpacity]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  // ---------------------------------------------------------------------------
  // Action handlers
  // ---------------------------------------------------------------------------

  const handleTakeNow = useCallback(async () => {
    if (dose === null) return;
    setIsSubmitting(true);
    try {
      await onConfirm({ eventType: 'taken' });
      haptics.success();
    } finally {
      setIsSubmitting(false);
    }
  }, [dose, onConfirm]);

  const handleSkipConfirm = useCallback(async () => {
    if (dose === null) return;
    setIsSubmitting(true);
    try {
      await onConfirm({
        eventType: 'skipped',
        notes: skipNote.trim() !== '' ? skipNote.trim() : undefined,
      });
      haptics.warning();
    } finally {
      setIsSubmitting(false);
    }
  }, [dose, onConfirm, skipNote]);

  const handleSnooze = useCallback(() => {
    if (dose === null) return;
    // Schedule a follow-up notification 30 minutes out.
    void scheduleMissedDoseFollowup(
      dose.medicationId,
      dose.scheduledAt.toISOString()
    );
    onSnooze(dose);
  }, [dose, onSnooze]);

  const handleTakenEarlier = useCallback(async () => {
    if (dose === null) return;

    const confirmedAt = parseEarlierTime(earlierTime, dose.scheduledAt);
    if (confirmedAt === null) {
      setEarlierTimeError('Please enter a valid past time in HH:MM format.');
      return;
    }
    setEarlierTimeError('');
    setIsSubmitting(true);
    try {
      await onConfirm({ eventType: 'late', confirmedAt });
      haptics.success();
    } finally {
      setIsSubmitting(false);
    }
  }, [dose, onConfirm, earlierTime]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (dose === null && !visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Backdrop */}
        <Animated.View
          style={[{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)' }, backdropStyle]}
        >
          <Pressable
            className="flex-1"
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          />
        </Animated.View>

        {/* Sheet */}
        <Animated.View
          style={[{ height: SHEET_HEIGHT }, sheetStyle]}
          className="bg-white rounded-t-2xl px-5 pt-4 pb-8"
        >
          {/* Handle */}
          <View className="items-center mb-4">
            <View className="w-10 h-1 rounded-full bg-neutral-300" />
          </View>

          {/* Header */}
          {dose !== null && (
            <View className="mb-4">
              <Text
                className="text-neutral-800 text-xl font-bold"
                allowFontScaling
                numberOfLines={1}
              >
                {dose.medicationName}
              </Text>
              <Text className="text-neutral-400 text-sm mt-0.5" allowFontScaling>
                Scheduled {dose.scheduledAt.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {dose.withFood ? ' · With food' : ''}
              </Text>
            </View>
          )}

          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            {/* OPTIONS MODE */}
            {mode === 'options' && (
              <>
                <OptionButton
                  label="Take Now"
                  description="Mark as taken at this moment"
                  variant="primary"
                  onPress={() => void handleTakeNow()}
                  loading={isSubmitting}
                  disabled={isSubmitting}
                />
                <OptionButton
                  label="Taken Earlier"
                  description="Enter the time you actually took it"
                  variant="secondary"
                  onPress={() => setMode('taken-earlier')}
                  disabled={isSubmitting}
                />
                <OptionButton
                  label="Snooze 30 min"
                  description="Remind me again in 30 minutes"
                  variant="warning"
                  onPress={handleSnooze}
                  disabled={isSubmitting}
                />
                <OptionButton
                  label="Skip this dose"
                  description="I'm not taking this dose today"
                  variant="destructive"
                  onPress={() => setMode('skip-note')}
                  disabled={isSubmitting}
                />
              </>
            )}

            {/* SKIP NOTE MODE */}
            {mode === 'skip-note' && (
              <>
                <Text
                  className="text-neutral-700 text-base font-semibold mb-3"
                  allowFontScaling
                >
                  Reason for skipping (optional)
                </Text>
                <TextInput
                  className="bg-neutral-100 rounded-xl px-4 py-3 text-neutral-800 text-base mb-4"
                  placeholder="e.g. Nausea, doctor advised, etc."
                  placeholderTextColor="#94A3B8"
                  value={skipNote}
                  onChangeText={setSkipNote}
                  multiline
                  numberOfLines={3}
                  maxLength={200}
                  autoFocus
                  allowFontScaling
                  accessibilityLabel="Reason for skipping dose"
                />
                <View className="flex-row gap-3">
                  <Pressable
                    className="flex-1 bg-neutral-100 rounded-xl py-3.5 items-center"
                    onPress={() => setMode('options')}
                    accessibilityRole="button"
                    accessibilityLabel="Back"
                  >
                    <Text className="text-neutral-600 font-semibold" allowFontScaling>
                      Back
                    </Text>
                  </Pressable>
                  <Pressable
                    className="flex-1 bg-neutral-800 rounded-xl py-3.5 items-center"
                    onPress={() => void handleSkipConfirm()}
                    disabled={isSubmitting}
                    accessibilityRole="button"
                    accessibilityLabel="Confirm skip"
                  >
                    {isSubmitting ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text className="text-white font-semibold" allowFontScaling>
                        Confirm Skip
                      </Text>
                    )}
                  </Pressable>
                </View>
              </>
            )}

            {/* TAKEN EARLIER MODE */}
            {mode === 'taken-earlier' && (
              <>
                <Text
                  className="text-neutral-700 text-base font-semibold mb-3"
                  allowFontScaling
                >
                  What time did you take it?
                </Text>
                <TextInput
                  className={`bg-neutral-100 rounded-xl px-4 py-3 text-neutral-800 text-base mb-1 ${
                    earlierTimeError !== '' ? 'border border-amber-400' : ''
                  }`}
                  placeholder="HH:MM (e.g. 08:30)"
                  placeholderTextColor="#94A3B8"
                  value={earlierTime}
                  onChangeText={(v) => {
                    setEarlierTime(v);
                    setEarlierTimeError('');
                  }}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                  autoFocus
                  allowFontScaling
                  accessibilityLabel="Time you took the dose"
                />
                {earlierTimeError !== '' && (
                  <Text
                    className="text-amber-600 text-sm mb-3"
                    allowFontScaling
                  >
                    {earlierTimeError}
                  </Text>
                )}
                <View className="flex-row gap-3 mt-2">
                  <Pressable
                    className="flex-1 bg-neutral-100 rounded-xl py-3.5 items-center"
                    onPress={() => setMode('options')}
                    accessibilityRole="button"
                    accessibilityLabel="Back"
                  >
                    <Text className="text-neutral-600 font-semibold" allowFontScaling>
                      Back
                    </Text>
                  </Pressable>
                  <Pressable
                    className="flex-1 bg-brand-600 rounded-xl py-3.5 items-center"
                    onPress={() => void handleTakenEarlier()}
                    disabled={isSubmitting}
                    accessibilityRole="button"
                    accessibilityLabel="Confirm taken at earlier time"
                  >
                    {isSubmitting ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text className="text-white font-semibold" allowFontScaling>
                        Confirm
                      </Text>
                    )}
                  </Pressable>
                </View>
              </>
            )}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
