/**
 * Today's Schedule screen — the primary dose management interface.
 *
 * Shows a chronological timeline of today's doses with status indicators.
 * Supports dose confirmation via bottom sheet (tap) and swipe-to-confirm.
 * Pulls notification permissions on mount and reschedules reminders on focus.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { useScheduleStore, type DoseItem, type ConfirmDoseOptions } from '../../../store/schedule';
import { useUserStore } from '../../../store/user';
import { useMedicationsStore } from '../../../store/medications';
import { DoseCard } from '../../../components/schedule/DoseCard';
import { DoseConfirmSheet } from '../../../components/schedule/DoseConfirmSheet';
import { initNotifications, rescheduleAllReminders } from '../../../lib/notifications/index';
import { getSchedulesForMedication } from '../../../lib/db/schedules';
import type { DoseConfirmResult } from '../../../components/schedule/DoseConfirmSheet';

// ---------------------------------------------------------------------------
// Date header helpers
// ---------------------------------------------------------------------------

function formatTodayHeader(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Progress summary
// ---------------------------------------------------------------------------

interface ProgressSummaryProps {
  doses: DoseItem[];
}

function ProgressSummary({ doses }: ProgressSummaryProps) {
  const total = doses.length;
  const completed = doses.filter(
    (d) => d.status === 'taken' || d.status === 'late' || d.status === 'skipped'
  ).length;
  const missed = doses.filter((d) => d.status === 'missed').length;

  if (total === 0) return null;

  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <View className="mx-4 mb-4 bg-white rounded-xl p-4 shadow-sm">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-neutral-600 text-sm font-medium" allowFontScaling>
          Today's Progress
        </Text>
        <Text className="text-brand-600 text-sm font-semibold" allowFontScaling>
          {completed} / {total} done
        </Text>
      </View>
      {/* Progress bar */}
      <View className="h-2 bg-neutral-100 rounded-full overflow-hidden">
        <View
          className="h-full bg-brand-500 rounded-full"
          style={{ width: `${pct}%` }}
        />
      </View>
      {missed > 0 && (
        <Text
          className="text-amber-600 text-xs mt-2 font-medium"
          allowFontScaling
        >
          {missed} dose{missed === 1 ? '' : 's'} missed — tap to log
        </Text>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <View className="flex-1 items-center justify-center px-8 py-16">
      <View className="w-16 h-16 rounded-full bg-brand-50 items-center justify-center mb-4">
        {/* Checkmark circle placeholder — replace with Lucide icon when available */}
        <Text className="text-brand-500 text-2xl" accessibilityElementsHidden>
          ✓
        </Text>
      </View>
      <Text
        className="text-neutral-800 text-xl font-bold text-center mb-2"
        allowFontScaling
        accessibilityRole="header"
      >
        No doses today
      </Text>
      <Text
        className="text-neutral-400 text-base text-center"
        allowFontScaling
      >
        You have no medications scheduled for today. Add a medication to get started.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function ScheduleScreen() {
  const { userId } = useUserStore();
  const { medications } = useMedicationsStore();
  const {
    todaysDoses,
    isLoading,
    error,
    loadTodaysDoses,
    confirmDose,
    refreshSchedule,
  } = useScheduleStore();

  const [selectedDose, setSelectedDose] = useState<DoseItem | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [notifPermGranted, setNotifPermGranted] = useState(false);

  // ---------------------------------------------------------------------------
  // Initialise notifications on first mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    void (async () => {
      const granted = await initNotifications();
      setNotifPermGranted(granted);
    })();
  }, []);

  // ---------------------------------------------------------------------------
  // Load + reschedule on every screen focus
  // ---------------------------------------------------------------------------

  useFocusEffect(
    useCallback(() => {
      const currentUserId = userId ?? 'local';

      void loadTodaysDoses(currentUserId);

      // Reschedule notifications whenever the user returns to this screen
      // so any schedule changes from the Medications screen are reflected.
      if (notifPermGranted && medications.length > 0) {
        void (async () => {
          const allSchedules: import('@safedose/shared-types').Schedule[] = [];
          const medMap = new Map<string, { id: string }>();

          for (const med of medications) {
            medMap.set(med.id, { id: med.id });
            try {
              const schedules = await getSchedulesForMedication(med.id);
              allSchedules.push(...schedules);
            } catch {
              // Non-fatal — continue with remaining medications
            }
          }

          await rescheduleAllReminders(medMap, allSchedules);
        })();
      }
    }, [userId, loadTodaysDoses, notifPermGranted, medications])
  );

  // ---------------------------------------------------------------------------
  // Dose confirmation handlers
  // ---------------------------------------------------------------------------

  const handleDosePress = useCallback((dose: DoseItem) => {
    setSelectedDose(dose);
    setSheetVisible(true);
  }, []);

  const handleSwipeConfirm = useCallback(
    (dose: DoseItem) => {
      // Direct take-now on swipe — no sheet needed.
      void confirmDose(dose.id, 'taken').catch((err: unknown) => {
        console.error('[schedule] swipe confirm failed:', err);
      });
    },
    [userId, confirmDose]
  );

  const handleSheetConfirm = useCallback(
    async (result: DoseConfirmResult) => {
      if (selectedDose === null) return;
      await confirmDose(selectedDose.id, result.eventType, {
        confirmedAt: result.confirmedAt,
        notes: result.notes,
      } satisfies ConfirmDoseOptions);
      setSheetVisible(false);
      setSelectedDose(null);
    },
    [selectedDose, confirmDose]
  );

  const handleSnooze = useCallback((_dose: DoseItem) => {
    // The DoseConfirmSheet already called scheduleMissedDoseFollowup.
    // Just close the sheet.
    setSheetVisible(false);
    setSelectedDose(null);
  }, []);

  const handleSheetDismiss = useCallback(() => {
    setSheetVisible(false);
    setSelectedDose(null);
  }, []);

  const handleRefresh = useCallback(() => {
    void refreshSchedule(userId ?? 'local');
  }, [userId, refreshSchedule]);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const renderDoseCard = useCallback(
    ({ item }: { item: DoseItem }) => (
      <DoseCard
        dose={item}
        onPress={handleDosePress}
        onSwipeConfirm={handleSwipeConfirm}
      />
    ),
    [handleDosePress, handleSwipeConfirm]
  );

  const renderListHeader = useCallback(
    () => <ProgressSummary doses={todaysDoses} />,
    [todaysDoses]
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView className="flex-1 bg-neutral-50">
      {/* Screen header */}
      <View className="px-4 pt-2 pb-4">
        <Text
          className="text-neutral-800 text-2xl font-bold"
          allowFontScaling
          accessibilityRole="header"
        >
          Today's Schedule
        </Text>
        <Text
          className="text-neutral-400 text-sm mt-1"
          allowFontScaling
          accessibilityElementsHidden
        >
          {formatTodayHeader()}
        </Text>
      </View>

      {/* Notification permission nudge */}
      {!notifPermGranted && todaysDoses.length > 0 && (
        <View className="mx-4 mb-3 bg-amber-50 rounded-xl px-4 py-3 flex-row items-center">
          <Text className="text-amber-700 text-sm flex-1" allowFontScaling>
            Enable notifications to receive dose reminders.
          </Text>
          <Pressable
            onPress={() => void initNotifications().then(setNotifPermGranted)}
            accessibilityRole="button"
            accessibilityLabel="Enable notifications"
          >
            <Text className="text-brand-600 text-sm font-semibold ml-2" allowFontScaling>
              Enable
            </Text>
          </Pressable>
        </View>
      )}

      {/* Loading state */}
      {isLoading && todaysDoses.length === 0 && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#14B8A6" />
          <Text
            className="text-neutral-400 text-sm mt-3"
            allowFontScaling
            accessibilityLiveRegion="polite"
          >
            Loading your schedule…
          </Text>
        </View>
      )}

      {/* Error state */}
      {error !== null && !isLoading && (
        <View className="mx-4 mb-3 bg-amber-50 rounded-xl px-4 py-3">
          <Text className="text-amber-700 text-sm font-medium" allowFontScaling>
            Could not load schedule
          </Text>
          <Pressable
            onPress={handleRefresh}
            accessibilityRole="button"
            accessibilityLabel="Retry loading schedule"
          >
            <Text className="text-brand-600 text-sm mt-1" allowFontScaling>
              Tap to retry
            </Text>
          </Pressable>
        </View>
      )}

      {/* Dose list */}
      {!isLoading && error === null && (
        <FlatList
          data={todaysDoses}
          renderItem={renderDoseCard}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderListHeader}
          ListEmptyComponent={EmptyState}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={handleRefresh}
              tintColor="#14B8A6"
              colors={['#14B8A6']}
            />
          }
          contentContainerStyle={
            todaysDoses.length === 0
              ? { flexGrow: 1 }
              : { paddingTop: 8, paddingBottom: 32 }
          }
          showsVerticalScrollIndicator={false}
          accessibilityLabel="Today's dose schedule"
        />
      )}

      {/* Dose confirmation sheet */}
      <DoseConfirmSheet
        dose={selectedDose}
        visible={sheetVisible}
        onConfirm={handleSheetConfirm}
        onSnooze={handleSnooze}
        onDismiss={handleSheetDismiss}
      />
    </SafeAreaView>
  );
}
