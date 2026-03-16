/**
 * TimelineDay — a single day row in the symptom-medication correlation timeline.
 *
 * Displays:
 *   - Date header (e.g. "Mon, Mar 16")
 *   - Symptom badge rows: colored by severity, tag name visible
 *   - Dose event icons: green check (taken) / amber dash (skipped) / red X (missed)
 *   - Medication change markers: "Started X" / "Stopped X" in blue
 *   - Expandable via tap — shows full notes when expanded
 *
 * Accessibility: entire row is a pressable summary; expanded state announced.
 * Minimum 44pt touch target on expand toggle.
 */

import React, { useState, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Symptom, DoseLog } from '@safedose/shared-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MedicationChange {
  type: 'started' | 'stopped';
  medicationName: string;
  medicationId: string;
}

export interface TimelineDayProps {
  /** ISO 8601 date string — YYYY-MM-DD */
  date: string;
  symptoms: Symptom[];
  doses: DoseLog[];
  medicationChanges: MedicationChange[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDayHeader(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function getSeverityBadgeStyle(severity: number): { bg: string; text: string } {
  if (severity <= 3) return { bg: '#DCFCE7', text: '#15803D' }; // green-100 / green-700
  if (severity <= 6) return { bg: '#FEF9C3', text: '#A16207' }; // yellow-100 / yellow-700
  if (severity <= 8) return { bg: '#FFEDD5', text: '#C2410C' }; // orange-100 / orange-700
  return { bg: '#FEE2E2', text: '#B91C1C' };                    // red-100 / red-700
}

function getSeverityDotColor(severity: number): string {
  if (severity <= 3) return '#16A34A'; // green-600
  if (severity <= 6) return '#CA8A04'; // yellow-600
  if (severity <= 8) return '#EA580C'; // orange-600
  return '#DC2626';                    // red-600
}

function getDoseStatusIcon(eventType: DoseLog['eventType']): {
  symbol: string;
  color: string;
  label: string;
} {
  switch (eventType) {
    case 'taken':
    case 'caregiver_confirmed':
      return { symbol: '✓', color: '#16A34A', label: 'taken' };
    case 'missed':
      return { symbol: '✕', color: '#DC2626', label: 'missed' };
    case 'skipped':
      return { symbol: '–', color: '#D97706', label: 'skipped' };
    case 'late':
      return { symbol: '✓', color: '#D97706', label: 'late' };
    default:
      return { symbol: '·', color: '#94A3B8', label: 'unknown' };
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface SymptomBadgeRowProps {
  symptom: Symptom;
}

function SymptomBadgeRow({ symptom }: SymptomBadgeRowProps) {
  const { t } = useTranslation();
  const badgeStyle = getSeverityBadgeStyle(symptom.severity);
  const dotColor = getSeverityDotColor(symptom.severity);

  return (
    <View className="flex-row items-center flex-wrap mb-1.5">
      {/* Severity dot */}
      <View
        className="w-2 h-2 rounded-full mr-2 mt-0.5"
        style={{ backgroundColor: dotColor }}
        accessibilityElementsHidden
      />
      {/* Tag badges */}
      <View className="flex-row flex-wrap flex-1">
        {symptom.symptoms.map((tag) => (
          <View
            key={tag}
            className="rounded-full px-2.5 py-0.5 mr-1.5 mb-1"
            style={{ backgroundColor: badgeStyle.bg }}
            accessible
            accessibilityLabel={t('symptoms.symptomBadgeAccessibility', {
              tag,
              severity: symptom.severity,
            })}
          >
            <Text
              className="text-xs font-medium"
              style={{ color: badgeStyle.text }}
              allowFontScaling
            >
              {tag}
            </Text>
          </View>
        ))}
        <Text
          className="text-neutral-400 text-xs self-center"
          allowFontScaling
          accessibilityElementsHidden
        >
          {t('symptoms.severityShort', { value: symptom.severity })}
        </Text>
      </View>
    </View>
  );
}

interface DoseEventRowProps {
  dose: DoseLog;
}

function DoseEventRow({ dose }: DoseEventRowProps) {
  const { t } = useTranslation();
  const status = getDoseStatusIcon(dose.eventType);

  return (
    <View
      className="flex-row items-center mb-1.5"
      accessible
      accessibilityLabel={t('symptoms.doseEventAccessibility', {
        name: dose.medicationName,
        status: status.label,
      })}
    >
      {/* Status icon circle */}
      <View
        className="w-5 h-5 rounded-full items-center justify-center mr-2"
        style={{ backgroundColor: `${status.color}20` }}
        accessibilityElementsHidden
      >
        <Text
          className="text-xs font-bold"
          style={{ color: status.color }}
        >
          {status.symbol}
        </Text>
      </View>
      <Text className="text-neutral-600 text-sm flex-1" allowFontScaling numberOfLines={1}>
        {dose.medicationName}
      </Text>
      <Text
        className="text-xs font-medium"
        style={{ color: status.color }}
        allowFontScaling
      >
        {t(`symptoms.doseStatus_${dose.eventType}` as const, { defaultValue: dose.eventType })}
      </Text>
    </View>
  );
}

interface MedicationChangeRowProps {
  change: MedicationChange;
}

function MedicationChangeRow({ change }: MedicationChangeRowProps) {
  const { t } = useTranslation();
  const isStarted = change.type === 'started';

  return (
    <View
      className="flex-row items-center mb-1.5"
      accessible
      accessibilityLabel={
        isStarted
          ? t('symptoms.medicationStartedAccessibility', { name: change.medicationName })
          : t('symptoms.medicationStoppedAccessibility', { name: change.medicationName })
      }
    >
      {/* Blue pill indicator */}
      <View
        className="w-5 h-5 rounded-full items-center justify-center mr-2 bg-blue-100"
        accessibilityElementsHidden
      >
        <Text className="text-xs text-blue-600">
          {isStarted ? '+' : '–'}
        </Text>
      </View>
      <Text className="text-neutral-600 text-sm flex-1" allowFontScaling numberOfLines={1}>
        {isStarted
          ? t('symptoms.medicationStarted', { name: change.medicationName })
          : t('symptoms.medicationStopped', { name: change.medicationName })}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function TimelineDay({ date, symptoms, doses, medicationChanges }: TimelineDayProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const hasContent =
    symptoms.length > 0 || doses.length > 0 || medicationChanges.length > 0;

  const notesSymptoms = symptoms.filter((s) => s.notes !== undefined && s.notes.trim().length > 0);

  const toggleExpand = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  // Empty day — render minimal row so the timeline remains continuous
  if (!hasContent) {
    return (
      <View className="mx-4 mb-2">
        <View className="flex-row items-center">
          {/* Date column */}
          <View className="w-20 mr-3">
            <Text
              className="text-neutral-400 text-xs font-medium"
              allowFontScaling
            >
              {formatDayHeader(date)}
            </Text>
          </View>
          {/* Connector line + empty state */}
          <View className="flex-1 flex-row items-center">
            <View className="w-px h-8 bg-neutral-200 mr-3" accessibilityElementsHidden />
            <Text className="text-neutral-300 text-xs italic" allowFontScaling>
              {t('symptoms.noDataForDay')}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="mx-4 mb-3">
      <Pressable
        onPress={toggleExpand}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={t('symptoms.timelineDayAccessibility', {
          date: formatDayHeader(date),
          symptomCount: symptoms.length,
          doseCount: doses.length,
        })}
        accessibilityHint={t('symptoms.timelineDayHint')}
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
      >
        <View className="bg-white rounded-2xl p-4 shadow-sm">
          {/* Date header row */}
          <View className="flex-row items-center justify-between mb-3">
            <Text
              className="text-neutral-700 text-sm font-semibold"
              allowFontScaling
            >
              {formatDayHeader(date)}
            </Text>
            <View className="flex-row items-center">
              {/* Count pills */}
              {symptoms.length > 0 && (
                <View className="bg-brand-50 rounded-full px-2 py-0.5 mr-1.5">
                  <Text className="text-brand-600 text-xs font-medium" allowFontScaling>
                    {t('symptoms.symptomCountBadge', { count: symptoms.length })}
                  </Text>
                </View>
              )}
              {doses.length > 0 && (
                <View className="bg-neutral-100 rounded-full px-2 py-0.5 mr-1.5">
                  <Text className="text-neutral-500 text-xs font-medium" allowFontScaling>
                    {t('symptoms.doseCountBadge', { count: doses.length })}
                  </Text>
                </View>
              )}
              {/* Expand chevron */}
              <Text
                className="text-neutral-400 text-xs ml-1"
                accessibilityElementsHidden
              >
                {expanded ? '▲' : '▼'}
              </Text>
            </View>
          </View>

          {/* Medication changes — always visible */}
          {medicationChanges.map((change) => (
            <MedicationChangeRow
              key={`${change.type}-${change.medicationId}`}
              change={change}
            />
          ))}

          {/* Symptom badge rows — always visible */}
          {symptoms.map((symptom) => (
            <SymptomBadgeRow key={symptom.id} symptom={symptom} />
          ))}

          {/* Dose events — always visible */}
          {doses.map((dose) => (
            <DoseEventRow key={dose.id} dose={dose} />
          ))}

          {/* Notes section — visible only when expanded */}
          {expanded && notesSymptoms.length > 0 && (
            <View className="mt-3 pt-3 border-t border-neutral-100">
              <Text
                className="text-neutral-500 text-xs font-semibold uppercase tracking-wide mb-2"
                allowFontScaling
              >
                {t('symptoms.notesLabel')}
              </Text>
              {notesSymptoms.map((s) => (
                <View key={`notes-${s.id}`} className="mb-2">
                  <Text
                    className="text-neutral-600 text-sm leading-5"
                    allowFontScaling
                  >
                    {s.notes}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Expand hint if notes available but collapsed */}
          {!expanded && notesSymptoms.length > 0 && (
            <Text
              className="text-neutral-400 text-xs mt-2"
              allowFontScaling
              accessibilityElementsHidden
            >
              {t('symptoms.tapToSeeNotes')}
            </Text>
          )}
        </View>
      </Pressable>
    </View>
  );
}
