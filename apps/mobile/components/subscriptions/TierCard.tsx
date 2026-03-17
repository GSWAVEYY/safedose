/**
 * TierCard — Subscription tier comparison card.
 *
 * Displays tier name, pricing, feature checklist, and selection state.
 * Used inside the Paywall screen in a horizontal or stacked layout.
 *
 * Design: calm/trustworthy — teal border on selected, subtle gray for unselected.
 * No aggressive sales patterns. Healthcare audience.
 */

import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { SubscriptionTier, BillingInterval } from '../../lib/subscriptions/index';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TierFeatureRow {
  label: string;
  included: boolean;
}

export interface TierCardProps {
  tier: SubscriptionTier;
  monthlyPrice: string | null; // null for free tier
  annualPrice: string | null;  // null for free tier
  annualSavings: string | null;
  features: TierFeatureRow[];
  interval: BillingInterval;
  selected: boolean;
  isCurrentPlan: boolean;
  isMostPopular: boolean;
  onSelect: (tier: SubscriptionTier) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TIER_DISPLAY_NAMES: Record<SubscriptionTier, string> = {
  free:    'Free',
  premium: 'Premium',
  family:  'Family',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function TierCard({
  tier,
  monthlyPrice,
  annualPrice,
  annualSavings,
  features,
  interval,
  selected,
  isCurrentPlan,
  isMostPopular,
  onSelect,
}: TierCardProps) {
  const { t } = useTranslation();

  const isPaid = tier !== 'free';
  const displayPrice = interval === 'month' ? monthlyPrice : annualPrice;

  return (
    <Pressable
      onPress={() => onSelect(tier)}
      accessible
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={`${TIER_DISPLAY_NAMES[tier]} plan${isCurrentPlan ? ', current plan' : ''}`}
      className={[
        'rounded-2xl p-4 border-2',
        selected
          ? 'border-brand-500 bg-brand-50'
          : 'border-neutral-200 bg-white',
      ].join(' ')}
    >
      {/* Badges row */}
      <View className="flex-row justify-between items-start mb-3">
        {isMostPopular ? (
          <View className="bg-brand-500 rounded-full px-3 py-1">
            <Text className="text-white text-xs font-semibold">
              {t('subscription.mostPopular')}
            </Text>
          </View>
        ) : (
          <View />
        )}

        {isCurrentPlan && (
          <View className="bg-neutral-100 border border-neutral-200 rounded-full px-3 py-1">
            <Text className="text-neutral-600 text-xs font-medium">
              {t('subscription.currentPlan')}
            </Text>
          </View>
        )}
      </View>

      {/* Tier name */}
      <Text className="text-neutral-900 text-lg font-bold mb-1">
        {t(`subscription.tiers.${tier}.name`)}
      </Text>

      {/* Price */}
      {isPaid && displayPrice ? (
        <View className="mb-1">
          <Text className="text-brand-600 text-2xl font-bold">
            {displayPrice}
            <Text className="text-neutral-500 text-sm font-normal">
              {interval === 'month'
                ? t('subscription.perMonth')
                : t('subscription.perYear')}
            </Text>
          </Text>
          {interval === 'year' && annualSavings ? (
            <View className="bg-state-success/10 rounded-full px-2 py-0.5 self-start mt-1">
              <Text className="text-state-success text-xs font-semibold">
                {annualSavings}
              </Text>
            </View>
          ) : null}
        </View>
      ) : (
        <Text className="text-neutral-500 text-base font-medium mb-1">
          {t('subscription.tiers.free.price')}
        </Text>
      )}

      {/* Divider */}
      <View className="h-px bg-neutral-200 my-3" />

      {/* Feature list */}
      <View className="gap-y-2">
        {features.map((feature, index) => (
          <View key={index} className="flex-row items-start gap-x-2">
            {/* Check / X icon using text — avoids heavy icon library import */}
            <View
              className={[
                'w-5 h-5 rounded-full items-center justify-center mt-0.5',
                feature.included ? 'bg-brand-100' : 'bg-neutral-100',
              ].join(' ')}
            >
              <Text
                className={[
                  'text-xs font-bold leading-none',
                  feature.included ? 'text-brand-600' : 'text-neutral-400',
                ].join(' ')}
                accessible={false}
              >
                {feature.included ? '✓' : '×'}
              </Text>
            </View>
            <Text
              className={[
                'flex-1 text-sm leading-5',
                feature.included ? 'text-neutral-700' : 'text-neutral-400',
              ].join(' ')}
            >
              {feature.label}
            </Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}
