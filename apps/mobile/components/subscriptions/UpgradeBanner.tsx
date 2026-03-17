/**
 * UpgradeBanner — Dismissible upgrade prompt for free-tier users.
 *
 * Shows a gentle, non-intrusive banner at the top of applicable screens
 * (medications list, schedule). Dismissed state is held in module-level
 * memory keyed by storageKey — persists for the app session and resets
 * on full app restart. This avoids the @react-native-async-storage
 * dependency while still preventing the banner from re-appearing mid-session.
 *
 * Design: soft teal tint, not alarming, not a modal, not blocking.
 * Respects the SafeDose "no dark patterns" principle.
 *
 * Usage:
 *   <UpgradeBanner messageKey="subscription.banner.medications" />
 */

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSubscriptionStore } from '../../store/subscription';

// ─── Module-level dismissal state ─────────────────────────────────────────────
// Keyed by storageKey — survives re-renders, cleared on app restart.

const dismissed: Record<string, boolean> = {};

// ─── Types ────────────────────────────────────────────────────────────────────

interface UpgradeBannerProps {
  /**
   * i18n key for the banner message body.
   * Falls back to the generic upgrade message if not provided.
   */
  messageKey?: string;
  /** Unique key per screen — separate dismiss state per banner */
  storageKey?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function UpgradeBanner({
  messageKey = 'subscription.banner.default',
  storageKey = 'default',
}: UpgradeBannerProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const tier = useSubscriptionStore((s) => s.tier);

  // Only show for free-tier users who haven't dismissed this banner
  const [visible, setVisible] = useState<boolean>(
    tier === 'free' && !dismissed[storageKey]
  );

  const handleDismiss = () => {
    dismissed[storageKey] = true;
    setVisible(false);
  };

  if (!visible) {
    return null;
  }

  return (
    <View
      className="mx-4 mb-3 bg-brand-50 border border-brand-200 rounded-xl px-4 py-3 flex-row items-center gap-x-3"
      accessible
      accessibilityRole="alert"
      accessibilityLabel={t(messageKey)}
    >
      {/* Icon */}
      <Text className="text-brand-500 text-lg" accessible={false}>
        ✨
      </Text>

      {/* Message */}
      <Text className="flex-1 text-neutral-700 text-sm leading-5">
        {t(messageKey)}
      </Text>

      {/* Upgrade CTA */}
      <Pressable
        onPress={() => router.push('/paywall')}
        className="bg-brand-500 active:bg-brand-600 rounded-lg px-3 py-2 min-w-[44px] min-h-[44px] items-center justify-center"
        accessible
        accessibilityRole="button"
        accessibilityLabel={t('subscription.upgrade')}
      >
        <Text className="text-white text-xs font-semibold">
          {t('subscription.upgrade')}
        </Text>
      </Pressable>

      {/* Dismiss button */}
      <Pressable
        onPress={handleDismiss}
        className="w-11 h-11 items-center justify-center -mr-2"
        accessible
        accessibilityRole="button"
        accessibilityLabel={t('subscription.banner.dismiss')}
      >
        <Text className="text-neutral-400 text-lg" accessible={false}>
          ×
        </Text>
      </Pressable>
    </View>
  );
}
