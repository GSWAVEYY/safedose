/**
 * WellnessScreen — Caregiver Burnout Prevention
 *
 * Presents the PHQ-2 screener (validated 2-question depression instrument)
 * plus additional wellness signals (sleep, stress, respite). After submission
 * the user sees a warm, supportive risk assessment.
 *
 * IMPORTANT CLINICAL NOTES:
 * - PHQ-2 wording is used verbatim per the validated instrument.
 * - PHQ-2 score >= 3: suggest PHQ-9 full screening (provide link, don't administer).
 * - PHQ-2 score >= 5: show 988 Suicide & Crisis Lifeline prominently.
 * - This screen is NOT a diagnostic tool — include disclaimer on results.
 * - Data stays on device; never synced to server.
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useWellnessStore } from '../../../store/wellness';
import type { BurnoutRiskLevel, BurnoutRiskResult } from '../../../lib/db/wellness';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ScreenState = 'form' | 'result';

// PHQ-2 response options (validated wording — do not modify)
const PHQ2_OPTIONS: { label: string; value: number }[] = [
  { label: 'Not at all', value: 0 },
  { label: 'Several days', value: 1 },
  { label: 'More than half the days', value: 2 },
  { label: 'Nearly every day', value: 3 },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionHeader({ text }: { text: string }) {
  return (
    <Text className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 mt-6">
      {text}
    </Text>
  );
}

interface Phq2QuestionProps {
  question: string;
  selected: number | null;
  onSelect: (value: number) => void;
}

function Phq2Question({ question, selected, onSelect }: Phq2QuestionProps) {
  return (
    <View className="mb-5">
      <Text className="text-sm font-medium text-slate-700 leading-5 mb-3">{question}</Text>
      {PHQ2_OPTIONS.map((opt) => (
        <Pressable
          key={opt.value}
          onPress={() => onSelect(opt.value)}
          accessible
          accessibilityRole="radio"
          accessibilityState={{ checked: selected === opt.value }}
          accessibilityLabel={opt.label}
          className={`flex-row items-center rounded-xl px-4 py-3 mb-2 border ${
            selected === opt.value
              ? 'bg-teal-50 border-teal-400'
              : 'bg-white border-slate-200'
          }`}
        >
          <View
            className={`w-5 h-5 rounded-full border-2 mr-3 items-center justify-center ${
              selected === opt.value ? 'border-teal-500' : 'border-slate-300'
            }`}
          >
            {selected === opt.value && (
              <View className="w-2.5 h-2.5 rounded-full bg-teal-500" />
            )}
          </View>
          <Text
            className={`text-sm flex-1 ${
              selected === opt.value ? 'text-teal-700 font-medium' : 'text-slate-600'
            }`}
          >
            {opt.label}
          </Text>
          <Text className="text-xs text-slate-400 ml-2">{opt.value}</Text>
        </Pressable>
      ))}
    </View>
  );
}

interface StarRatingProps {
  label: string;
  lowLabel: string;
  highLabel: string;
  value: number | null;
  onChange: (value: number) => void;
  count?: number;
}

function StarRating({ label, lowLabel, highLabel, value, onChange, count = 5 }: StarRatingProps) {
  return (
    <View className="mb-5">
      <Text className="text-sm font-medium text-slate-700 mb-3">{label}</Text>
      <View className="flex-row items-center gap-2">
        <Text className="text-xs text-slate-400 w-16">{lowLabel}</Text>
        <View className="flex-row gap-2 flex-1 justify-center">
          {Array.from({ length: count }, (_, i) => i + 1).map((star) => (
            <Pressable
              key={star}
              onPress={() => onChange(star)}
              accessible
              accessibilityRole="radio"
              accessibilityState={{ checked: value === star }}
              accessibilityLabel={`${star} out of ${count}`}
              className={`w-10 h-10 rounded-xl items-center justify-center border ${
                value === star
                  ? 'bg-teal-500 border-teal-500'
                  : value !== null && star <= value
                  ? 'bg-teal-100 border-teal-200'
                  : 'bg-white border-slate-200'
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  value === star ? 'text-white' : 'text-slate-500'
                }`}
              >
                {star}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text className="text-xs text-slate-400 w-16 text-right">{highLabel}</Text>
      </View>
    </View>
  );
}

interface YesNoProps {
  label: string;
  value: boolean | null;
  onChange: (value: boolean) => void;
}

function YesNo({ label, value, onChange }: YesNoProps) {
  return (
    <View className="mb-5">
      <Text className="text-sm font-medium text-slate-700 mb-3">{label}</Text>
      <View className="flex-row gap-3">
        {[
          { label: 'Yes', value: true },
          { label: 'No', value: false },
        ].map((opt) => (
          <Pressable
            key={String(opt.value)}
            onPress={() => onChange(opt.value)}
            accessible
            accessibilityRole="radio"
            accessibilityState={{ checked: value === opt.value }}
            accessibilityLabel={opt.label}
            className={`flex-1 py-3 rounded-xl border items-center ${
              value === opt.value
                ? 'bg-teal-500 border-teal-500'
                : 'bg-white border-slate-200'
            }`}
          >
            <Text
              className={`text-sm font-semibold ${
                value === opt.value ? 'text-white' : 'text-slate-600'
              }`}
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Result screen
// ---------------------------------------------------------------------------

const RISK_CONFIG: Record<
  BurnoutRiskLevel,
  { bg: string; border: string; text: string; label: string }
> = {
  low:      { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', label: 'Low' },
  moderate: { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   label: 'Moderate' },
  high:     { bg: 'bg-orange-50',  border: 'border-orange-200',  text: 'text-orange-700',  label: 'High' },
  critical: { bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700',     label: 'Critical' },
};

const SUPPORTIVE_MESSAGES: Record<BurnoutRiskLevel, string> = {
  low:      "You're doing well. Keep protecting your energy and making space for yourself.",
  moderate: "We see the weight you're carrying. Small moments of rest make a real difference.",
  high:     "Caregiving is one of the hardest things a person can do. You deserve support too — please reach out.",
  critical: "You are not alone. What you're feeling is real, and help is available right now.",
};

interface ResultViewProps {
  risk: BurnoutRiskResult;
  onCheckInAgain: () => void;
  onDone: () => void;
}

function ResultView({ risk, onCheckInAgain, onDone }: ResultViewProps) {
  const config = RISK_CONFIG[risk.level];
  const phq2Score = risk.phq2Score ?? 0;
  const showPHQ9Suggestion = phq2Score >= 3;
  const showCrisisResources = phq2Score >= 5;

  function openLink(url: string) {
    Linking.openURL(url).catch(() => {
      Alert.alert('Could not open link', 'Please visit ' + url + ' manually.');
    });
  }

  function callNumber(phone: string) {
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Could not place call', 'Please call ' + phone + ' manually.');
    });
  }

  return (
    <ScrollView className="flex-1" contentContainerClassName="px-4 pb-10" showsVerticalScrollIndicator={false}>
      {/* Risk level card */}
      <View className={`rounded-2xl border p-5 mt-4 ${config.bg} ${config.border}`}>
        <Text className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">
          Burnout Risk
        </Text>
        <Text className={`text-3xl font-bold mb-1 ${config.text}`}>{config.label}</Text>
        <Text className="text-sm text-slate-600 leading-5">
          {SUPPORTIVE_MESSAGES[risk.level]}
        </Text>
      </View>

      {/* PHQ-2 result callout */}
      {showPHQ9Suggestion && (
        <View className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-4">
          <Text className="text-sm font-semibold text-amber-800 mb-1">
            Consider a fuller check-in
          </Text>
          <Text className="text-sm text-amber-700 leading-5 mb-3">
            Your responses suggest it may help to talk with someone. The PHQ-9 is a brief
            questionnaire that can give you a clearer picture — you can take it with your
            doctor or on your own.
          </Text>
          <Pressable
            onPress={() => openLink('https://www.phqscreeners.com')}
            accessible
            accessibilityRole="link"
            accessibilityLabel="Open PHQ-9 screener"
            className="self-start"
          >
            <Text className="text-sm font-semibold text-amber-700 underline">
              Learn about the PHQ-9 screener
            </Text>
          </Pressable>
        </View>
      )}

      {/* Crisis resources — only shown when PHQ-2 >= 5 */}
      {showCrisisResources && (
        <View className="mt-4 rounded-xl bg-red-50 border border-red-200 p-4">
          <Text className="text-sm font-semibold text-red-800 mb-2">
            You don't have to go through this alone
          </Text>
          <Text className="text-sm text-red-700 leading-4 mb-4">
            If you're feeling overwhelmed, hopeless, or like you can't keep going — please
            reach out. Help is real and available right now.
          </Text>
          <Pressable
            onPress={() => callNumber('988')}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Call 988 Suicide and Crisis Lifeline"
            className="flex-row items-center bg-red-600 rounded-xl px-4 py-3 mb-2"
          >
            <Text className="text-white font-semibold text-sm flex-1">
              988 Suicide & Crisis Lifeline
            </Text>
            <Text className="text-red-200 text-sm">Call or text</Text>
          </Pressable>
        </View>
      )}

      {/* Caregiver support resources — shown for moderate and above */}
      {(risk.level === 'moderate' || risk.level === 'high' || risk.level === 'critical') && (
        <View className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-4">
          <Text className="text-sm font-semibold text-slate-700 mb-3">
            Caregiver Support Resources
          </Text>
          <Pressable
            onPress={() => callNumber('18552277878')}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Call AARP Caregiver Support Line"
            className="flex-row items-center py-2 border-b border-slate-200"
          >
            <View className="flex-1">
              <Text className="text-sm font-medium text-slate-700">AARP Caregiver Support</Text>
              <Text className="text-xs text-slate-500">1-855-227-7878 — Free, confidential</Text>
            </View>
            <Text className="text-teal-600 text-sm font-semibold">Call</Text>
          </Pressable>
          <Pressable
            onPress={() => openLink('https://www.caregiveraction.org')}
            accessible
            accessibilityRole="link"
            accessibilityLabel="Visit Caregiver Action Network website"
            className="flex-row items-center py-2"
          >
            <View className="flex-1">
              <Text className="text-sm font-medium text-slate-700">Caregiver Action Network</Text>
              <Text className="text-xs text-slate-500">caregiveraction.org — Community & education</Text>
            </View>
            <Text className="text-teal-600 text-sm font-semibold">Visit</Text>
          </Pressable>
        </View>
      )}

      {/* Disclaimer */}
      <Text className="text-xs text-slate-400 text-center mt-5 leading-4 px-4">
        This tool is not a diagnostic instrument. It is provided to support your
        self-awareness and well-being. Please consult a qualified healthcare
        professional for any mental health concerns.
      </Text>

      {/* CTA */}
      <Pressable
        onPress={onDone}
        accessible
        accessibilityRole="button"
        accessibilityLabel="Done, return to caregiving screen"
        className="mt-6 bg-teal-600 active:bg-teal-700 rounded-xl py-4 items-center"
      >
        <Text className="text-white font-semibold text-base">Done</Text>
      </Pressable>

      <Pressable
        onPress={onCheckInAgain}
        accessible
        accessibilityRole="button"
        accessibilityLabel="Check in again"
        className="mt-3 py-3 items-center"
      >
        <Text className="text-slate-500 text-sm">Check in again</Text>
      </Pressable>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function WellnessScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { logCheckin, isLoading, error } = useWellnessStore();

  const [screenState, setScreenState] = useState<ScreenState>('form');
  const [result, setResult] = useState<BurnoutRiskResult | null>(null);

  // Form state
  const [phq2Q1, setPhq2Q1] = useState<number | null>(null);
  const [phq2Q2, setPhq2Q2] = useState<number | null>(null);
  const [sleepQuality, setSleepQuality] = useState<number | null>(null);
  const [stressLevel, setStressLevel] = useState<number | null>(null);
  const [hadRespite, setHadRespite] = useState<boolean | null>(null);
  const [notes, setNotes] = useState('');

  const isFormValid = phq2Q1 !== null && phq2Q2 !== null && hadRespite !== null;

  const handleSubmit = useCallback(async () => {
    if (!isFormValid) return;

    try {
      await logCheckin({
        phq2Q1: phq2Q1!,
        phq2Q2: phq2Q2!,
        sleepQuality: sleepQuality ?? undefined,
        stressLevel: stressLevel ?? undefined,
        hadRespiteThisWeek: hadRespite!,
        notes: notes.trim() || undefined,
      });

      // Read the updated risk from the store (logCheckin refreshes it)
      const { burnoutRisk } = useWellnessStore.getState();
      if (burnoutRisk) {
        setResult(burnoutRisk);
        setScreenState('result');
      }
    } catch {
      // Error is surfaced via store.error — no additional handling needed here
    }
  }, [isFormValid, phq2Q1, phq2Q2, sleepQuality, stressLevel, hadRespite, notes, logCheckin]);

  const handleCheckInAgain = useCallback(() => {
    setPhq2Q1(null);
    setPhq2Q2(null);
    setSleepQuality(null);
    setStressLevel(null);
    setHadRespite(null);
    setNotes('');
    setResult(null);
    setScreenState('form');
  }, []);

  const handleDone = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    }
  }, [router]);

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      {/* Header */}
      <View className="flex-row items-center px-4 pt-2 pb-4">
        <Pressable
          onPress={handleDone}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          className="mr-3 p-2 -ml-2"
        >
          <Text className="text-teal-600 text-base font-medium">{t('common.back')}</Text>
        </Pressable>
        <View className="flex-1">
          <Text className="text-xl font-bold text-slate-800">
            {screenState === 'form'
              ? t('wellness.title')
              : t('wellness.resultTitle')}
          </Text>
          {screenState === 'form' && (
            <Text className="text-sm text-slate-500 mt-0.5">{t('wellness.subtitle')}</Text>
          )}
        </View>
      </View>

      {screenState === 'result' && result !== null ? (
        <ResultView
          risk={result}
          onCheckInAgain={handleCheckInAgain}
          onDone={handleDone}
        />
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-4 pb-10"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* PHQ-2 section */}
          <SectionHeader text={t('wellness.phq2Section')} />

          <View className="bg-amber-50 rounded-xl p-3 mb-4 border border-amber-200">
            <Text className="text-xs text-amber-700 leading-4">
              {t('wellness.phq2Context')}
            </Text>
          </View>

          <Phq2Question
            question={t('wellness.phq2Q1')}
            selected={phq2Q1}
            onSelect={setPhq2Q1}
          />

          <Phq2Question
            question={t('wellness.phq2Q2')}
            selected={phq2Q2}
            onSelect={setPhq2Q2}
          />

          {/* Wellness signals */}
          <SectionHeader text={t('wellness.wellnessSection')} />

          <StarRating
            label={t('wellness.sleepLabel')}
            lowLabel={t('wellness.sleepLow')}
            highLabel={t('wellness.sleepHigh')}
            value={sleepQuality}
            onChange={setSleepQuality}
          />

          <StarRating
            label={t('wellness.stressLabel')}
            lowLabel={t('wellness.stressLow')}
            highLabel={t('wellness.stressHigh')}
            value={stressLevel}
            onChange={setStressLevel}
          />

          <YesNo
            label={t('wellness.respiteLabel')}
            value={hadRespite}
            onChange={setHadRespite}
          />

          {/* Optional notes */}
          <SectionHeader text={t('wellness.notesSection')} />
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder={t('wellness.notesPlaceholder')}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            accessible
            accessibilityLabel={t('wellness.notesPlaceholder')}
            className="bg-white border border-slate-200 rounded-xl p-3 text-sm text-slate-700 min-h-[80px]"
            placeholderTextColor="#94a3b8"
          />

          {/* Error display */}
          {error !== null && (
            <View className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3" accessibilityRole="alert">
              <Text className="text-sm text-red-600">{error}</Text>
            </View>
          )}

          {/* Submit */}
          <Pressable
            onPress={handleSubmit}
            disabled={!isFormValid || isLoading}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('wellness.submit')}
            accessibilityState={{ disabled: !isFormValid || isLoading }}
            className={`mt-6 rounded-xl py-4 items-center ${
              isFormValid && !isLoading
                ? 'bg-teal-600 active:bg-teal-700'
                : 'bg-slate-200'
            }`}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text
                className={`font-semibold text-base ${
                  isFormValid ? 'text-white' : 'text-slate-400'
                }`}
              >
                {t('wellness.submit')}
              </Text>
            )}
          </Pressable>

          <Text className="text-xs text-slate-400 text-center mt-4 leading-4 px-4">
            {t('wellness.disclaimer')}
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
