/**
 * Paywall screen — Full-screen subscription tier comparison.
 *
 * Presents Free / Premium / Family tiers with a monthly/annual toggle.
 * No aggressive sales tactics. Healthcare audience — this must feel
 * trustworthy and calm, not like a pushy upgrade wall.
 *
 * Navigation: accessible via router.push('/paywall') from anywhere.
 * Returns to the calling screen on close.
 */

import { useState } from 'react';
import {
  ScrollView,
  Text,
  View,
  Pressable,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSubscriptionStore } from '../store/subscription';
import { TierCard } from '../components/subscriptions/TierCard';
import type { TierCardProps } from '../components/subscriptions/TierCard';
import type { SubscriptionTier, BillingInterval } from '../lib/subscriptions/index';

// ─── Tier definitions ─────────────────────────────────────────────────────────

// All feature rows in the comparison table, in display order.
// Each row has a label key and per-tier availability.
interface FeatureDefinition {
  labelKey: string;
  free: boolean;
  premium: boolean;
  family: boolean;
}

const FEATURE_ROWS: FeatureDefinition[] = [
  { labelKey: 'subscription.features.medications10',         free: true,  premium: false, family: false },
  { labelKey: 'subscription.features.unlimitedMedications',  free: false, premium: true,  family: true  },
  { labelKey: 'subscription.features.oneCaregiver',          free: true,  premium: false, family: false },
  { labelKey: 'subscription.features.unlimitedCaregivers',   free: false, premium: true,  family: true  },
  { labelKey: 'subscription.features.history7Days',          free: true,  premium: false, family: false },
  { labelKey: 'subscription.features.fullHistory',           free: false, premium: true,  family: true  },
  { labelKey: 'subscription.features.enEsOnly',              free: true,  premium: false, family: false },
  { labelKey: 'subscription.features.allLanguages',          free: false, premium: true,  family: true  },
  { labelKey: 'subscription.features.symptomTracking',       free: false, premium: true,  family: true  },
  { labelKey: 'subscription.features.cloudSync',             free: false, premium: true,  family: true  },
  { labelKey: 'subscription.features.careRecipients5',       free: false, premium: false, family: true  },
  { labelKey: 'subscription.features.doctorManagement',      free: false, premium: false, family: true  },
  { labelKey: 'subscription.features.pdfExport',             free: false, premium: false, family: true  },
];

// Pricing data — in a real app this would come from the API/config
const PRICING = {
  premium: { monthly: '$4.99', annual: '$39.99', savings: 'Save 33%' },
  family:  { monthly: '$9.99', annual: '$79.99', savings: 'Save 33%' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function PaywallScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { tier: currentTier, isLoading, startCheckout, loadSubscription } = useSubscriptionStore();

  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>('premium');
  const [interval, setInterval] = useState<BillingInterval>('month');

  // Build the feature rows for a given tier
  const buildFeatureRows = (tier: SubscriptionTier): TierCardProps['features'] =>
    FEATURE_ROWS.map((row) => ({
      label: t(row.labelKey),
      included: row[tier],
    }));

  // Subscription CTA
  const handleSubscribe = async () => {
    if (selectedTier === 'free') return;

    try {
      await startCheckout(selectedTier, interval);
      // After browser closes, refresh subscription status
      await loadSubscription();
      router.back();
    } catch {
      Alert.alert(
        t('subscription.checkoutErrorTitle'),
        t('subscription.checkoutErrorMessage'),
        [{ text: t('common.retry'), onPress: handleSubscribe }, { text: t('common.cancel') }]
      );
    }
  };

  const handleRestorePurchase = async () => {
    // Restore = reload from API — Stripe handles the state server-side
    try {
      await loadSubscription();
      Alert.alert(t('subscription.restoreSuccessTitle'), t('subscription.restoreSuccessMessage'));
    } catch {
      Alert.alert(t('subscription.restoreErrorTitle'), t('subscription.restoreErrorMessage'));
    }
  };

  const openToS = () => Linking.openURL('https://safedose.app/terms');
  const openPrivacy = () => Linking.openURL('https://safedose.app/privacy');

  const tiers: SubscriptionTier[] = ['free', 'premium', 'family'];

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['top', 'bottom']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
        <Pressable
          onPress={() => router.back()}
          className="w-11 h-11 items-center justify-center rounded-full bg-neutral-100 active:bg-neutral-200"
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Text className="text-neutral-700 text-xl" accessible={false}>
            ←
          </Text>
        </Pressable>

        <Text className="flex-1 text-center text-neutral-900 text-base font-semibold mx-4">
          {t('subscription.paywallTitle')}
        </Text>

        {/* Invisible spacer to keep title centered */}
        <View className="w-11" />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-8"
        showsVerticalScrollIndicator={false}
        bounces
      >
        {/* Subtitle */}
        <Text className="text-neutral-500 text-sm text-center px-6 mb-6">
          {t('subscription.paywallSubtitle')}
        </Text>

        {/* Billing interval toggle */}
        <View className="flex-row mx-5 bg-neutral-200 rounded-xl p-1 mb-6">
          <Pressable
            onPress={() => setInterval('month')}
            className={[
              'flex-1 py-2.5 rounded-lg items-center',
              interval === 'month' ? 'bg-white shadow-sm' : '',
            ].join(' ')}
            accessible
            accessibilityRole="radio"
            accessibilityState={{ checked: interval === 'month' }}
            accessibilityLabel={t('subscription.monthly')}
          >
            <Text
              className={[
                'text-sm font-semibold',
                interval === 'month' ? 'text-neutral-900' : 'text-neutral-500',
              ].join(' ')}
            >
              {t('subscription.monthly')}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setInterval('year')}
            className={[
              'flex-1 py-2.5 rounded-lg items-center',
              interval === 'year' ? 'bg-white shadow-sm' : '',
            ].join(' ')}
            accessible
            accessibilityRole="radio"
            accessibilityState={{ checked: interval === 'year' }}
            accessibilityLabel={t('subscription.annual')}
          >
            <View className="flex-row items-center gap-x-1.5">
              <Text
                className={[
                  'text-sm font-semibold',
                  interval === 'year' ? 'text-neutral-900' : 'text-neutral-500',
                ].join(' ')}
              >
                {t('subscription.annual')}
              </Text>
              {interval !== 'year' && (
                <View className="bg-state-success rounded-full px-1.5 py-0.5">
                  <Text className="text-white text-xs font-bold">33%</Text>
                </View>
              )}
            </View>
          </Pressable>
        </View>

        {/* Tier cards — vertical stack */}
        <View className="px-5 gap-y-3">
          {tiers.map((tier) => {
            const pricing = tier !== 'free' ? PRICING[tier] : null;

            return (
              <TierCard
                key={tier}
                tier={tier}
                monthlyPrice={pricing?.monthly ?? null}
                annualPrice={pricing?.annual ?? null}
                annualSavings={pricing ? t('subscription.annualSavings', { percent: '33' }) : null}
                features={buildFeatureRows(tier)}
                interval={interval}
                selected={selectedTier === tier}
                isCurrentPlan={currentTier === tier}
                isMostPopular={tier === 'premium'}
                onSelect={setSelectedTier}
              />
            );
          })}
        </View>

        {/* Trust signals */}
        <View className="flex-row justify-center gap-x-4 mt-5 px-5 flex-wrap gap-y-2">
          {(['subscription.trust.cancelAnytime', 'subscription.trust.noHiddenFees', 'subscription.trust.trialFree'] as const).map(
            (key) => (
              <View key={key} className="flex-row items-center gap-x-1">
                <Text className="text-state-success text-xs" accessible={false}>
                  ✓
                </Text>
                <Text className="text-neutral-500 text-xs">{t(key)}</Text>
              </View>
            )
          )}
        </View>

        {/* Subscribe CTA */}
        {selectedTier !== 'free' && (
          <View className="mx-5 mt-6">
            <Pressable
              onPress={handleSubscribe}
              disabled={isLoading || currentTier === selectedTier}
              className={[
                'bg-brand-500 active:bg-brand-600 rounded-xl py-4 items-center justify-center min-h-[56px]',
                (isLoading || currentTier === selectedTier) ? 'opacity-60' : '',
              ].join(' ')}
              accessible
              accessibilityRole="button"
              accessibilityLabel={
                currentTier === selectedTier
                  ? t('subscription.alreadyOnPlan')
                  : t('subscription.startTrial')
              }
              accessibilityState={{ disabled: isLoading || currentTier === selectedTier, busy: isLoading }}
            >
              {isLoading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text className="text-white text-base font-semibold">
                  {currentTier === selectedTier
                    ? t('subscription.alreadyOnPlan')
                    : t('subscription.startTrial')}
                </Text>
              )}
            </Pressable>

            {/* Interval price reminder */}
            <Text className="text-neutral-400 text-xs text-center mt-2">
              {interval === 'month'
                ? t('subscription.billedMonthly', {
                    price: PRICING[selectedTier as Exclude<SubscriptionTier, 'free'>]?.monthly,
                  })
                : t('subscription.billedAnnually', {
                    price: PRICING[selectedTier as Exclude<SubscriptionTier, 'free'>]?.annual,
                  })}
            </Text>
          </View>
        )}

        {/* Restore Purchase */}
        <Pressable
          onPress={handleRestorePurchase}
          className="mx-5 mt-4 py-3 items-center min-h-[44px]"
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('subscription.restorePurchase')}
        >
          <Text className="text-brand-600 text-sm font-medium">
            {t('subscription.restorePurchase')}
          </Text>
        </Pressable>

        {/* Legal links */}
        <View className="flex-row justify-center gap-x-4 mt-2 mb-4">
          <Pressable
            onPress={openToS}
            className="py-2 min-h-[44px] items-center justify-center"
            accessible
            accessibilityRole="link"
            accessibilityLabel={t('subscription.termsOfService')}
          >
            <Text className="text-neutral-400 text-xs underline">
              {t('subscription.termsOfService')}
            </Text>
          </Pressable>

          <Text className="text-neutral-300 text-xs self-center">·</Text>

          <Pressable
            onPress={openPrivacy}
            className="py-2 min-h-[44px] items-center justify-center"
            accessible
            accessibilityRole="link"
            accessibilityLabel={t('subscription.privacyPolicy')}
          >
            <Text className="text-neutral-400 text-xs underline">
              {t('subscription.privacyPolicy')}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
