/**
 * Medication Detail screen — [id].tsx
 *
 * Displays full information for a single medication:
 *   - Header: name + status badge
 *   - Info card: strength, dosage form, route, instructions, prescriber, pharmacy
 *   - Interaction warnings: severity badges, tap to expand full InteractionAlert
 *   - Schedule section: active schedules or placeholder
 *   - Adherence: % taken in last 30 days from dose-log
 *   - Action buttons: Edit (navigates to add screen in edit mode, future sprint),
 *     Pause/Resume toggle, Discontinue (with confirmation), Delete (with confirmation)
 *
 * Uses useLocalSearchParams() to resolve the medication ID.
 * Loads schedule and adherence on mount.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useMedicationsStore } from '@/store/medications';
import { getSchedulesForMedication } from '@/lib/db/schedules';
import { getAdherenceRate } from '@/lib/db/dose-log';
import type { Schedule } from '@safedose/shared-types';
import type { DrugInteraction } from '@/lib/interactions/types';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { InteractionAlert } from '@/components/medications/InteractionAlert';
import { ExportButton } from '@/components/export/ExportButton';

const PLACEHOLDER_USER_ID = 'local-user';

// ---------------------------------------------------------------------------
// Status badge helper (mirrors MedCard logic)
// ---------------------------------------------------------------------------

function StatusBadge({ isActive, endedAt }: { isActive: boolean; endedAt?: string }) {
  const { t } = useTranslation();

  if (endedAt) {
    return (
      <View className="px-3 py-1 rounded-full bg-neutral-100">
        <Text className="text-neutral-500 text-xs font-semibold">
          {t('medications.statusDiscontinued')}
        </Text>
      </View>
    );
  }
  if (!isActive) {
    return (
      <View className="px-3 py-1 rounded-full bg-amber-100">
        <Text className="text-amber-700 text-xs font-semibold">
          {t('medications.statusPaused')}
        </Text>
      </View>
    );
  }
  return (
    <View className="px-3 py-1 rounded-full bg-green-100">
      <Text className="text-green-700 text-xs font-semibold">
        {t('medications.statusActive')}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Info row — label + value
// ---------------------------------------------------------------------------

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start py-2 border-b border-neutral-100 last:border-0">
      <Text className="text-neutral-400 text-sm w-28 flex-shrink-0">{label}</Text>
      <Text className="text-neutral-800 text-sm flex-1 font-medium">{value}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Severity badge for interaction list
// ---------------------------------------------------------------------------

const SEVERITY_BADGE: Record<string, { bg: string; text: string }> = {
  contraindicated: { bg: 'bg-red-100', text: 'text-red-700' },
  major:           { bg: 'bg-orange-100', text: 'text-orange-700' },
  moderate:        { bg: 'bg-amber-100', text: 'text-amber-700' },
  minor:           { bg: 'bg-blue-100', text: 'text-blue-700' },
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function MedicationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();

  const {
    medications,
    interactionResults,
    pauseMedication,
    resumeMedication,
    discontinueMedication,
    removeMedication,
    isLoading,
  } = useMedicationsStore();

  const medication = medications.find((m) => m.id === id);

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [adherenceRate, setAdherenceRate] = useState<number | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(true);

  // Selected interaction to show in alert
  const [selectedInteraction, setSelectedInteraction] = useState<DrugInteraction | null>(null);

  // Update navigation header title when medication loads
  useEffect(() => {
    if (medication) {
      navigation.setOptions({ title: medication.name });
    }
  }, [medication, navigation]);

  // Load schedules + adherence on mount
  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    (async () => {
      setIsLoadingDetails(true);
      try {
        const [sched, rate] = await Promise.all([
          getSchedulesForMedication(id),
          getAdherenceRate(id, 30),
        ]);
        if (!cancelled) {
          setSchedules(sched);
          setAdherenceRate(rate);
        }
      } catch {
        // Non-fatal — display empty states
      } finally {
        if (!cancelled) setIsLoadingDetails(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  // ---------------------------------------------------------------------------
  // Action handlers
  // ---------------------------------------------------------------------------

  const handlePauseResume = useCallback(async () => {
    if (!medication) return;
    if (medication.isActive && !medication.endedAt) {
      Alert.alert(
        t('medications.confirmPause'),
        t('medications.confirmPauseMessage').replace('{{name}}', medication.name),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('medications.pauseMedication'),
            onPress: () => pauseMedication(medication.id),
          },
        ],
      );
    } else {
      await resumeMedication(medication.id);
    }
  }, [medication, t, pauseMedication, resumeMedication]);

  const handleDiscontinue = useCallback(() => {
    if (!medication) return;
    Alert.alert(
      t('medications.confirmDiscontinue'),
      t('medications.confirmDiscontinueMessage').replace('{{name}}', medication.name),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('medications.discontinueMedication'),
          style: 'destructive',
          onPress: () => discontinueMedication(medication.id),
        },
      ],
    );
  }, [medication, t, discontinueMedication]);

  const handleDelete = useCallback(() => {
    if (!medication) return;
    Alert.alert(
      t('medications.confirmDelete'),
      t('medications.confirmDeleteMessage').replace('{{name}}', medication.name),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            await removeMedication(medication.id);
            router.back();
          },
        },
      ],
    );
  }, [medication, t, removeMedication, router]);

  // ---------------------------------------------------------------------------
  // Render: loading / not found
  // ---------------------------------------------------------------------------

  if (!medication) {
    return (
      <SafeAreaView className="flex-1 bg-neutral-50 items-center justify-center">
        {isLoading ? (
          <ActivityIndicator size="large" color="#14B8A6" />
        ) : (
          <Text className="text-neutral-500 text-base">{t('common.error')}</Text>
        )}
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: detail
  // ---------------------------------------------------------------------------

  const interactions = interactionResults[medication.id]?.interactions ?? [];
  const isDiscontinued = Boolean(medication.endedAt);
  const isActive = medication.isActive && !isDiscontinued;

  const adherencePercent =
    adherenceRate !== null ? Math.round(adherenceRate * 100) : null;

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 py-5 gap-y-4"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between mb-1">
          <Text
            className="text-neutral-900 text-2xl font-bold flex-1 mr-3"
            allowFontScaling
            numberOfLines={2}
          >
            {medication.name}
          </Text>
          <StatusBadge isActive={medication.isActive} endedAt={medication.endedAt} />
        </View>

        {/* Info card */}
        <Card>
          <InfoRow
            label={t('medications.strength')}
            value={`${medication.dosageAmount} ${t(`dosageUnits.${medication.dosageUnit}`)}`}
          />
          <InfoRow
            label={t('medications.dosageForm')}
            value={t(`dosageUnits.${medication.dosageUnit}`)}
          />
          <InfoRow
            label={t('medications.route')}
            value={t(`dosageRoutes.${medication.route}`)}
          />
          {medication.instructions ? (
            <InfoRow label={t('medications.instructions')} value={medication.instructions} />
          ) : null}
          {medication.prescriber ? (
            <InfoRow label={t('medications.prescriber_label')} value={medication.prescriber} />
          ) : null}
          {medication.pharmacy ? (
            <InfoRow label={t('medications.pharmacy_label')} value={medication.pharmacy} />
          ) : null}
          {medication.startedAt ? (
            <InfoRow
              label={t('medications.startedAt')}
              value={new Date(medication.startedAt).toLocaleDateString()}
            />
          ) : null}
          {medication.expiresAt ? (
            <InfoRow
              label={t('medications.expiresAt')}
              value={new Date(medication.expiresAt).toLocaleDateString()}
            />
          ) : null}
          {medication.refillsRemaining !== undefined ? (
            <InfoRow
              label={t('medications.refillsRemaining')}
              value={String(medication.refillsRemaining)}
            />
          ) : null}
        </Card>

        {/* Interaction warnings */}
        <View>
          <Text className="text-neutral-500 text-xs font-semibold uppercase tracking-wider mb-2">
            {t('medications.interactions')}
          </Text>
          {interactions.length === 0 ? (
            <Card>
              <Text className="text-neutral-500 text-sm">{t('medications.noInteractions')}</Text>
            </Card>
          ) : (
            <View className="gap-y-2">
              {interactions.map((interaction, index) => {
                const badgeStyle = SEVERITY_BADGE[interaction.severity] ?? SEVERITY_BADGE.minor;
                return (
                  <Pressable
                    key={`${interaction.rxcui1}-${interaction.rxcui2}-${index}`}
                    onPress={() => setSelectedInteraction(interaction)}
                    accessibilityRole="button"
                    accessibilityLabel={`${t(`interactions.${interaction.severity}`)}: ${interaction.drug1Name} and ${interaction.drug2Name}. Tap for details.`}
                    className="active:opacity-70"
                  >
                    <Card>
                      <View className="flex-row items-center justify-between">
                        <View className="flex-1 mr-3">
                          <Text className="text-neutral-800 text-sm font-medium" numberOfLines={2}>
                            {interaction.drug1Name} + {interaction.drug2Name}
                          </Text>
                          <Text className="text-neutral-400 text-xs mt-0.5" numberOfLines={1}>
                            {interaction.description}
                          </Text>
                        </View>
                        <View className={`px-2.5 py-1 rounded-full ${badgeStyle.bg}`}>
                          <Text className={`text-xs font-bold ${badgeStyle.text}`} allowFontScaling={false}>
                            {t(`interactions.${interaction.severity}`)}
                          </Text>
                        </View>
                      </View>
                    </Card>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* Schedule section */}
        <View>
          <Text className="text-neutral-500 text-xs font-semibold uppercase tracking-wider mb-2">
            {t('medications.schedule')}
          </Text>
          {isLoadingDetails ? (
            <Card>
              <ActivityIndicator size="small" color="#14B8A6" />
            </Card>
          ) : schedules.length === 0 ? (
            <Card>
              <Text className="text-neutral-500 text-sm">{t('medications.noSchedule')}</Text>
            </Card>
          ) : (
            <View className="gap-y-2">
              {schedules.map((schedule) => (
                <Card key={schedule.id}>
                  <Text className="text-neutral-800 text-sm font-medium">
                    {(schedule.times as string[]).join(', ')}
                  </Text>
                  <Text className="text-neutral-400 text-xs mt-0.5">
                    {schedule.frequencyValue}x {schedule.frequencyUnit}
                    {schedule.withFood ? ` · ${t('medications.withFood')}` : ''}
                  </Text>
                </Card>
              ))}
            </View>
          )}
        </View>

        {/* Adherence */}
        <View>
          <Text className="text-neutral-500 text-xs font-semibold uppercase tracking-wider mb-2">
            {t('medications.adherence')}
          </Text>
          <Card>
            {isLoadingDetails ? (
              <ActivityIndicator size="small" color="#14B8A6" />
            ) : adherencePercent !== null ? (
              <View>
                <Text className="text-neutral-900 text-2xl font-bold">
                  {adherencePercent}%
                </Text>
                <Text className="text-neutral-500 text-sm mt-0.5">
                  {t('medications.adherenceLast30').replace('{{percent}}', String(adherencePercent))}
                </Text>
              </View>
            ) : (
              <Text className="text-neutral-400 text-sm">
                {t('medications.noSchedule')}
              </Text>
            )}
          </Card>
        </View>

        {/* Bottom spacer */}
        <View className="h-4" />
      </ScrollView>

      {/* Action buttons (pinned to bottom) */}
      <View className="px-4 pb-6 pt-3 bg-neutral-50 border-t border-neutral-100 gap-y-3">
        {/* Edit — placeholder until edit screen is built */}
        <Button
          label={t('common.edit')}
          variant="secondary"
          onPress={() => {
            // Edit screen will be built in a future sprint
            Alert.alert(t('common.edit'), 'Edit form coming in next sprint.');
          }}
          accessibilityLabel={t('medications.editMedication')}
        />

        {/* Export history — feature-gated to Family tier */}
        <ExportButton
          type="doseHistory"
          userId={PLACEHOLDER_USER_ID}
          days={30}
          label="Export History as PDF"
        />

        {/* Pause / Resume */}
        {!isDiscontinued && (
          <Button
            label={isActive ? t('medications.pauseMedication') : t('medications.resumeMedication')}
            variant="secondary"
            onPress={handlePauseResume}
            disabled={isLoading}
            accessibilityLabel={isActive ? t('medications.pauseMedication') : t('medications.resumeMedication')}
          />
        )}

        {/* Discontinue */}
        {!isDiscontinued && (
          <Button
            label={t('medications.discontinueMedication')}
            variant="secondary"
            onPress={handleDiscontinue}
            disabled={isLoading}
            accessibilityLabel={t('medications.discontinueMedication')}
          />
        )}

        {/* Delete */}
        <Button
          label={t('medications.deleteMedication')}
          variant="danger"
          onPress={handleDelete}
          disabled={isLoading}
          accessibilityLabel={t('medications.deleteMedication')}
        />
      </View>

      {/* Interaction detail modal */}
      {selectedInteraction ? (
        <InteractionAlert
          interaction={selectedInteraction}
          visible
          onDismiss={() => setSelectedInteraction(null)}
        />
      ) : null}
    </SafeAreaView>
  );
}
