/**
 * Symptom Log Screen — "How are you feeling?"
 *
 * Features:
 *   - Symptom tag chips (multi-select, 15 common symptom types)
 *   - Severity slider (1-10, colour-coded)
 *   - Optional notes text input
 *   - "Log Symptoms" save button with loading + error states
 *   - Recent 7-day history list below the form
 *
 * Navigated to from the Schedule tab index via "Log Symptoms" button.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useSymptomsStore } from '../../../store/symptoms';
import { SymptomChip } from '../../../components/symptoms/SymptomChip';
import { SeveritySlider } from '../../../components/symptoms/SeveritySlider';

// ---------------------------------------------------------------------------
// Symptom tag catalogue
// ---------------------------------------------------------------------------

const SYMPTOM_TAGS = [
  'headache',
  'nausea',
  'dizziness',
  'fatigue',
  'stomach_pain',
  'back_pain',
  'joint_pain',
  'shortness_of_breath',
  'chest_pain',
  'anxiety',
  'insomnia',
  'dry_mouth',
  'rash',
  'swelling',
  'blurred_vision',
] as const;

type SymptomTag = (typeof SYMPTOM_TAGS)[number];

// ---------------------------------------------------------------------------
// Recent history item
// ---------------------------------------------------------------------------

interface HistoryItemProps {
  reportedAt: string;
  tags: string[];
  severity: number;
  notes?: string;
}

function HistoryItem({ reportedAt, tags, severity, notes }: HistoryItemProps) {
  const { t } = useTranslation();

  const severityColor =
    severity <= 3
      ? '#16A34A'
      : severity <= 6
      ? '#CA8A04'
      : severity <= 8
      ? '#EA580C'
      : '#DC2626';

  const dateStr = new Date(reportedAt).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View className="bg-white rounded-xl p-4 mb-2 shadow-sm">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-neutral-500 text-xs" allowFontScaling>
          {dateStr}
        </Text>
        <View
          className="rounded-full px-2.5 py-0.5"
          style={{ backgroundColor: `${severityColor}20` }}
        >
          <Text
            className="text-xs font-semibold"
            style={{ color: severityColor }}
            allowFontScaling
          >
            {t('symptoms.severityShort', { value: severity })}
          </Text>
        </View>
      </View>
      <View className="flex-row flex-wrap">
        {tags.map((tag) => (
          <View
            key={tag}
            className="bg-brand-50 rounded-full px-2.5 py-0.5 mr-1.5 mb-1"
          >
            <Text className="text-brand-700 text-xs font-medium" allowFontScaling>
              {tag}
            </Text>
          </View>
        ))}
      </View>
      {notes !== undefined && notes.trim().length > 0 && (
        <Text className="text-neutral-500 text-sm mt-2 leading-5" allowFontScaling>
          {notes}
        </Text>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function SymptomsScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const { symptoms, isLoading, error, logSymptom, loadSymptomHistory, clearError } =
    useSymptomsStore();

  // Form state
  const [selectedTags, setSelectedTags] = useState<Set<SymptomTag>>(new Set());
  const [severity, setSeverity] = useState(5);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Load recent history on focus
  useFocusEffect(
    useCallback(() => {
      void loadSymptomHistory(7);
    }, [loadSymptomHistory])
  );

  // Clear store error when this screen unmounts
  useEffect(() => {
    return () => {
      clearError();
    };
  }, [clearError]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const toggleTag = useCallback((tag: SymptomTag) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (selectedTags.size === 0) {
      Alert.alert(
        t('symptoms.noTagsTitle'),
        t('symptoms.noTagsMessage')
      );
      return;
    }

    setIsSaving(true);
    try {
      await logSymptom({
        symptoms: Array.from(selectedTags),
        severity,
        notes: notes.trim().length > 0 ? notes.trim() : undefined,
      });
      // Reset form after successful save
      setSelectedTags(new Set());
      setSeverity(5);
      setNotes('');
    } catch {
      Alert.alert(t('common.error'), t('symptoms.logFailed'));
    } finally {
      setIsSaving(false);
    }
  }, [selectedTags, severity, notes, logSymptom, t]);

  const handleViewTimeline = useCallback(() => {
    router.push('/(tabs)/schedule/timeline');
  }, [router]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView className="flex-1 bg-neutral-50">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
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
                {t('symptoms.howAreYouFeeling')}
              </Text>
              <Text className="text-neutral-400 text-sm mt-0.5" allowFontScaling>
                {t('symptoms.selectAllThatApply')}
              </Text>
            </View>
          </View>

          {/* Symptom chips */}
          <View className="mx-4 bg-white rounded-2xl p-4 mb-4 shadow-sm">
            <Text
              className="text-neutral-700 text-base font-semibold mb-3"
              allowFontScaling
              accessibilityRole="header"
            >
              {t('symptoms.symptomsLabel')}
            </Text>
            <View className="flex-row flex-wrap">
              {SYMPTOM_TAGS.map((tag) => (
                <SymptomChip
                  key={tag}
                  label={t(`symptoms.tag_${tag}`, { defaultValue: tag })}
                  selected={selectedTags.has(tag)}
                  onPress={() => toggleTag(tag)}
                  accessibilityLabel={t('symptoms.tagAccessibility', { tag })}
                />
              ))}
            </View>
          </View>

          {/* Severity slider */}
          <View className="mx-4 bg-white rounded-2xl p-4 mb-4 shadow-sm">
            <Text
              className="text-neutral-700 text-base font-semibold mb-3"
              allowFontScaling
              accessibilityRole="header"
            >
              {t('symptoms.severityLabel')}
            </Text>
            <SeveritySlider value={severity} onChange={setSeverity} />
          </View>

          {/* Notes */}
          <View className="mx-4 bg-white rounded-2xl p-4 mb-4 shadow-sm">
            <Text
              className="text-neutral-700 text-base font-semibold mb-2"
              allowFontScaling
              accessibilityRole="header"
            >
              {t('symptoms.notesLabel')}
            </Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder={t('symptoms.notesPlaceholder')}
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={3}
              className="text-neutral-700 text-base leading-6 min-h-[72px]"
              style={{ textAlignVertical: 'top' }}
              accessibilityLabel={t('symptoms.notesAccessibilityLabel')}
              allowFontScaling
            />
          </View>

          {/* Save button */}
          <Pressable
            onPress={() => void handleSave()}
            disabled={isSaving || selectedTags.size === 0}
            accessibilityRole="button"
            accessibilityLabel={t('symptoms.logButton')}
            accessibilityState={{ disabled: isSaving || selectedTags.size === 0 }}
            className={[
              'mx-4 rounded-2xl py-4 items-center mb-3',
              isSaving || selectedTags.size === 0
                ? 'bg-neutral-200'
                : 'bg-brand-500',
            ].join(' ')}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
          >
            {isSaving ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text
                className={[
                  'text-base font-semibold',
                  isSaving || selectedTags.size === 0
                    ? 'text-neutral-400'
                    : 'text-white',
                ].join(' ')}
                allowFontScaling
              >
                {t('symptoms.logButton')}
              </Text>
            )}
          </Pressable>

          {/* View timeline link */}
          <Pressable
            onPress={handleViewTimeline}
            accessibilityRole="button"
            accessibilityLabel={t('symptoms.viewTimelineButton')}
            className="mx-4 rounded-2xl py-4 items-center mb-6 border border-brand-200 bg-brand-50"
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
          >
            <Text className="text-brand-600 text-base font-semibold" allowFontScaling>
              {t('symptoms.viewTimelineButton')}
            </Text>
          </Pressable>

          {/* Error state */}
          {error !== null && (
            <View className="mx-4 mb-4 bg-amber-50 rounded-xl px-4 py-3">
              <Text className="text-amber-700 text-sm font-medium" allowFontScaling>
                {error}
              </Text>
              <Pressable
                onPress={clearError}
                accessibilityRole="button"
                accessibilityLabel={t('common.retry')}
              >
                <Text className="text-brand-600 text-sm mt-1" allowFontScaling>
                  {t('common.retry')}
                </Text>
              </Pressable>
            </View>
          )}

          {/* Recent history */}
          <View className="px-4">
            <Text
              className="text-neutral-700 text-base font-semibold mb-3"
              allowFontScaling
              accessibilityRole="header"
            >
              {t('symptoms.recentHistory')}
            </Text>

            {isLoading && symptoms.length === 0 && (
              <View className="items-center py-8">
                <ActivityIndicator color="#14B8A6" size="small" />
              </View>
            )}

            {!isLoading && symptoms.length === 0 && (
              <View className="items-center py-8">
                <Text className="text-neutral-400 text-base text-center" allowFontScaling>
                  {t('symptoms.noRecentHistory')}
                </Text>
              </View>
            )}

            {symptoms.map((s) => (
              <HistoryItem
                key={s.id}
                reportedAt={s.reportedAt}
                tags={s.symptoms}
                severity={s.severity}
                notes={s.notes}
              />
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
