/**
 * Onboarding Flow — 4 screens
 *
 * State-driven step system (not a heavy pager library) to keep bundle lean.
 * Progress persists via expo-secure-store so onboarding never re-appears.
 *
 * Flow:
 *   Screen 1 (Value Prop) → Screen 2 (First Medication) →
 *   Screen 3 (Set a Reminder) → Screen 4 (Invite Caregiver) → Main App
 *
 * Screens 2-4 have a "Skip" affordance. Completing or skipping all screens
 * sets the ONBOARDING_COMPLETE flag and navigates to /(tabs)/medications.
 */

import React, { useCallback, useState } from 'react';
import {
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useTranslation } from 'react-i18next';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ONBOARDING_KEY = 'safedose_onboarding_complete';
const TOTAL_STEPS = 4;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StepProps {
  onNext: () => void;
  onSkip: () => void;
  onFinish: () => void;
}

// ---------------------------------------------------------------------------
// Completion logic
// ---------------------------------------------------------------------------

async function markOnboardingComplete(): Promise<void> {
  try {
    await SecureStore.setItemAsync(ONBOARDING_KEY, 'true');
  } catch {
    // SecureStore failure is non-fatal — worst case onboarding re-appears once
    console.warn('[Onboarding] Failed to persist completion flag');
  }
}

export async function isOnboardingComplete(): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(ONBOARDING_KEY);
    return value === 'true';
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Dot indicators
// ---------------------------------------------------------------------------

interface DotIndicatorsProps {
  total: number;
  current: number;
}

function DotIndicators({ total, current }: DotIndicatorsProps) {
  return (
    <View
      className="flex-row items-center justify-center gap-2"
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total - 1, now: current }}
      accessibilityLabel={`Step ${current + 1} of ${total}`}
    >
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          className={`rounded-full ${
            i === current
              ? 'bg-teal-600 w-6 h-2.5'
              : 'bg-slate-300 w-2.5 h-2.5'
          }`}
          aria-hidden={true}
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Shared layout wrapper for each step
// ---------------------------------------------------------------------------

interface StepLayoutProps {
  children: React.ReactNode;
  step: number;
  showSkip: boolean;
  onSkip: () => void;
}

function StepLayout({ children, step, showSkip, onSkip }: StepLayoutProps) {
  const { t } = useTranslation();

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Top bar */}
      <View className="flex-row items-center justify-end px-6 pt-2 pb-1" style={{ minHeight: 48 }}>
        {showSkip && (
          <Pressable
            onPress={onSkip}
            accessibilityRole="button"
            accessibilityLabel={t('onboarding.skip')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text className="text-base text-slate-500 font-medium">
              {t('onboarding.skip')}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Content */}
      <View className="flex-1 px-6">{children}</View>

      {/* Dot indicators */}
      <View className="pb-8 pt-4">
        <DotIndicators total={TOTAL_STEPS} current={step} />
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Value Proposition
// ---------------------------------------------------------------------------

function StepValueProp({ onNext }: Pick<StepProps, 'onNext'>) {
  const { t } = useTranslation();

  return (
    <StepLayout step={0} showSkip={false} onSkip={() => {}}>
      {/* Logo / Icon area */}
      <View className="flex-1 items-center justify-center">
        <View
          className="w-28 h-28 rounded-3xl bg-teal-600 items-center justify-center mb-8 shadow-lg"
          accessibilityRole="image"
          accessibilityLabel="SafeDose logo"
        >
          <Text className="text-5xl" aria-hidden={true}>💊</Text>
        </View>

        {/* App name */}
        <Text className="text-3xl font-black text-slate-900 tracking-tight text-center mb-3">
          SafeDose
        </Text>

        {/* Headline */}
        <Text
          className="text-2xl font-bold text-slate-800 text-center mb-4 leading-tight"
          accessibilityRole="header"
        >
          {t('onboarding.step1Headline')}
        </Text>

        {/* Subtext */}
        <Text className="text-lg text-slate-500 text-center leading-relaxed px-2">
          {t('onboarding.step1Subtext')}
        </Text>
      </View>

      {/* CTA */}
      <View className="pb-4">
        <Pressable
          onPress={onNext}
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.getStarted')}
          style={{ minHeight: 56 }}
          className="bg-teal-600 rounded-2xl items-center justify-center active:bg-teal-700 shadow-sm"
        >
          <Text className="text-white font-bold text-lg">
            {t('onboarding.getStarted')}
          </Text>
        </Pressable>
      </View>
    </StepLayout>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Add First Medication
// ---------------------------------------------------------------------------

function StepAddMedication({ onSkip }: Pick<StepProps, 'onNext' | 'onSkip'>) {
  const { t } = useTranslation();

  function handleEnterManually() {
    // Navigate to medication add screen and proceed
    router.push('/(tabs)/medications');
    void markOnboardingComplete();
  }

  return (
    <StepLayout step={1} showSkip onSkip={onSkip}>
      <View className="flex-1 justify-center">
        {/* Illustration placeholder */}
        <View
          className="items-center mb-8"
          accessibilityRole="image"
          accessibilityLabel="Medication illustration"
        >
          <Text className="text-7xl" aria-hidden={true}>📋</Text>
        </View>

        {/* Headline */}
        <Text
          className="text-2xl font-bold text-slate-900 text-center mb-3 leading-tight"
          accessibilityRole="header"
        >
          {t('onboarding.step2Headline')}
        </Text>

        {/* Subtext */}
        <Text className="text-lg text-slate-500 text-center mb-8 leading-relaxed">
          {t('onboarding.step2Subtext')}
        </Text>

        {/* CTA cards */}
        <View className="gap-4">
          {/* Scan bottle — coming soon */}
          <View
            className="flex-row items-center gap-4 p-5 rounded-2xl bg-slate-100 border border-slate-200 opacity-60"
            accessibilityRole="none"
            accessibilityLabel={t('medications.scanBottleComingSoon')}
          >
            <Text className="text-3xl" aria-hidden={true}>📸</Text>
            <View className="flex-1">
              <Text className="text-base font-semibold text-slate-600">
                {t('medications.scanBottleComingSoon')}
              </Text>
              <Text className="text-sm text-slate-400 mt-0.5">
                {t('onboarding.comingSoon')}
              </Text>
            </View>
          </View>

          {/* Enter manually */}
          <Pressable
            onPress={handleEnterManually}
            accessibilityRole="button"
            accessibilityLabel={t('onboarding.enterManually')}
            style={{ minHeight: 72 }}
            className="flex-row items-center gap-4 p-5 rounded-2xl bg-teal-50 border-2 border-teal-500 active:bg-teal-100"
          >
            <Text className="text-3xl" aria-hidden={true}>✍️</Text>
            <View className="flex-1">
              <Text className="text-base font-bold text-teal-800">
                {t('onboarding.enterManually')}
              </Text>
              <Text className="text-sm text-teal-600 mt-0.5">
                {t('onboarding.enterManuallySubtext')}
              </Text>
            </View>
            <Text className="text-teal-500 text-xl" aria-hidden={true}>›</Text>
          </Pressable>
        </View>
      </View>
    </StepLayout>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Set a Reminder
// ---------------------------------------------------------------------------

function StepSetReminder({ onSkip }: Pick<StepProps, 'onNext' | 'onSkip'>) {
  const { t } = useTranslation();

  function handleSetupReminders() {
    router.push('/(tabs)/schedule');
    void markOnboardingComplete();
  }

  return (
    <StepLayout step={2} showSkip onSkip={onSkip}>
      <View className="flex-1 justify-center">
        {/* Illustration placeholder */}
        <View
          className="items-center mb-8"
          accessibilityRole="image"
          accessibilityLabel="Reminder illustration"
        >
          <View className="w-40 h-40 rounded-full bg-teal-50 items-center justify-center border-4 border-teal-200">
            <Text className="text-6xl" aria-hidden={true}>⏰</Text>
          </View>
        </View>

        {/* Headline */}
        <Text
          className="text-2xl font-bold text-slate-900 text-center mb-3 leading-tight"
          accessibilityRole="header"
        >
          {t('onboarding.step3Headline')}
        </Text>

        {/* Subtext */}
        <Text className="text-lg text-slate-500 text-center mb-8 leading-relaxed">
          {t('onboarding.step3Subtext')}
        </Text>
      </View>

      {/* CTA */}
      <View className="pb-4 gap-3">
        <Pressable
          onPress={handleSetupReminders}
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.setupReminders')}
          style={{ minHeight: 56 }}
          className="bg-teal-600 rounded-2xl items-center justify-center active:bg-teal-700"
        >
          <Text className="text-white font-bold text-lg">
            {t('onboarding.setupReminders')}
          </Text>
        </Pressable>
      </View>
    </StepLayout>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — Invite Caregiver
// ---------------------------------------------------------------------------

function StepInviteCaregiver({ onFinish }: Pick<StepProps, 'onFinish'>) {
  const { t } = useTranslation();

  return (
    <StepLayout step={3} showSkip={false} onSkip={() => {}}>
      <View className="flex-1 justify-center">
        {/* Illustration placeholder */}
        <View
          className="items-center mb-8"
          accessibilityRole="image"
          accessibilityLabel="Care team illustration"
        >
          <Text className="text-8xl" aria-hidden={true}>🤝</Text>
        </View>

        {/* Headline */}
        <Text
          className="text-2xl font-bold text-slate-900 text-center mb-3 leading-tight"
          accessibilityRole="header"
        >
          {t('onboarding.step4Headline')}
        </Text>

        {/* Subtext */}
        <Text className="text-lg text-slate-500 text-center mb-8 leading-relaxed">
          {t('onboarding.step4Subtext')}
        </Text>
      </View>

      {/* CTAs */}
      <View className="pb-4 gap-3">
        <Pressable
          onPress={() => {
            // Sprint 2: navigate to caregiver invite flow
            void markOnboardingComplete().then(onFinish);
          }}
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.inviteCaregiver')}
          style={{ minHeight: 56 }}
          className="bg-teal-600 rounded-2xl items-center justify-center active:bg-teal-700"
        >
          <Text className="text-white font-bold text-lg">
            {t('onboarding.inviteCaregiver')}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => void markOnboardingComplete().then(onFinish)}
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.maybeLater')}
          style={{ minHeight: 48 }}
          className="items-center justify-center"
        >
          <Text className="text-base text-slate-500 font-medium">
            {t('onboarding.maybeLater')}
          </Text>
        </Pressable>
      </View>
    </StepLayout>
  );
}

// ---------------------------------------------------------------------------
// Root orchestrator
// ---------------------------------------------------------------------------

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);

  const handleNext = useCallback(() => {
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }, []);

  const handleSkip = useCallback(async () => {
    await markOnboardingComplete();
    router.replace('/(tabs)/medications');
  }, []);

  const handleFinish = useCallback(() => {
    router.replace('/(tabs)/medications');
  }, []);

  switch (step) {
    case 0:
      return <StepValueProp onNext={handleNext} />;
    case 1:
      return <StepAddMedication onNext={handleNext} onSkip={handleSkip} />;
    case 2:
      return <StepSetReminder onNext={handleNext} onSkip={handleSkip} />;
    case 3:
      return <StepInviteCaregiver onFinish={handleFinish} />;
    default:
      return <StepValueProp onNext={handleNext} />;
  }
}
