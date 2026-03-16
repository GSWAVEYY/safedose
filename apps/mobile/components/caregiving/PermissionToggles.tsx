/**
 * PermissionToggles
 *
 * Renders a list of permission toggle rows for a single caregiver relationship.
 * Each toggle saves immediately via the caregiving store (PUT /caregiving/relationships/:id).
 * An individual saving indicator per row prevents the entire card from locking during a save.
 */

import { useState, useCallback } from 'react';
import { View, Text, Switch, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCaregivingStore } from '../../store/caregiving';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PermissionTogglesProps {
  relationshipId: string;
  permissions: Record<string, boolean>;
  /** Called after a successful permission save with the full updated permissions map. */
  onUpdate: (permissions: Record<string, boolean>) => void;
  /** When true, all toggles are read-only (e.g. caregiver viewing their own access). */
  readOnly?: boolean;
}

interface PermissionDefinition {
  key: string;
  labelKey: string;
  descriptionKey: string;
}

// ─── Permission definitions ───────────────────────────────────────────────────

const PERMISSIONS: PermissionDefinition[] = [
  {
    key: 'viewMedications',
    labelKey: 'caregiving.permissions.viewMedications',
    descriptionKey: 'caregiving.permissions.viewMedicationsDesc',
  },
  {
    key: 'viewSchedule',
    labelKey: 'caregiving.permissions.viewSchedule',
    descriptionKey: 'caregiving.permissions.viewScheduleDesc',
  },
  {
    key: 'viewDoseHistory',
    labelKey: 'caregiving.permissions.viewDoseHistory',
    descriptionKey: 'caregiving.permissions.viewDoseHistoryDesc',
  },
  {
    key: 'receiveMissedDoseAlerts',
    labelKey: 'caregiving.permissions.receiveMissedDoseAlerts',
    descriptionKey: 'caregiving.permissions.receiveMissedDoseAlertsDesc',
  },
  {
    key: 'receiveRefillAlerts',
    labelKey: 'caregiving.permissions.receiveRefillAlerts',
    descriptionKey: 'caregiving.permissions.receiveRefillAlertsDesc',
  },
  {
    key: 'receiveEmergencyAlerts',
    labelKey: 'caregiving.permissions.receiveEmergencyAlerts',
    descriptionKey: 'caregiving.permissions.receiveEmergencyAlertsDesc',
  },
  {
    key: 'editMedications',
    labelKey: 'caregiving.permissions.editMedications',
    descriptionKey: 'caregiving.permissions.editMedicationsDesc',
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function PermissionToggles({
  relationshipId,
  permissions,
  onUpdate,
  readOnly = false,
}: PermissionTogglesProps) {
  const { t } = useTranslation();
  const updatePermissions = useCaregivingStore((s) => s.updatePermissions);

  // Track which permission key is currently saving so we can show a per-row indicator
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const handleToggle = useCallback(
    async (key: string, value: boolean) => {
      if (readOnly || savingKey !== null) return;

      const updated: Record<string, boolean> = { ...permissions, [key]: value };
      setSavingKey(key);
      try {
        await updatePermissions(relationshipId, updated);
        onUpdate(updated);
      } catch {
        // Error is already surfaced in the store; toggle reverts via onUpdate not being called
      } finally {
        setSavingKey(null);
      }
    },
    [readOnly, savingKey, permissions, relationshipId, updatePermissions, onUpdate]
  );

  return (
    <View className="mt-2">
      {PERMISSIONS.map((perm, index) => {
        const isEnabled = permissions[perm.key] ?? false;
        const isSaving = savingKey === perm.key;
        const isDisabled = readOnly || (savingKey !== null && savingKey !== perm.key);

        return (
          <View
            key={perm.key}
            className={`flex-row items-center justify-between py-3 ${
              index < PERMISSIONS.length - 1 ? 'border-b border-slate-100' : ''
            }`}
          >
            {/* Label + description */}
            <View className="flex-1 mr-4">
              <Text className="text-sm font-medium text-slate-800">
                {t(perm.labelKey)}
              </Text>
              <Text className="text-xs text-slate-500 mt-0.5">
                {t(perm.descriptionKey)}
              </Text>
            </View>

            {/* Saving indicator or toggle */}
            {isSaving ? (
              <ActivityIndicator size="small" color="#14B8A6" />
            ) : (
              <Switch
                value={isEnabled}
                onValueChange={(val) => handleToggle(perm.key, val)}
                disabled={isDisabled}
                trackColor={{ false: '#CBD5E1', true: '#14B8A6' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#CBD5E1"
                accessible
                accessibilityLabel={t(perm.labelKey)}
                accessibilityRole="switch"
                accessibilityState={{ checked: isEnabled, disabled: isDisabled }}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}
