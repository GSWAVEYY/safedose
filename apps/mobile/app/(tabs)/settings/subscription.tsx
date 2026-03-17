/**
 * Subscription Management screen.
 *
 * Shows the user's current plan, status, and billing controls.
 * Delegates all actual billing changes to Stripe Customer Portal.
 * Does NOT handle cancellation directly — always points to portal.
 *
 * Refreshes subscription status on mount so displayed data is current.
 */

import { useEffect } from 'react';
import {
  ScrollView,
  Text,
  View,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSubscriptionStore } from '../../../store/subscription';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatusBadgeProps {
  status: string | null;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: StatusBadgeProps) {
  const { t } = useTranslation();

  const config: Record<string, { bg: string; text: string; label: string }> = {
    active:   { bg: 'bg-state-success/10', text: 'text-state-success',  label: t('subscription.status.active')   },
    trialing: { bg: 'bg-brand-100',         text: 'text-brand-700',      label: t('subscription.status.trialing') },
    past_due: { bg: 'bg-state-warning/10',  text: 'text-state-warning',  label: t('subscription.status.pastDue')  },
    canceled: { bg: 'bg-neutral-100',       text: 'text-neutral-500',    label: t('subscription.status.canceled') },
  };

  const style = status ? (config[status] ?? config['active']) : config['active'];

  return (
    <View className={`${style.bg} rounded-full px-3 py-1 self-start`}>
      <Text className={`${style.text} text-xs font-semibold`}>{style.label}</Text>
    </View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SubscriptionScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { tier, status, isLoading, error, loadSubscription, openPortal, clearError } =
    useSubscriptionStore();

  // Refresh on mount to ensure displayed status is current
  useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  // Dismiss error and notify user
  useEffect(() => {
    if (error) {
      Alert.alert(t('common.error'), error, [
        { text: t('common.retry'), onPress: () => { clearError(); loadSubscription(); } },
        { text: t('common.cancel'), onPress: clearError },
      ]);
    }
  }, [error, clearError, loadSubscription, t]);

  const handleOpenPortal = async () => {
    try {
      await openPortal();
      // Portal may have changed the plan — refresh after browser closes
      await loadSubscription();
    } catch {
      // Error is already set in the store and shown via the useEffect above
    }
  };

  const TIER_DISPLAY: Record<string, string> = {
    free:    t('subscription.tiers.free.name'),
    premium: t('subscription.tiers.premium.name'),
    family:  t('subscription.tiers.family.name'),
  };

  const TIER_DESCRIPTION: Record<string, string> = {
    free:    t('subscription.tiers.free.description'),
    premium: t('subscription.tiers.premium.description'),
    family:  t('subscription.tiers.family.description'),
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['top', 'bottom']}>
      {/* Header */}
      <View className="flex-row items-center px-5 pt-4 pb-2">
        <Pressable
          onPress={() => router.back()}
          className="w-11 h-11 items-center justify-center rounded-full bg-neutral-100 active:bg-neutral-200 mr-3"
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Text className="text-neutral-700 text-xl" accessible={false}>
            ←
          </Text>
        </Pressable>
        <Text className="text-neutral-900 text-xl font-bold">
          {t('subscription.managementTitle')}
        </Text>
      </View>

      {isLoading && !tier ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0D9488" />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 pb-8"
          showsVerticalScrollIndicator={false}
        >
          {/* Current plan card */}
          <View className="bg-white rounded-2xl border border-neutral-200 p-5 mt-4">
            <Text className="text-neutral-500 text-xs font-semibold uppercase tracking-wider mb-3">
              {t('subscription.currentPlan')}
            </Text>

            <View className="flex-row items-start justify-between">
              <View className="flex-1 mr-3">
                <Text className="text-neutral-900 text-2xl font-bold mb-1">
                  {TIER_DISPLAY[tier] ?? tier}
                </Text>
                <Text className="text-neutral-500 text-sm leading-5">
                  {TIER_DESCRIPTION[tier] ?? ''}
                </Text>
              </View>
              <StatusBadge status={status} />
            </View>

            {/* Refresh indicator */}
            {isLoading && (
              <View className="flex-row items-center gap-x-2 mt-3">
                <ActivityIndicator size="small" color="#0D9488" />
                <Text className="text-neutral-400 text-xs">
                  {t('subscription.refreshing')}
                </Text>
              </View>
            )}
          </View>

          {/* Upgrade prompt for free tier */}
          {tier === 'free' && (
            <View className="bg-brand-50 border border-brand-200 rounded-2xl p-4 mt-4">
              <Text className="text-brand-800 text-sm font-semibold mb-1">
                {t('subscription.upgradePromptTitle')}
              </Text>
              <Text className="text-brand-700 text-sm leading-5 mb-3">
                {t('subscription.upgradePromptBody')}
              </Text>
              <Pressable
                onPress={() => router.push('/paywall')}
                className="bg-brand-500 active:bg-brand-600 rounded-xl py-3 items-center min-h-[44px]"
                accessible
                accessibilityRole="button"
                accessibilityLabel={t('subscription.viewPlans')}
              >
                <Text className="text-white text-sm font-semibold">
                  {t('subscription.viewPlans')}
                </Text>
              </Pressable>
            </View>
          )}

          {/* Billing actions for paid tiers */}
          {tier !== 'free' && (
            <View className="bg-white rounded-2xl border border-neutral-200 mt-4 overflow-hidden">
              <Text className="text-neutral-500 text-xs font-semibold uppercase tracking-wider px-5 pt-4 pb-3">
                {t('subscription.billingActions')}
              </Text>

              {/* Change plan */}
              <Pressable
                onPress={() => router.push('/paywall')}
                className="flex-row items-center justify-between px-5 py-4 active:bg-neutral-50 border-t border-neutral-100 min-h-[56px]"
                accessible
                accessibilityRole="button"
                accessibilityLabel={t('subscription.changePlan')}
              >
                <View className="flex-1">
                  <Text className="text-neutral-900 text-sm font-medium">
                    {t('subscription.changePlan')}
                  </Text>
                  <Text className="text-neutral-400 text-xs mt-0.5">
                    {t('subscription.changePlanDescription')}
                  </Text>
                </View>
                <Text className="text-neutral-300 text-lg ml-3" accessible={false}>
                  →
                </Text>
              </Pressable>

              {/* Manage via Stripe portal */}
              <Pressable
                onPress={handleOpenPortal}
                disabled={isLoading}
                className={[
                  'flex-row items-center justify-between px-5 py-4 border-t border-neutral-100 min-h-[56px]',
                  isLoading ? 'opacity-60' : 'active:bg-neutral-50',
                ].join(' ')}
                accessible
                accessibilityRole="button"
                accessibilityLabel={t('subscription.manageSubscription')}
                accessibilityState={{ busy: isLoading }}
              >
                <View className="flex-1">
                  <Text className="text-neutral-900 text-sm font-medium">
                    {t('subscription.manageSubscription')}
                  </Text>
                  <Text className="text-neutral-400 text-xs mt-0.5">
                    {t('subscription.manageSubscriptionDescription')}
                  </Text>
                </View>
                {isLoading ? (
                  <ActivityIndicator size="small" color="#0D9488" className="ml-3" />
                ) : (
                  <Text className="text-neutral-300 text-lg ml-3" accessible={false}>
                    →
                  </Text>
                )}
              </Pressable>
            </View>
          )}

          {/* Cancel info — no scary red button, just informational text pointing to portal */}
          {tier !== 'free' && (
            <View className="bg-neutral-100 rounded-xl p-4 mt-4">
              <Text className="text-neutral-500 text-xs leading-5">
                {t('subscription.cancelInfo')}
              </Text>
            </View>
          )}

          {/* Trust signals */}
          <View className="mt-6 gap-y-2">
            {[
              'subscription.trust.cancelAnytime',
              'subscription.trust.noHiddenFees',
              'subscription.trust.privacyFirst',
            ].map((key) => (
              <View key={key} className="flex-row items-center gap-x-2">
                <Text className="text-state-success text-sm" accessible={false}>
                  ✓
                </Text>
                <Text className="text-neutral-500 text-sm">{t(key)}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
