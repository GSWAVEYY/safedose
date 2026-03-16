/**
 * RelationshipCard
 *
 * Displays a single caregiver/patient relationship with:
 * - Name, role badge, status indicator, last-active time
 * - Expand/collapse to reveal PermissionToggles
 * - Revoke button with a two-step confirmation dialog
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { PermissionToggles } from './PermissionToggles';
import { useCaregivingStore } from '../../store/caregiving';
import type { Relationship, CaregiverRole, RelationshipStatus } from '../../store/caregiving';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RelationshipCardProps {
  relationship: Relationship;
  /** Controls whether the permission toggles are editable (only the patient can edit). */
  canEditPermissions?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_BADGE: Record<CaregiverRole, { label: string; className: string }> = {
  primary: { label: 'caregiving.roles.primary', className: 'bg-teal-500' },
  observer: { label: 'caregiving.roles.observer', className: 'bg-blue-500' },
};

// emergency_only is sent as a role string on invite but stored as 'observer' with restricted perms;
// we handle the display-only badge here in case the API ever returns it as a string.
const EMERGENCY_BADGE = { label: 'caregiving.roles.emergency', className: 'bg-slate-500' };

function getRoleBadge(role: string) {
  if (role === 'primary') return ROLE_BADGE.primary;
  if (role === 'observer') return ROLE_BADGE.observer;
  return EMERGENCY_BADGE;
}

const STATUS_STYLES: Record<RelationshipStatus, { dot: string; text: string; label: string }> = {
  pending: {
    dot: 'bg-amber-400',
    text: 'text-amber-600',
    label: 'caregiving.status.pending',
  },
  accepted: {
    dot: 'bg-emerald-400',
    text: 'text-emerald-600',
    label: 'caregiving.status.active',
  },
  revoked: {
    dot: 'bg-red-400',
    text: 'text-red-500',
    label: 'caregiving.status.revoked',
  },
  expired: {
    dot: 'bg-slate-400',
    text: 'text-slate-500',
    label: 'caregiving.status.expired',
  },
};

function formatLastActive(isoDate: string | null): string {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RelationshipCard({
  relationship,
  canEditPermissions = false,
}: RelationshipCardProps) {
  const { t } = useTranslation();
  const revokeRelationship = useCaregivingStore((s) => s.revokeRelationship);

  const [expanded, setExpanded] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [localPermissions, setLocalPermissions] = useState<Record<string, boolean>>(
    relationship.permissions
  );

  const badge = getRoleBadge(relationship.role);
  const statusStyle = STATUS_STYLES[relationship.status] ?? STATUS_STYLES.expired;
  const displayName = relationship.otherUserName ?? t('caregiving.unknownUser');
  const isRevoked = relationship.status === 'revoked';

  const handleRevoke = useCallback(() => {
    Alert.alert(
      t('caregiving.revokeTitle'),
      t('caregiving.revokeMessage', { name: displayName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('caregiving.revokeConfirm'),
          style: 'destructive',
          onPress: async () => {
            setIsRevoking(true);
            try {
              await revokeRelationship(relationship.id);
            } catch {
              // Error is surfaced in store; nothing to do here
            } finally {
              setIsRevoking(false);
            }
          },
        },
      ]
    );
  }, [t, displayName, relationship.id, revokeRelationship]);

  return (
    <Card className={`mb-3 ${isRevoked ? 'opacity-60' : ''}`}>
      {/* Header row — always visible */}
      <Pressable
        onPress={() => setExpanded((prev) => !prev)}
        accessible
        accessibilityRole="button"
        accessibilityLabel={t('caregiving.expandRelationship', { name: displayName })}
        accessibilityState={{ expanded }}
        className="flex-row items-center"
      >
        {/* Avatar placeholder */}
        <View className="w-11 h-11 rounded-full bg-slate-200 items-center justify-center mr-3 shrink-0">
          <Text className="text-lg font-bold text-slate-500" aria-hidden>
            {displayName.charAt(0).toUpperCase()}
          </Text>
        </View>

        {/* Name + badges */}
        <View className="flex-1">
          <View className="flex-row items-center flex-wrap gap-2">
            <Text
              className={`text-sm font-semibold text-slate-800 ${isRevoked ? 'line-through' : ''}`}
            >
              {displayName}
            </Text>

            {/* Role badge */}
            <View className={`px-2 py-0.5 rounded-full ${badge.className}`}>
              <Text className="text-xs font-medium text-white">
                {t(badge.label)}
              </Text>
            </View>
          </View>

          {/* Status row */}
          <View className="flex-row items-center mt-1 gap-1.5">
            <View className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
            <Text className={`text-xs ${statusStyle.text}`}>
              {t(statusStyle.label)}
            </Text>
            {relationship.acceptedAt && (
              <Text className="text-xs text-slate-400 ml-1">
                · {formatLastActive(relationship.acceptedAt)}
              </Text>
            )}
          </View>
        </View>

        {/* Chevron */}
        <Text className="text-slate-400 text-lg ml-2" aria-hidden>
          {expanded ? '⌃' : '⌄'}
        </Text>
      </Pressable>

      {/* Expanded: permission toggles + revoke */}
      {expanded && (
        <View className="mt-4 pt-4 border-t border-slate-100">
          {!isRevoked && (
            <>
              <Text className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
                {t('caregiving.permissions.sectionTitle')}
              </Text>
              <PermissionToggles
                relationshipId={relationship.id}
                permissions={localPermissions}
                onUpdate={setLocalPermissions}
                readOnly={!canEditPermissions}
              />
            </>
          )}

          {/* Revoke button — shown only if not already revoked */}
          {!isRevoked && (
            <View className="mt-4">
              {isRevoking ? (
                <ActivityIndicator size="small" color="#EF4444" />
              ) : (
                <Button
                  label={t('caregiving.revokeAccess')}
                  variant="danger"
                  onPress={handleRevoke}
                  accessibilityLabel={t('caregiving.revokeAccessLabel', { name: displayName })}
                />
              )}
            </View>
          )}
        </View>
      )}
    </Card>
  );
}
