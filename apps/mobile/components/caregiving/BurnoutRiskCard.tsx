/**
 * BurnoutRiskCard — caregiver wellness dashboard widget.
 *
 * Shows the current burnout risk level, trend arrow, and days since last check-in.
 * For high/critical risk (or PHQ-2 >= 5) surfaces crisis and support resources.
 * Tapping the card navigates to the wellness check-in screen.
 *
 * Only rendered when the user has at least one caregiver relationship (caller's
 * responsibility to check).
 */

import { useEffect } from 'react';
import { View, Text, Pressable, Linking, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useWellnessStore } from '../../store/wellness';
import type { BurnoutRiskLevel } from '../../lib/db/wellness';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const RISK_CONFIG: Record<
  BurnoutRiskLevel,
  { bg: string; border: string; dot: string; textColor: string; label: string }
> = {
  low:      { bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500', textColor: 'text-emerald-700', label: 'Low' },
  moderate: { bg: 'bg-amber-50',   border: 'border-amber-200',   dot: 'bg-amber-500',   textColor: 'text-amber-700',   label: 'Moderate' },
  high:     { bg: 'bg-orange-50',  border: 'border-orange-200',  dot: 'bg-orange-500',  textColor: 'text-orange-700',  label: 'High' },
  critical: { bg: 'bg-red-50',     border: 'border-red-200',     dot: 'bg-red-500',     textColor: 'text-red-700',     label: 'Critical' },
};

const TREND_SYMBOLS: Record<string, { icon: string; color: string }> = {
  improving: { icon: '↓', color: 'text-emerald-600' },
  stable:    { icon: '→', color: 'text-slate-500' },
  declining: { icon: '↑', color: 'text-red-500' },
  unknown:   { icon: '–', color: 'text-slate-400' },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysSince(timestampMs: number): number {
  return Math.floor((Date.now() - timestampMs) / (1000 * 60 * 60 * 24));
}

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BurnoutRiskCard() {
  const { t } = useTranslation();
  const router = useRouter();
  const { burnoutRisk, lastCheckinAt, isLoading, loadBurnoutScore } = useWellnessStore();

  // Load burnout score on mount
  useEffect(() => {
    void loadBurnoutScore();
  }, [loadBurnoutScore]);

  const risk = burnoutRisk;
  const config = risk ? RISK_CONFIG[risk.level] : RISK_CONFIG.low;
  const trend = risk ? TREND_SYMBOLS[risk.trend] ?? TREND_SYMBOLS.unknown : TREND_SYMBOLS.unknown;

  // Days since last check-in
  const dayCount = lastCheckinAt !== null ? daysSince(lastCheckinAt) : null;
  const showCheckInPrompt = dayCount === null || dayCount >= 7;

  // Show resources for high/critical risk or PHQ-2 >= 5
  const showCrisisLine = risk !== null && (risk.phq2Score ?? 0) >= 5;
  const showSupportResources = risk !== null && (risk.level === 'high' || risk.level === 'critical');

  function handlePress() {
    router.push('/(tabs)/caregiving/wellness');
  }

  return (
    <Pressable
      onPress={handlePress}
      accessible
      accessibilityRole="button"
      accessibilityLabel={t('wellness.card.accessibilityLabel')}
      className="mb-4"
    >
      <View className={`rounded-2xl border p-4 ${config.bg} ${config.border}`}>
        {/* Header row */}
        <View className="flex-row items-center mb-1">
          <Text className="text-xs font-semibold text-slate-500 uppercase tracking-widest flex-1">
            {t('wellness.card.title')}
          </Text>
          <Text className="text-xs text-slate-400">{t('wellness.card.tapToCheckIn')}</Text>
        </View>

        {/* Risk level + trend */}
        {isLoading && risk === null ? (
          <Text className="text-sm text-slate-400 mt-1">{t('common.loading')}</Text>
        ) : risk === null ? (
          /* Never checked in */
          <View>
            <Text className="text-base font-semibold text-slate-600 mt-1">
              {t('wellness.card.noData')}
            </Text>
            <Text className="text-xs text-slate-400 mt-0.5">
              {t('wellness.card.firstCheckInPrompt')}
            </Text>
          </View>
        ) : (
          <View className="flex-row items-center mt-1 mb-2">
            <View className={`w-2.5 h-2.5 rounded-full mr-2 ${config.dot}`} />
            <Text className={`text-xl font-bold mr-2 ${config.textColor}`}>
              {config.label}
            </Text>
            <Text className={`text-base font-bold ${trend.color}`} accessibilityLabel={t('wellness.card.trend', { trend: risk.trend })}>
              {trend.icon}
            </Text>
            <View className="flex-1" />
            <Text className="text-xs text-slate-400 font-medium">
              {t('wellness.card.score', { score: risk.score })}
            </Text>
          </View>
        )}

        {/* Days since last check-in */}
        {showCheckInPrompt && (
          <View className="bg-white/60 rounded-xl px-3 py-2 mt-1">
            <Text className="text-xs text-slate-600">
              {dayCount === null
                ? t('wellness.card.neverCheckedIn')
                : t('wellness.card.daysSince', { count: dayCount })}
            </Text>
          </View>
        )}

        {/* Crisis line — only when PHQ-2 >= 5 */}
        {showCrisisLine && (
          <Pressable
            onPress={() => callNumber('988')}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('wellness.card.crisis988Label')}
            className="mt-3 bg-red-600 rounded-xl px-4 py-3 flex-row items-center"
            onStartShouldSetResponder={() => true}
          >
            <Text className="text-white text-sm font-semibold flex-1">
              988 {t('wellness.card.crisisLine')}
            </Text>
            <Text className="text-red-200 text-xs">{t('wellness.card.callOrText')}</Text>
          </Pressable>
        )}

        {/* Support resources — high/critical */}
        {showSupportResources && !showCrisisLine && (
          <View className="mt-3 flex-row gap-2">
            <Pressable
              onPress={() => callNumber('18552277878')}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t('wellness.card.aarpLabel')}
              className="flex-1 bg-white/70 rounded-xl px-3 py-2"
              onStartShouldSetResponder={() => true}
            >
              <Text className="text-xs font-semibold text-slate-700">AARP Caregiver</Text>
              <Text className="text-xs text-teal-600">1-855-227-7878</Text>
            </Pressable>
            <Pressable
              onPress={() => openLink('https://www.caregiveraction.org')}
              accessible
              accessibilityRole="link"
              accessibilityLabel={t('wellness.card.canLabel')}
              className="flex-1 bg-white/70 rounded-xl px-3 py-2"
              onStartShouldSetResponder={() => true}
            >
              <Text className="text-xs font-semibold text-slate-700">CAN Resources</Text>
              <Text className="text-xs text-teal-600">caregiveraction.org</Text>
            </Pressable>
          </View>
        )}

        {/* Affirmation */}
        <Text className="text-xs text-slate-500 mt-3 italic">
          {t('wellness.card.affirmation')}
        </Text>
      </View>
    </Pressable>
  );
}
