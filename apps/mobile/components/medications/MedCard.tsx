/**
 * MedCard — medication list item card.
 *
 * Shows drug name, strength + dosage unit, status badge, interaction warning
 * dot, next dose time from schedule, and a trailing chevron for navigation.
 *
 * Minimum 44pt touch target enforced via minHeight.
 * All interactive text is accessible via accessibilityLabel.
 */

import React from 'react';
import { Pressable, View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Medication } from '@safedose/shared-types';

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

interface StatusConfig {
  /** NativeWind bg class */
  bg: string;
  /** NativeWind text class */
  text: string;
  /** i18n key under medications.* */
  labelKey: string;
}

const STATUS_MAP: Record<'active' | 'paused' | 'discontinued', StatusConfig> = {
  active: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    labelKey: 'medications.statusActive',
  },
  paused: {
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    labelKey: 'medications.statusPaused',
  },
  discontinued: {
    bg: 'bg-neutral-100',
    text: 'text-neutral-500',
    labelKey: 'medications.statusDiscontinued',
  },
};

function resolveStatus(med: Medication): 'active' | 'paused' | 'discontinued' {
  if (med.endedAt) return 'discontinued';
  if (!med.isActive) return 'paused';
  return 'active';
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface MedCardProps {
  medication: Medication;
  /** True when this medication has at least one known drug interaction. */
  hasInteraction?: boolean;
  /** Next dose time string to display (e.g. "8:00 AM"). Pass undefined for as-needed meds. */
  nextDoseTime?: string;
  onPress: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MedCard({
  medication,
  hasInteraction = false,
  nextDoseTime,
  onPress,
}: MedCardProps) {
  const { t } = useTranslation();

  const status = resolveStatus(medication);
  const statusConfig = STATUS_MAP[status];
  const statusLabel = t(statusConfig.labelKey);

  const strengthLabel = `${medication.dosageAmount} ${t(`dosageUnits.${medication.dosageUnit}`)}`;
  const nextDoseLabel = nextDoseTime ?? t('medications.asNeeded');

  const accessibilityLabel = [
    medication.name,
    strengthLabel,
    statusLabel,
    hasInteraction ? t('medications.interactionWarning') : null,
    `${t('medications.nextDose')}: ${nextDoseLabel}`,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className="active:opacity-70"
    >
      <View className="bg-white rounded-2xl px-4 py-4 shadow-sm flex-row items-center min-h-[72px]">
        {/* Left content */}
        <View className="flex-1 mr-3">
          {/* Drug name row */}
          <View className="flex-row items-center gap-x-2">
            <Text
              className="text-neutral-900 text-lg font-semibold flex-shrink"
              numberOfLines={1}
              allowFontScaling
            >
              {medication.name}
            </Text>
            {/* Interaction warning dot */}
            {hasInteraction && (
              <View
                className="w-2.5 h-2.5 rounded-full bg-orange-500"
                accessibilityElementsHidden
              />
            )}
          </View>

          {/* Strength + status row */}
          <View className="flex-row items-center mt-1 gap-x-2">
            <Text
              className="text-neutral-500 text-sm"
              allowFontScaling
            >
              {strengthLabel}
            </Text>
            <View className={`px-2 py-0.5 rounded-full ${statusConfig.bg}`}>
              <Text
                className={`text-xs font-semibold ${statusConfig.text}`}
                allowFontScaling={false}
              >
                {statusLabel}
              </Text>
            </View>
          </View>

          {/* Next dose */}
          <Text
            className="text-neutral-400 text-xs mt-1"
            allowFontScaling
          >
            {t('medications.nextDose')}: {nextDoseLabel}
          </Text>
        </View>

        {/* Chevron */}
        <Text
          className="text-neutral-300 text-xl font-light"
          accessibilityElementsHidden
        >
          ›
        </Text>
      </View>
    </Pressable>
  );
}
