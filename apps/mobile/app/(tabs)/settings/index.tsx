/**
 * Settings screen — main navigation hub for account/app settings.
 *
 * Sprint 2 placeholder content replaced with real rows.
 * Subscription row navigates to the subscription management screen.
 */

import { ScrollView, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSubscriptionStore } from '../../../store/subscription';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SettingsRowProps {
  label: string;
  description?: string;
  badge?: string;
  badgeVariant?: 'brand' | 'neutral';
  onPress: () => void;
  isLast?: boolean;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SettingsRow({
  label,
  description,
  badge,
  badgeVariant = 'neutral',
  onPress,
  isLast = false,
}: SettingsRowProps) {
  return (
    <Pressable
      onPress={onPress}
      className={[
        'flex-row items-center justify-between px-5 py-4 active:bg-neutral-50 min-h-[56px]',
        !isLast ? 'border-b border-neutral-100' : '',
      ].join(' ')}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View className="flex-1 mr-3">
        <Text className="text-neutral-900 text-sm font-medium">{label}</Text>
        {description ? (
          <Text className="text-neutral-400 text-xs mt-0.5 leading-4">{description}</Text>
        ) : null}
      </View>

      <View className="flex-row items-center gap-x-2">
        {badge ? (
          <View
            className={[
              'rounded-full px-2.5 py-0.5',
              badgeVariant === 'brand' ? 'bg-brand-100' : 'bg-neutral-100',
            ].join(' ')}
          >
            <Text
              className={[
                'text-xs font-semibold',
                badgeVariant === 'brand' ? 'text-brand-700' : 'text-neutral-500',
              ].join(' ')}
            >
              {badge}
            </Text>
          </View>
        ) : null}
        <Text className="text-neutral-300 text-lg" accessible={false}>
          →
        </Text>
      </View>
    </Pressable>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="text-neutral-500 text-xs font-semibold uppercase tracking-wider px-5 pt-5 pb-2">
      {title}
    </Text>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const tier = useSubscriptionStore((s) => s.tier);

  const TIER_BADGE: Record<string, string> = {
    free:    t('subscription.tiers.free.name'),
    premium: t('subscription.tiers.premium.name'),
    family:  t('subscription.tiers.family.name'),
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['top', 'bottom']}>
      {/* Header */}
      <View className="px-5 pt-4 pb-2">
        <Text className="text-neutral-900 text-2xl font-bold">
          {t('tabs.settings')}
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-8"
        showsVerticalScrollIndicator={false}
      >
        {/* Account section */}
        <SectionHeader title={t('settings.sectionAccount')} />
        <View className="bg-white rounded-2xl border border-neutral-200 mx-5 overflow-hidden">
          <SettingsRow
            label={t('settings.subscription')}
            description={t('settings.subscriptionDescription')}
            badge={TIER_BADGE[tier] ?? tier}
            badgeVariant={tier !== 'free' ? 'brand' : 'neutral'}
            onPress={() => router.push('/(tabs)/settings/subscription')}
            isLast
          />
        </View>

        {/* App section — placeholder rows for future sprints */}
        <SectionHeader title={t('settings.sectionApp')} />
        <View className="bg-white rounded-2xl border border-neutral-200 mx-5 overflow-hidden">
          <SettingsRow
            label={t('settings.language')}
            description={t('settings.languageDescription')}
            onPress={() => {
              // Sprint 3: language picker
            }}
          />
          <SettingsRow
            label={t('settings.notifications')}
            description={t('settings.notificationsDescription')}
            onPress={() => {
              // Sprint 3: notification preferences
            }}
            isLast
          />
        </View>

        {/* About section */}
        <SectionHeader title={t('settings.sectionAbout')} />
        <View className="bg-white rounded-2xl border border-neutral-200 mx-5 overflow-hidden">
          <SettingsRow
            label={t('settings.privacyPolicy')}
            onPress={() => {
              // Open privacy policy URL
            }}
          />
          <SettingsRow
            label={t('settings.termsOfService')}
            onPress={() => {
              // Open ToS URL
            }}
            isLast
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
