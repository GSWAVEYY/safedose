/**
 * Onboarding Flow — 4 screens
 *
 * Horizontal ScrollView pager with Reanimated-driven dot indicators,
 * parallax icon effect, and spring press animations.
 *
 * Progress persists via expo-secure-store so onboarding never re-appears.
 *
 * Flow:
 *   Screen 1 (Value Prop) → Screen 2 (First Medication) →
 *   Screen 3 (Set a Reminder) → Screen 4 (Invite Caregiver) → Main App
 *
 * Screens 2-4 have a "Skip" affordance. Completing or skipping any screen
 * sets the ONBOARDING_COMPLETE flag and navigates to /(tabs)/medications.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useTranslation } from 'react-i18next';
import {
  Bell,
  ClipboardList,
  Heart,
  Shield,
} from 'lucide-react-native';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ONBOARDING_KEY = 'safedose_onboarding_complete';
const TOTAL_STEPS = 4;

// Brand teal color — matches brand-600 in tailwind.config.js
const BRAND_600 = '#0D9488';
const BRAND_100 = '#CCFBF1';

// Spring config for press feedback
const PRESS_SPRING = { damping: 15, stiffness: 200 };

// ---------------------------------------------------------------------------
// Completion logic (preserved exactly from original)
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
// Spring press button
// ---------------------------------------------------------------------------

interface SpringButtonProps {
  onPress: () => void;
  accessibilityLabel: string;
  className?: string;
  style?: object;
  children: React.ReactNode;
  pulse?: boolean;
}

function SpringButton({
  onPress,
  accessibilityLabel,
  className = '',
  style,
  children,
  pulse = false,
}: SpringButtonProps) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!pulse) return;
    scale.value = withRepeat(
      withSequence(
        withTiming(1.02, { duration: 900 }),
        withTiming(1.0, { duration: 900 }),
      ),
      -1,
      false,
    );
  }, [pulse, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          scale.value = withSpring(0.96, PRESS_SPRING);
        }}
        onPressOut={() => {
          scale.value = withSpring(1.0, PRESS_SPRING);
        }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={[{ minHeight: 56 }, style]}
        className={`bg-brand-600 rounded-2xl items-center justify-center shadow-sm ${className}`}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Animated dot indicators
// ---------------------------------------------------------------------------

interface DotIndicatorsProps {
  scrollX: Animated.SharedValue<number>;
  pageWidth: number;
}

function DotIndicators({ scrollX, pageWidth }: DotIndicatorsProps) {
  return (
    <View
      className="flex-row items-center justify-center gap-2"
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: TOTAL_STEPS - 1, now: 0 }}
      accessibilityLabel={`Onboarding progress`}
    >
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const dotStyle = useAnimatedStyle(() => {
          const inputRange = [
            (i - 1) * pageWidth,
            i * pageWidth,
            (i + 1) * pageWidth,
          ];

          const width = interpolate(
            scrollX.value,
            inputRange,
            [10, 24, 10],
            Extrapolation.CLAMP,
          );

          const opacity = interpolate(
            scrollX.value,
            inputRange,
            [0.4, 1, 0.4],
            Extrapolation.CLAMP,
          );

          return { width, opacity };
        });

        return (
          <Animated.View
            key={i}
            style={[dotStyle, { height: 10, borderRadius: 5 }]}
            className="bg-brand-600"
            aria-hidden={true}
          />
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Animated page wrapper — applies parallax to icon, fade to text
// ---------------------------------------------------------------------------

interface PageAnimations {
  scrollX: Animated.SharedValue<number>;
  index: number;
  pageWidth: number;
}

function usePageAnimations({ scrollX, index, pageWidth }: PageAnimations) {
  const iconParallaxStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      scrollX.value,
      [(index - 1) * pageWidth, index * pageWidth, (index + 1) * pageWidth],
      [-pageWidth * 0.3, 0, pageWidth * 0.3],
      Extrapolation.CLAMP,
    );
    return { transform: [{ translateX }] };
  });

  const textFadeStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollX.value,
      [(index - 0.5) * pageWidth, index * pageWidth, (index + 0.5) * pageWidth],
      [0, 1, 0],
      Extrapolation.CLAMP,
    );
    return { opacity };
  });

  return { iconParallaxStyle, textFadeStyle };
}

// ---------------------------------------------------------------------------
// Page 1 — Value Proposition
// ---------------------------------------------------------------------------

interface Page1Props {
  scrollX: Animated.SharedValue<number>;
  pageWidth: number;
  onNext: () => void;
}

function Page1ValueProp({ scrollX, pageWidth, onNext }: Page1Props) {
  const { t } = useTranslation();
  const { iconParallaxStyle, textFadeStyle } = usePageAnimations({
    scrollX,
    index: 0,
    pageWidth,
  });

  return (
    <View style={{ width: pageWidth }} className="flex-1 px-6">
      {/* Icon area */}
      <View className="flex-1 items-center justify-center">
        <Animated.View style={iconParallaxStyle} className="items-center mb-10">
          <View
            style={{
              width: 140,
              height: 140,
              borderRadius: 70,
              backgroundColor: BRAND_600,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: BRAND_600,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.35,
              shadowRadius: 20,
              elevation: 10,
            }}
            accessibilityRole="image"
            accessibilityLabel="SafeDose logo — shield icon"
          >
            <Shield
              size={80}
              color="#ffffff"
              strokeWidth={1.5}
              aria-hidden={true}
            />
          </View>
        </Animated.View>

        <Animated.View style={textFadeStyle} className="items-center">
          <Text className="text-3xl font-black text-neutral-900 tracking-tight text-center mb-3">
            SafeDose
          </Text>

          <Text
            className="text-2xl font-bold text-neutral-900 text-center mb-4 leading-tight"
            accessibilityRole="header"
          >
            {t('onboarding.step1Headline')}
          </Text>

          <Text className="text-lg text-neutral-500 text-center leading-relaxed px-2">
            {t('onboarding.step1Subtext')}
          </Text>
        </Animated.View>
      </View>

      {/* CTA */}
      <View className="pb-4">
        <SpringButton
          onPress={onNext}
          accessibilityLabel={t('onboarding.getStarted')}
          pulse
        >
          <Text className="text-white font-bold text-lg">
            {t('onboarding.getStarted')}
          </Text>
        </SpringButton>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Page 2 — Add First Medication
// ---------------------------------------------------------------------------

interface Page2Props {
  scrollX: Animated.SharedValue<number>;
  pageWidth: number;
  onSkip: () => void;
}

function Page2AddMedication({ scrollX, pageWidth, onSkip }: Page2Props) {
  const { t } = useTranslation();
  const { iconParallaxStyle, textFadeStyle } = usePageAnimations({
    scrollX,
    index: 1,
    pageWidth,
  });

  function handleEnterManually() {
    router.push('/(tabs)/medications');
    void markOnboardingComplete();
  }

  return (
    <View style={{ width: pageWidth }} className="flex-1 px-6">
      <View className="flex-1 justify-center">
        {/* Icon */}
        <Animated.View style={iconParallaxStyle} className="items-center mb-10">
          <View
            style={{
              width: 140,
              height: 140,
              borderRadius: 70,
              backgroundColor: BRAND_100,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            accessibilityRole="image"
            accessibilityLabel="Medication list illustration"
          >
            <ClipboardList
              size={80}
              color={BRAND_600}
              strokeWidth={1.5}
              aria-hidden={true}
            />
          </View>
        </Animated.View>

        {/* Text */}
        <Animated.View style={textFadeStyle} className="items-center mb-8">
          <Text
            className="text-2xl font-bold text-neutral-900 text-center mb-3 leading-tight"
            accessibilityRole="header"
          >
            {t('onboarding.step2Headline')}
          </Text>
          <Text className="text-lg text-neutral-500 text-center leading-relaxed">
            {t('onboarding.step2Subtext')}
          </Text>
        </Animated.View>

        {/* CTA cards */}
        <View className="gap-4">
          {/* Scan bottle — coming soon (disabled) */}
          <View
            className="flex-row items-center gap-4 p-5 rounded-2xl bg-neutral-100 border border-neutral-200 opacity-60"
            accessibilityRole="none"
            accessibilityLabel={t('medications.scanBottleComingSoon')}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                backgroundColor: BRAND_100,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ClipboardList size={24} color={BRAND_600} strokeWidth={1.5} aria-hidden={true} />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-neutral-600">
                {t('medications.scanBottleComingSoon')}
              </Text>
              <Text className="text-sm text-neutral-400 mt-0.5">
                {t('onboarding.comingSoon')}
              </Text>
            </View>
          </View>

          {/* Enter manually */}
          <SpringButton
            onPress={handleEnterManually}
            accessibilityLabel={t('onboarding.enterManually')}
            className="flex-row gap-4 px-5"
            style={{ minHeight: 72 }}
          >
            <View className="flex-1">
              <Text className="text-base font-bold text-white text-left">
                {t('onboarding.enterManually')}
              </Text>
              <Text className="text-sm text-brand-100 mt-0.5 text-left">
                {t('onboarding.enterManuallySubtext')}
              </Text>
            </View>
            <Text className="text-white text-2xl font-light" aria-hidden={true}>›</Text>
          </SpringButton>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Page 3 — Set a Reminder
// ---------------------------------------------------------------------------

interface Page3Props {
  scrollX: Animated.SharedValue<number>;
  pageWidth: number;
  onSkip: () => void;
}

function Page3SetReminder({ scrollX, pageWidth }: Omit<Page3Props, 'onSkip'>) {
  const { t } = useTranslation();
  const { iconParallaxStyle, textFadeStyle } = usePageAnimations({
    scrollX,
    index: 2,
    pageWidth,
  });

  function handleSetupReminders() {
    router.push('/(tabs)/schedule');
    void markOnboardingComplete();
  }

  return (
    <View style={{ width: pageWidth }} className="flex-1 px-6">
      <View className="flex-1 justify-center">
        {/* Icon */}
        <Animated.View style={iconParallaxStyle} className="items-center mb-10">
          <View
            style={{
              width: 140,
              height: 140,
              borderRadius: 70,
              backgroundColor: BRAND_100,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            accessibilityRole="image"
            accessibilityLabel="Reminder bell illustration"
          >
            <Bell
              size={80}
              color={BRAND_600}
              strokeWidth={1.5}
              aria-hidden={true}
            />
          </View>
        </Animated.View>

        {/* Text */}
        <Animated.View style={textFadeStyle} className="items-center mb-10">
          <Text
            className="text-2xl font-bold text-neutral-900 text-center mb-3 leading-tight"
            accessibilityRole="header"
          >
            {t('onboarding.step3Headline')}
          </Text>
          <Text className="text-lg text-neutral-500 text-center leading-relaxed">
            {t('onboarding.step3Subtext')}
          </Text>
        </Animated.View>
      </View>

      {/* CTA */}
      <View className="pb-4">
        <SpringButton
          onPress={handleSetupReminders}
          accessibilityLabel={t('onboarding.setupReminders')}
        >
          <Text className="text-white font-bold text-lg">
            {t('onboarding.setupReminders')}
          </Text>
        </SpringButton>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Page 4 — Invite Caregiver
// ---------------------------------------------------------------------------

interface Page4Props {
  scrollX: Animated.SharedValue<number>;
  pageWidth: number;
  onFinish: () => void;
}

function Page4InviteCaregiver({ scrollX, pageWidth, onFinish }: Page4Props) {
  const { t } = useTranslation();
  const { iconParallaxStyle, textFadeStyle } = usePageAnimations({
    scrollX,
    index: 3,
    pageWidth,
  });

  return (
    <View style={{ width: pageWidth }} className="flex-1 px-6">
      <View className="flex-1 justify-center">
        {/* Icon */}
        <Animated.View style={iconParallaxStyle} className="items-center mb-10">
          <View
            style={{
              width: 140,
              height: 140,
              borderRadius: 70,
              backgroundColor: BRAND_100,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            accessibilityRole="image"
            accessibilityLabel="Care team illustration"
          >
            <Heart
              size={80}
              color={BRAND_600}
              strokeWidth={1.5}
              aria-hidden={true}
            />
          </View>
        </Animated.View>

        {/* Text */}
        <Animated.View style={textFadeStyle} className="items-center mb-10">
          <Text
            className="text-2xl font-bold text-neutral-900 text-center mb-3 leading-tight"
            accessibilityRole="header"
          >
            {t('onboarding.step4Headline')}
          </Text>
          <Text className="text-lg text-neutral-500 text-center leading-relaxed">
            {t('onboarding.step4Subtext')}
          </Text>
        </Animated.View>
      </View>

      {/* CTAs */}
      <View className="pb-4 gap-3">
        <SpringButton
          onPress={() => void markOnboardingComplete().then(onFinish)}
          accessibilityLabel={t('onboarding.inviteCaregiver')}
        >
          <Text className="text-white font-bold text-lg">
            {t('onboarding.inviteCaregiver')}
          </Text>
        </SpringButton>

        <Pressable
          onPress={() => void markOnboardingComplete().then(onFinish)}
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.maybeLater')}
          style={{ minHeight: 48 }}
          className="items-center justify-center"
        >
          <Text className="text-base text-neutral-500 font-medium">
            {t('onboarding.maybeLater')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Root orchestrator — horizontal pager
// ---------------------------------------------------------------------------

export default function OnboardingScreen() {
  const { width: pageWidth } = useWindowDimensions();
  const { t } = useTranslation();
  const scrollX = useSharedValue(0);
  const scrollRef = useRef<ScrollView>(null);

  // Derived current page for the skip button
  const currentPageRef = useRef(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const scrollToPage = useCallback(
    (page: number) => {
      scrollRef.current?.scrollTo({ x: page * pageWidth, animated: true });
      currentPageRef.current = page;
    },
    [pageWidth],
  );

  const handleNext = useCallback(() => {
    const next = Math.min(currentPageRef.current + 1, TOTAL_STEPS - 1);
    scrollToPage(next);
  }, [scrollToPage]);

  const handleSkip = useCallback(async () => {
    await markOnboardingComplete();
    router.replace('/(tabs)/medications');
  }, []);

  const handleFinish = useCallback(() => {
    router.replace('/(tabs)/medications');
  }, []);

  // Animated style to show/hide the skip button based on scroll position
  const skipStyle = useAnimatedStyle(() => {
    // Show skip on pages 1-3 (hide on page 0 and last page)
    const opacity = interpolate(
      scrollX.value,
      [0, pageWidth * 0.5, pageWidth * 2.5, pageWidth * 3],
      [0, 1, 1, 0],
      Extrapolation.CLAMP,
    );
    return { opacity };
  });

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Top bar — skip affordance */}
      <View
        className="flex-row items-center justify-end px-6 pt-2 pb-1"
        style={{ minHeight: 48 }}
      >
        <Animated.View style={skipStyle}>
          <Pressable
            onPress={handleSkip}
            accessibilityRole="button"
            accessibilityLabel={t('onboarding.skip')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text className="text-base text-neutral-500 font-medium">
              {t('onboarding.skip')}
            </Text>
          </Pressable>
        </Animated.View>
      </View>

      {/* Pager */}
      <Animated.ScrollView
        ref={scrollRef as React.RefObject<Animated.ScrollView>}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={scrollHandler}
        onMomentumScrollEnd={(e) => {
          currentPageRef.current = Math.round(
            e.nativeEvent.contentOffset.x / pageWidth,
          );
        }}
        className="flex-1"
      >
        <Page1ValueProp
          scrollX={scrollX}
          pageWidth={pageWidth}
          onNext={handleNext}
        />
        <Page2AddMedication
          scrollX={scrollX}
          pageWidth={pageWidth}
          onSkip={handleSkip}
        />
        <Page3SetReminder
          scrollX={scrollX}
          pageWidth={pageWidth}
          onSkip={handleSkip}
        />
        <Page4InviteCaregiver
          scrollX={scrollX}
          pageWidth={pageWidth}
          onFinish={handleFinish}
        />
      </Animated.ScrollView>

      {/* Dot indicators */}
      <View className="pb-8 pt-4">
        <DotIndicators scrollX={scrollX} pageWidth={pageWidth} />
      </View>
    </SafeAreaView>
  );
}
