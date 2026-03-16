/**
 * InteractionAlert — modal displaying full drug interaction details.
 *
 * Severity-coded header, plain-English description, mechanism, management,
 * and two action buttons:
 *   - "Tell Your Doctor" — opens the native Share sheet with the interaction
 *     summary (expo-clipboard is not installed; Share is the privacy-safe
 *     alternative that works across iOS and Android without extra permissions).
 *   - "I Understand" — dismiss.
 *
 * Contraindicated interactions show a hard red warning. The dismiss button
 * label changes to "I Understand" but no "Add Anyway" option is presented —
 * per the design system's Calm principle (red = absolute stop).
 *
 * Focus is automatically directed to the modal on open for VoiceOver/TalkBack.
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  Share,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { DrugInteraction, InteractionSeverity } from '@/lib/interactions/types';

// ---------------------------------------------------------------------------
// Severity display config
// ---------------------------------------------------------------------------

interface SeverityConfig {
  /** NativeWind bg for header/badge */
  headerBg: string;
  /** NativeWind text for header */
  headerText: string;
  /** NativeWind bg for badge */
  badgeBg: string;
  /** NativeWind text for badge */
  badgeText: string;
  /** i18n key for severity label */
  labelKey: string;
  /** i18n key for warning message */
  warningKey: string;
}

const SEVERITY_CONFIG: Record<InteractionSeverity, SeverityConfig> = {
  contraindicated: {
    headerBg: 'bg-red-600',
    headerText: 'text-white',
    badgeBg: 'bg-red-100',
    badgeText: 'text-red-700',
    labelKey: 'interactions.contraindicated',
    warningKey: 'interactions.contraindicatedWarning',
  },
  major: {
    headerBg: 'bg-orange-500',
    headerText: 'text-white',
    badgeBg: 'bg-orange-100',
    badgeText: 'text-orange-700',
    labelKey: 'interactions.major',
    warningKey: 'interactions.majorWarning',
  },
  moderate: {
    headerBg: 'bg-amber-500',
    headerText: 'text-white',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
    labelKey: 'interactions.moderate',
    warningKey: 'interactions.moderateWarning',
  },
  minor: {
    headerBg: 'bg-blue-500',
    headerText: 'text-white',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-700',
    labelKey: 'interactions.minor',
    warningKey: 'interactions.minorWarning',
  },
};

// ---------------------------------------------------------------------------
// Helper: build shareable summary text
// ---------------------------------------------------------------------------

function buildSummaryText(interaction: DrugInteraction, t: (key: string) => string): string {
  return [
    t('interactions.interactionBetween')
      .replace('{{drug1}}', interaction.drug1Name)
      .replace('{{drug2}}', interaction.drug2Name),
    '',
    `${t(`interactions.${interaction.severity}`)}: ${t(SEVERITY_CONFIG[interaction.severity].warningKey)}`,
    '',
    interaction.description,
    '',
    `${t('interactions.mechanism')}: ${interaction.mechanism}`,
    '',
    `${t('interactions.management')}: ${interaction.management}`,
    '',
    `${t('interactions.source')}: ${interaction.source}`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface InteractionAlertProps {
  interaction: DrugInteraction;
  visible: boolean;
  onDismiss: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InteractionAlert({
  interaction,
  visible,
  onDismiss,
}: InteractionAlertProps) {
  const { t } = useTranslation();

  const config = SEVERITY_CONFIG[interaction.severity];
  const titleText = t('interactions.interactionBetween')
    .replace('{{drug1}}', interaction.drug1Name)
    .replace('{{drug2}}', interaction.drug2Name);

  const handleTellDoctor = async () => {
    try {
      await Share.share({
        message: buildSummaryText(interaction, t),
        title: titleText,
      });
    } catch {
      // User dismissed share sheet — no action needed
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onDismiss}
      accessibilityViewIsModal
    >
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-white rounded-t-3xl overflow-hidden max-h-[85%]">
          {/* Severity header */}
          <View className={`px-5 pt-5 pb-4 ${config.headerBg}`}>
            {/* Severity badge */}
            <View className="flex-row items-center gap-x-2 mb-2">
              <View className={`px-3 py-1 rounded-full bg-white/20`}>
                <Text
                  className="text-white text-xs font-bold uppercase tracking-wide"
                  allowFontScaling={false}
                >
                  {t(config.labelKey)}
                </Text>
              </View>
            </View>
            <Text
              className={`text-lg font-bold leading-snug ${config.headerText}`}
              accessibilityRole="header"
              allowFontScaling
            >
              {titleText}
            </Text>
          </View>

          {/* Scrollable body */}
          <ScrollView
            className="px-5"
            contentContainerClassName="py-4 gap-y-4"
            showsVerticalScrollIndicator={false}
          >
            {/* Warning banner */}
            <View className={`rounded-xl px-4 py-3 ${config.badgeBg}`}>
              <Text
                className={`text-sm font-semibold ${config.badgeText}`}
                allowFontScaling
              >
                {t(config.warningKey)}
              </Text>
            </View>

            {/* Description */}
            <Text className="text-neutral-800 text-base leading-relaxed" allowFontScaling>
              {interaction.description}
            </Text>

            {/* How it works */}
            {interaction.mechanism ? (
              <View>
                <Text className="text-neutral-500 text-xs font-semibold uppercase tracking-wider mb-1">
                  {t('interactions.mechanism')}
                </Text>
                <Text className="text-neutral-700 text-sm leading-relaxed" allowFontScaling>
                  {interaction.mechanism}
                </Text>
              </View>
            ) : null}

            {/* What to do */}
            {interaction.management ? (
              <View>
                <Text className="text-neutral-500 text-xs font-semibold uppercase tracking-wider mb-1">
                  {t('interactions.management')}
                </Text>
                <Text className="text-neutral-700 text-sm leading-relaxed" allowFontScaling>
                  {interaction.management}
                </Text>
              </View>
            ) : null}

            {/* Source */}
            {interaction.source ? (
              <Text className="text-neutral-400 text-xs" allowFontScaling>
                {t('interactions.source')}: {interaction.source}
              </Text>
            ) : null}

            {/* Bottom spacer so last content isn't obscured by buttons */}
            <View className="h-2" />
          </ScrollView>

          {/* Action buttons */}
          <View className="px-5 pb-8 pt-3 gap-y-3 border-t border-neutral-100">
            <Pressable
              onPress={handleTellDoctor}
              accessibilityRole="button"
              accessibilityLabel={t('common.tellYourDoctor')}
              className="bg-neutral-900 rounded-xl py-4 items-center active:bg-neutral-700"
            >
              <Text className="text-white font-semibold text-base">
                {t('common.tellYourDoctor')}
              </Text>
            </Pressable>

            <Pressable
              onPress={onDismiss}
              accessibilityRole="button"
              accessibilityLabel={t('common.iUnderstand')}
              className="bg-neutral-100 rounded-xl py-4 items-center active:bg-neutral-200"
            >
              <Text className="text-neutral-700 font-semibold text-base">
                {t('common.iUnderstand')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
