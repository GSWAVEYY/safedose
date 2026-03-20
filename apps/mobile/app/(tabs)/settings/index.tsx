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
import {
  ChevronRight,
  CreditCard,
  Globe,
  Bell,
  FileText,
  Scale,
  type LucideIcon,
} from 'lucide-react-native';
import { useSubscriptionStore } from '../../../store/subscription';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SettingsRowProps {
  label: string;
  description?: string;
  badge?: string;
  badgeVariant?: 'brand' | 'neutral';
  icon?: LucideIcon;
  onPress: () => void;
  isLast?: boolean;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SettingsRow({
  label,
  description,
  badge,
  badgeVariant = 'neutral',
  icon: Icon,
  onPress,
  isLast = false,
}: SettingsRowProps) {
  return (
    <Pressable
      onPress={onPress}
      className={[
        'flex-row items-center px-5 py-4 active:bg-neutral-50',
        !isLast ? 'border-b border-neutral-100' : '',
      ].join(' ')}
      style={{ minHeight: 56 }}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {/* Icon */}
      {Icon && (
        <View className="w-9 h-9 rounded-xl bg-neutral-100 items-center justify-center mr-3.5">
          <Icon size={18} color="#64748B" strokeWidth={1.8} aria-hidden={true} />
        </View>
      )}

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
        <ChevronRight size={18} color="#CBD5E1" strokeWidth={2} aria-hidden={true} />
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
    <SafeAreaView className="flex-1" style={{ backgroundColor: 'rgba(100, 116, 139, 0.04)' }} edges={['top', 'bottom']}>
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
            icon={CreditCard}
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
            icon={Globe}
            onPress={() => {
              // Sprint 3: language picker
            }}
          />
          <SettingsRow
            label={t('settings.notifications')}
            description={t('settings.notificationsDescription')}
            icon={Bell}
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
            icon={FileText}
            onPress={() => {
              // Open privacy policy URL
            }}
          />
          <SettingsRow
            label={t('settings.termsOfService')}
            icon={Scale}
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
