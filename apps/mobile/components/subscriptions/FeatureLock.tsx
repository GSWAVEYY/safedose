/**
 * FeatureLock — Paywall overlay wrapper for gated features.
 *
 * Renders children normally when the user's tier grants access.
 * When access is denied, renders children at 50% opacity with a
 * centered lock overlay. Tapping anywhere on the locked content
 * navigates to the paywall.
 *
 * Usage:
 *   <FeatureLock feature="cloudSync">
 *     <CloudSyncToggle />
 *   </FeatureLock>
 *
 * Design intent: the lock is visible but not alarming. Gray, not red.
 * Users understand what they'd get — not scared off by a hard block.
 */

import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSubscriptionStore } from '../../store/subscription';
import { isFeatureAvailable, type FeatureKey } from '../../lib/subscriptions/features';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeatureLockProps {
  feature: FeatureKey;
  children: React.ReactNode;
  /** Override the upgrade button label */
  upgradeLabel?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FeatureLock({ feature, children, upgradeLabel }: FeatureLockProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const tier = useSubscriptionStore((s) => s.tier);

  const hasAccess = isFeatureAvailable(feature, tier);

  // Feature available — render children as-is, zero overhead
  if (hasAccess) {
    return <>{children}</>;
  }

  // Feature locked — render with dimming + overlay
  return (
    <View className="relative">
      {/* Dimmed content */}
      <View className="opacity-50 pointer-events-none" aria-hidden>
        {children}
      </View>

      {/* Lock overlay — full-cover tap target */}
      <Pressable
        onPress={() => router.push('/paywall')}
        className="absolute inset-0 items-center justify-center rounded-xl"
        accessible
        accessibilityRole="button"
        accessibilityLabel={upgradeLabel ?? t('subscription.upgradeToUnlock')}
        accessibilityHint={t('subscription.upgradeHint')}
      >
        {/* Semi-transparent backdrop pill */}
        <View className="bg-neutral-900/70 rounded-full px-4 py-2 flex-row items-center gap-x-2">
          {/* Lock icon using unicode — no icon lib needed */}
          <Text className="text-white text-base" accessible={false}>
            🔒
          </Text>
          <Text className="text-white text-sm font-semibold">
            {upgradeLabel ?? t('subscription.upgrade')}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}
