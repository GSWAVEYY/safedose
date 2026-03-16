/**
 * PatternCard — displays a detected symptom pattern from the frequency analysis.
 *
 * Shows:
 *   - Symptom name + occurrence count / days window
 *   - Mini frequency bar (proportional fill, severity-colour coded)
 *   - Severity trend indicator: up / down / stable arrow
 *   - Optional related-medication correlation hint
 *
 * Kept large and readable — target audience includes elderly users.
 * Minimum 44pt touch targets on all interactive elements.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SeverityTrend = 'up' | 'down' | 'stable';

export interface PatternCardProps {
  /** Symptom tag label (human-readable, already translated or raw key). */
  symptomLabel: string;
  /** How many times this symptom appeared. */
  occurrences: number;
  /** The days window this count is over (e.g. 7, 14, 30). */
  dayWindow: number;
  /** 0-1 fraction for the fill bar (occurrences / dayWindow, capped at 1). */
  frequency: number;
  /** Average severity for this symptom over the window (1-10). */
  avgSeverity: number;
  /** Whether the average severity is trending up, down, or stable. */
  trend: SeverityTrend;
  /** Name of a medication correlated with this symptom, if detected. */
  correlatedMedication?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSeverityBarColor(avgSeverity: number): string {
  if (avgSeverity <= 3) return '#16A34A'; // green-600
  if (avgSeverity <= 6) return '#D97706'; // amber-600
  if (avgSeverity <= 8) return '#EA580C'; // orange-600
  return '#DC2626'; // red-600
}

function getTrendSymbol(trend: SeverityTrend): string {
  if (trend === 'up') return '↑';
  if (trend === 'down') return '↓';
  return '→';
}

function getTrendColor(trend: SeverityTrend): string {
  if (trend === 'up') return '#DC2626'; // red — worsening
  if (trend === 'down') return '#16A34A'; // green — improving
  return '#64748B'; // neutral
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PatternCard({
  symptomLabel,
  occurrences,
  dayWindow,
  frequency,
  avgSeverity,
  trend,
  correlatedMedication,
}: PatternCardProps) {
  const { t } = useTranslation();

  const barColor = getSeverityBarColor(avgSeverity);
  const fillPercent = Math.min(frequency * 100, 100);
  const trendSymbol = getTrendSymbol(trend);
  const trendColor = getTrendColor(trend);

  const trendLabel =
    trend === 'up'
      ? t('symptoms.trendWorsening')
      : trend === 'down'
      ? t('symptoms.trendImproving')
      : t('symptoms.trendStable');

  return (
    <View
      className="bg-white rounded-2xl p-4 mb-3 shadow-sm"
      accessible
      accessibilityRole="summary"
      accessibilityLabel={t('symptoms.patternCardAccessibility', {
        symptom: symptomLabel,
        occurrences,
        dayWindow,
        trend: trendLabel,
      })}
    >
      {/* Header row: symptom name + trend */}
      <View className="flex-row items-center justify-between mb-2">
        <Text
          className="text-neutral-800 text-base font-semibold flex-1 mr-2"
          allowFontScaling
          numberOfLines={1}
        >
          {symptomLabel}
        </Text>
        <View className="flex-row items-center">
          <Text
            className="text-sm font-bold mr-1"
            style={{ color: trendColor }}
            allowFontScaling
            accessibilityElementsHidden
          >
            {trendSymbol}
          </Text>
          <Text
            className="text-xs font-medium"
            style={{ color: trendColor }}
            allowFontScaling
          >
            {trendLabel}
          </Text>
        </View>
      </View>

      {/* Occurrence count */}
      <Text
        className="text-neutral-500 text-sm mb-3"
        allowFontScaling
      >
        {t('symptoms.patternOccurrences', { count: occurrences, days: dayWindow })}
      </Text>

      {/* Frequency bar */}
      <View
        className="h-2 bg-neutral-100 rounded-full overflow-hidden mb-3"
        accessibilityElementsHidden
      >
        <View
          className="h-full rounded-full"
          style={{ width: `${fillPercent}%`, backgroundColor: barColor }}
        />
      </View>

      {/* Severity label */}
      <View className="flex-row items-center justify-between">
        <Text className="text-neutral-400 text-xs" allowFontScaling>
          {t('symptoms.avgSeverity', { value: avgSeverity.toFixed(1) })}
        </Text>
        <View
          className="px-2 py-0.5 rounded-full"
          style={{ backgroundColor: `${barColor}20` }}
        >
          <Text
            className="text-xs font-semibold"
            style={{ color: barColor }}
            allowFontScaling
          >
            {avgSeverity <= 3
              ? t('symptoms.severityMild')
              : avgSeverity <= 6
              ? t('symptoms.severityModerate')
              : avgSeverity <= 8
              ? t('symptoms.severitySevere')
              : t('symptoms.severityCritical')}
          </Text>
        </View>
      </View>

      {/* Correlation hint */}
      {correlatedMedication !== undefined && (
        <View className="mt-3 pt-3 border-t border-neutral-100 flex-row items-start">
          <Text
            className="text-neutral-400 text-xs mr-1"
            accessibilityElementsHidden
          >
            💊
          </Text>
          <Text
            className="text-neutral-500 text-xs flex-1 leading-5"
            allowFontScaling
          >
            {t('symptoms.correlationHint', { medication: correlatedMedication })}
          </Text>
        </View>
      )}
    </View>
  );
}
