/**
 * Symptom Timeline Screen — symptom-medication correlation view.
 *
 * Features:
 *   - Date range selector: 7 / 14 / 30 days
 *   - Pattern detection section: frequency cards at top
 *   - Vertical scrollable timeline: one section per day, newest first
 *     - Symptom entries with badge rows + severity indicators
 *     - Medication dose events (taken / missed / skipped)
 *     - Medication change markers (started / stopped, derived from startedAt / endedAt)
 *   - "Share with Doctor" placeholder button (PDF export — future sprint)
 *
 * Data strategy:
 *   - Symptoms: useSymptomsStore (getFrequencyReport + loadSymptomHistory)
 *   - Doses: loaded per-medication via getDoseHistory then merged
 *   - Medication changes: derived from medications[].startedAt / endedAt falling in range
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useSymptomsStore } from '../../../store/symptoms';
import { useMedicationsStore } from '../../../store/medications';
import { getDoseHistory } from '../../../lib/db/dose-log';
import { TimelineDay, type MedicationChange } from '../../../components/symptoms/TimelineDay';
import { PatternCard, type SeverityTrend } from '../../../components/symptoms/PatternCard';
import type { DoseLog, Symptom } from '@safedose/shared-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DayRange = 7 | 14 | 30;

interface DayBucket {
  date: string; // YYYY-MM-DD
  symptoms: Symptom[];
  doses: DoseLog[];
  medicationChanges: MedicationChange[];
}

interface PatternData {
  tag: string;
  occurrences: number;
  dayWindow: number;
  frequency: number;
  avgSeverity: number;
  trend: SeverityTrend;
  correlatedMedication?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toLocalDateStr(isoStr: string): string {
  const d = new Date(isoStr);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildDateRange(days: DayRange): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${day}`);
  }
  return dates; // newest first
}

/**
 * Simple correlation detection: check whether a symptom tag appears more
 * frequently on days where a specific medication was taken vs not.
 * Returns the medication name if a meaningful correlation exists, else undefined.
 */
function detectCorrelation(
  tag: string,
  dayBuckets: DayBucket[],
  medications: { id: string; name: string }[]
): string | undefined {
  if (medications.length === 0) return undefined;

  const THRESHOLD = 0.3; // 30% higher co-occurrence rate

  for (const med of medications) {
    let daysWithMed = 0;
    let daysWithMedAndSymptom = 0;
    let daysWithoutMed = 0;
    let daysWithoutMedAndSymptom = 0;

    for (const bucket of dayBuckets) {
      const hasMed = bucket.doses.some(
        (d) =>
          d.medicationId === med.id &&
          (d.eventType === 'taken' || d.eventType === 'caregiver_confirmed')
      );
      const hasSymptom = bucket.symptoms.some((s) => s.symptoms.includes(tag));

      if (hasMed) {
        daysWithMed++;
        if (hasSymptom) daysWithMedAndSymptom++;
      } else {
        daysWithoutMed++;
        if (hasSymptom) daysWithoutMedAndSymptom++;
      }
    }

    if (daysWithMed === 0) continue;

    const rateWith = daysWithMedAndSymptom / daysWithMed;
    const rateWithout =
      daysWithoutMed > 0 ? daysWithoutMedAndSymptom / daysWithoutMed : 0;

    if (rateWith - rateWithout >= THRESHOLD && daysWithMedAndSymptom >= 2) {
      return med.name;
    }
  }

  return undefined;
}

/**
 * Compute severity trend: compare first half vs second half of date range.
 * Buckets are newest-first so we split accordingly.
 */
function computeTrend(tag: string, dayBuckets: DayBucket[]): SeverityTrend {
  if (dayBuckets.length < 4) return 'stable';

  const mid = Math.floor(dayBuckets.length / 2);
  // Newer half = buckets[0..mid], older half = buckets[mid..end]
  const newerBuckets = dayBuckets.slice(0, mid);
  const olderBuckets = dayBuckets.slice(mid);

  const avgFor = (buckets: DayBucket[]): number => {
    const severities = buckets.flatMap((b) =>
      b.symptoms.filter((s) => s.symptoms.includes(tag)).map((s) => s.severity)
    );
    if (severities.length === 0) return 0;
    return severities.reduce((a, b) => a + b, 0) / severities.length;
  };

  const newerAvg = avgFor(newerBuckets);
  const olderAvg = avgFor(olderBuckets);

  if (newerAvg === 0 || olderAvg === 0) return 'stable';
  if (newerAvg > olderAvg + 0.5) return 'up';
  if (newerAvg < olderAvg - 0.5) return 'down';
  return 'stable';
}

// ---------------------------------------------------------------------------
// Range selector sub-component
// ---------------------------------------------------------------------------

interface RangeSelectorProps {
  selected: DayRange;
  onSelect: (range: DayRange) => void;
}

function RangeSelector({ selected, onSelect }: RangeSelectorProps) {
  const { t } = useTranslation();
  const options: DayRange[] = [7, 14, 30];

  return (
    <View
      className="flex-row bg-neutral-100 rounded-xl p-1 mx-4 mb-4"
      accessibilityRole="tablist"
      accessibilityLabel={t('symptoms.dateRangeSelectorLabel')}
    >
      {options.map((opt) => {
        const isSelected = opt === selected;
        return (
          <Pressable
            key={opt}
            onPress={() => onSelect(opt)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={t('symptoms.dateRangeOption', { days: opt })}
            className={[
              'flex-1 py-2 rounded-lg items-center',
              isSelected ? 'bg-white shadow-sm' : '',
            ].join(' ')}
            style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
          >
            <Text
              className={[
                'text-sm font-semibold',
                isSelected ? 'text-neutral-800' : 'text-neutral-500',
              ].join(' ')}
              allowFontScaling
            >
              {t('symptoms.dateRangeLabel', { days: opt })}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function TimelineScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const { symptoms, frequencyReport, loadSymptomHistory, getFrequencyReport } =
    useSymptomsStore();
  const { medications, loadMedications } = useMedicationsStore();

  const [selectedRange, setSelectedRange] = useState<DayRange>(7);
  const [allDoses, setAllDoses] = useState<DoseLog[]>([]);
  const [isLoadingDoses, setIsLoadingDoses] = useState(false);
  const [isLoadingSymptoms, setIsLoadingSymptoms] = useState(false);

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const loadData = useCallback(
    async (range: DayRange) => {
      setIsLoadingSymptoms(true);
      setIsLoadingDoses(true);

      try {
        await Promise.all([
          loadSymptomHistory(range),
          getFrequencyReport(range),
          loadMedications(),
        ]);
      } finally {
        setIsLoadingSymptoms(false);
      }

      // Load doses for each medication in parallel
      try {
        const doseArrays = await Promise.all(
          medications.map((med) =>
            getDoseHistory(med.id, range).catch(() => [] as DoseLog[])
          )
        );
        setAllDoses(doseArrays.flat());
      } catch {
        // Non-fatal — timeline still works without dose data
        setAllDoses([]);
      } finally {
        setIsLoadingDoses(false);
      }
    },
    [loadSymptomHistory, getFrequencyReport, loadMedications, medications]
  );

  useFocusEffect(
    useCallback(() => {
      void loadData(selectedRange);
    }, [selectedRange, loadData])
  );

  const handleRangeChange = useCallback(
    (range: DayRange) => {
      setSelectedRange(range);
      void loadData(range);
    },
    [loadData]
  );

  // ---------------------------------------------------------------------------
  // Build day buckets (memoised)
  // ---------------------------------------------------------------------------

  const dayBuckets = useMemo<DayBucket[]>(() => {
    const dateRange = buildDateRange(selectedRange);

    // Group symptoms by date
    const symptomsByDate = new Map<string, Symptom[]>();
    for (const s of symptoms) {
      const dateKey = toLocalDateStr(s.reportedAt);
      const bucket = symptomsByDate.get(dateKey) ?? [];
      bucket.push(s);
      symptomsByDate.set(dateKey, bucket);
    }

    // Group doses by date
    const dosesByDate = new Map<string, DoseLog[]>();
    for (const d of allDoses) {
      const dateKey = toLocalDateStr(d.scheduledAt);
      const bucket = dosesByDate.get(dateKey) ?? [];
      bucket.push(d);
      dosesByDate.set(dateKey, bucket);
    }

    // Derive medication changes (started/stopped) within range window
    const rangeStart = new Date();
    rangeStart.setDate(rangeStart.getDate() - selectedRange);
    const changesByDate = new Map<string, MedicationChange[]>();

    for (const med of medications) {
      if (med.startedAt !== undefined) {
        const startDate = toLocalDateStr(med.startedAt);
        const d = new Date(`${startDate}T00:00:00`);
        if (d >= rangeStart) {
          const bucket = changesByDate.get(startDate) ?? [];
          bucket.push({
            type: 'started',
            medicationName: med.name,
            medicationId: med.id,
          });
          changesByDate.set(startDate, bucket);
        }
      }
      if (med.endedAt !== undefined) {
        const endDate = toLocalDateStr(med.endedAt);
        const d = new Date(`${endDate}T00:00:00`);
        if (d >= rangeStart) {
          const bucket = changesByDate.get(endDate) ?? [];
          bucket.push({
            type: 'stopped',
            medicationName: med.name,
            medicationId: med.id,
          });
          changesByDate.set(endDate, bucket);
        }
      }
    }

    return dateRange.map((date) => ({
      date,
      symptoms: symptomsByDate.get(date) ?? [],
      doses: dosesByDate.get(date) ?? [],
      medicationChanges: changesByDate.get(date) ?? [],
    }));
  }, [symptoms, allDoses, medications, selectedRange]);

  // ---------------------------------------------------------------------------
  // Build pattern cards (memoised)
  // ---------------------------------------------------------------------------

  const patterns = useMemo<PatternData[]>(() => {
    const entries = Object.entries(frequencyReport);
    if (entries.length === 0) return [];

    return entries
      .sort(([, a], [, b]) => b - a) // most frequent first
      .slice(0, 5) // cap at 5 pattern cards
      .map(([tag, count]) => {
        // Compute average severity for this tag
        const relevantSymptoms = symptoms.filter((s) => s.symptoms.includes(tag));
        const avgSeverity =
          relevantSymptoms.length > 0
            ? relevantSymptoms.reduce((sum, s) => sum + s.severity, 0) /
              relevantSymptoms.length
            : 5;

        const trend = computeTrend(tag, dayBuckets);
        const correlatedMedication = detectCorrelation(tag, dayBuckets, medications);

        return {
          tag,
          occurrences: count,
          dayWindow: selectedRange,
          frequency: count / selectedRange,
          avgSeverity,
          trend,
          correlatedMedication,
        };
      });
  }, [frequencyReport, symptoms, dayBuckets, medications, selectedRange]);

  const isLoading = isLoadingSymptoms || isLoadingDoses;
  const hasAnyData = symptoms.length > 0 || allDoses.length > 0;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView className="flex-1 bg-neutral-50">
      {/* Header */}
      <View className="px-4 pt-2 pb-4 flex-row items-center">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          className="mr-3 w-11 h-11 items-center justify-center rounded-full bg-neutral-100"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text className="text-neutral-700 text-lg" accessibilityElementsHidden>
            ←
          </Text>
        </Pressable>
        <View className="flex-1">
          <Text
            className="text-neutral-800 text-2xl font-bold"
            allowFontScaling
            accessibilityRole="header"
          >
            {t('symptoms.timelineTitle')}
          </Text>
          <Text className="text-neutral-400 text-sm mt-0.5" allowFontScaling>
            {t('symptoms.timelineSubtitle')}
          </Text>
        </View>

        {/* Share with Doctor placeholder */}
        <Pressable
          onPress={() =>
            Alert.alert(
              t('symptoms.shareTitle'),
              t('symptoms.shareComingSoon')
            )
          }
          accessibilityRole="button"
          accessibilityLabel={t('symptoms.shareWithDoctor')}
          className="w-11 h-11 items-center justify-center rounded-full bg-brand-50"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text className="text-brand-600 text-lg" accessibilityElementsHidden>
            ↑
          </Text>
        </Pressable>
      </View>

      {/* Range selector */}
      <RangeSelector selected={selectedRange} onSelect={handleRangeChange} />

      {/* Loading state */}
      {isLoading && !hasAnyData && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#14B8A6" />
          <Text
            className="text-neutral-400 text-sm mt-3"
            allowFontScaling
            accessibilityLiveRegion="polite"
          >
            {t('common.loading')}
          </Text>
        </View>
      )}

      {/* Content */}
      {(!isLoading || hasAnyData) && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {/* Pattern cards section */}
          {patterns.length > 0 && (
            <View className="mb-2">
              <Text
                className="text-neutral-700 text-base font-semibold px-4 mb-3"
                allowFontScaling
                accessibilityRole="header"
              >
                {t('symptoms.patternsTitle')}
              </Text>
              <View className="px-4">
                {patterns.map((p) => (
                  <PatternCard
                    key={p.tag}
                    symptomLabel={t(`symptoms.tag_${p.tag}`, { defaultValue: p.tag })}
                    occurrences={p.occurrences}
                    dayWindow={p.dayWindow}
                    frequency={p.frequency}
                    avgSeverity={p.avgSeverity}
                    trend={p.trend}
                    correlatedMedication={p.correlatedMedication}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Timeline section header */}
          <Text
            className="text-neutral-700 text-base font-semibold px-4 mb-3"
            allowFontScaling
            accessibilityRole="header"
          >
            {t('symptoms.timelineListTitle')}
          </Text>

          {/* Empty state */}
          {!isLoading && !hasAnyData && (
            <View className="items-center px-8 py-12">
              <Text
                className="text-neutral-800 text-xl font-bold text-center mb-2"
                allowFontScaling
                accessibilityRole="header"
              >
                {t('symptoms.timelineEmptyTitle')}
              </Text>
              <Text
                className="text-neutral-400 text-base text-center leading-6"
                allowFontScaling
              >
                {t('symptoms.timelineEmptyMessage')}
              </Text>
            </View>
          )}

          {/* Timeline days */}
          {dayBuckets.map((bucket) => (
            <TimelineDay
              key={bucket.date}
              date={bucket.date}
              symptoms={bucket.symptoms}
              doses={bucket.doses}
              medicationChanges={bucket.medicationChanges}
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
