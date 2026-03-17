/**
 * ExportButton — reusable PDF export trigger component.
 *
 * Props:
 *   type  — 'doseHistory' | 'emergencyCard'
 *   userId — user/patient ID to fetch data for
 *   days  — number of history days (doseHistory only, default 30)
 *
 * Feature gating:
 *   - doseHistory requires pdfExport feature (family tier)
 *     → locked users see a paywall overlay via FeatureLock
 *   - emergencyCard is available to all tiers (no gate)
 *
 * UX flow:
 *   Press → show loading spinner → generate PDF → open share sheet
 *   On error → show Alert with user-friendly message
 *
 * The component handles its own loading state so callers stay simple:
 *   <ExportButton type="emergencyCard" userId={userId} />
 */

import React, { useState, useCallback } from 'react';
import { Alert, ActivityIndicator, View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSubscriptionStore } from '../../store/subscription';
import { isFeatureAvailable } from '../../lib/subscriptions/features';
import { exportDoseHistory, exportEmergencyCard, ExportError } from '../../lib/export/index';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExportButtonProps {
  type: 'doseHistory' | 'emergencyCard';
  userId: string;
  /** Days of history to include — only used when type = 'doseHistory'. Default 30. */
  days?: number;
  /** Override the default button label */
  label?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ExportButton({ type, userId, days = 30, label }: ExportButtonProps) {
  const router = useRouter();
  const tier = useSubscriptionStore((s) => s.tier);
  const [isGenerating, setIsGenerating] = useState(false);

  // Determine if this action is gated
  const isHistoryExport = type === 'doseHistory';
  const isLocked = isHistoryExport && !isFeatureAvailable('pdfExport', tier);

  const defaultLabel = isHistoryExport ? 'Export History as PDF' : 'Export as PDF';
  const buttonLabel = label ?? defaultLabel;

  const handlePress = useCallback(async () => {
    // If locked, route to paywall instead of attempting generation
    if (isLocked) {
      router.push('/paywall');
      return;
    }

    setIsGenerating(true);
    try {
      if (isHistoryExport) {
        await exportDoseHistory(userId, days, tier);
      } else {
        await exportEmergencyCard(userId);
      }
    } catch (err) {
      // Surface user-friendly messages; swallow low-level details
      const message =
        err instanceof ExportError
          ? err.message
          : 'An unexpected error occurred while generating the PDF. Please try again.';

      Alert.alert('Export Failed', message);
      console.error('[ExportButton] export failed:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [isLocked, isHistoryExport, userId, days, tier, router]);

  // ── Locked state ────────────────────────────────────────────────────────────

  if (isLocked) {
    return (
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={`${buttonLabel} — requires Family plan`}
        accessibilityHint="Tap to upgrade your subscription"
        style={{ minHeight: 56 }}
        className="relative rounded-2xl overflow-hidden"
      >
        {/* Dimmed button body */}
        <View
          className="opacity-50 bg-slate-800 rounded-2xl items-center justify-center px-6"
          style={{ minHeight: 56 }}
          aria-hidden
        >
          <Text className="text-white font-semibold text-base">{buttonLabel}</Text>
        </View>

        {/* Lock overlay pill */}
        <View
          className="absolute inset-0 items-center justify-center"
          pointerEvents="none"
        >
          <View className="bg-neutral-900/80 rounded-full px-4 py-2 flex-row items-center gap-x-2">
            <Text className="text-white text-base" accessible={false}>
              {'\uD83D\uDD12'}
            </Text>
            <Text className="text-white text-sm font-semibold">
              Family Plan Required
            </Text>
          </View>
        </View>
      </Pressable>
    );
  }

  // ── Active state ─────────────────────────────────────────────────────────────

  return (
    <Pressable
      onPress={handlePress}
      disabled={isGenerating}
      accessibilityRole="button"
      accessibilityLabel={isGenerating ? 'Generating PDF...' : buttonLabel}
      accessibilityState={{ busy: isGenerating }}
      style={{ minHeight: 56 }}
      className={`bg-slate-800 rounded-2xl items-center justify-center px-6 active:bg-slate-900 ${
        isGenerating ? 'opacity-70' : ''
      }`}
    >
      {isGenerating ? (
        <View className="flex-row items-center gap-x-3">
          <ActivityIndicator size="small" color="#ffffff" />
          <Text className="text-white font-semibold text-base">Generating PDF...</Text>
        </View>
      ) : (
        <Text className="text-white font-semibold text-base">{buttonLabel}</Text>
      )}
    </Pressable>
  );
}
