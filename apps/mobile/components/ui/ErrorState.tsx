/**
 * ErrorState — reusable error / empty state display.
 *
 * Used anywhere a screen has no data, a fetch failed, or an action
 * is unavailable. Accepts a Lucide icon, title, message, and an optional
 * CTA button.
 *
 * Layout:
 *   [icon circle 80px]
 *   [title — text-xl font-bold]
 *   [message — text-base text-neutral-500]
 *   [optional CTA button — brand-600]
 *
 * Usage:
 *   import { AlertCircle } from 'lucide-react-native';
 *   <ErrorState
 *     icon={AlertCircle}
 *     title="No medications found"
 *     message="Add a medication to start tracking your doses."
 *     actionLabel="Add Medication"
 *     onAction={() => router.push('/medications/add')}
 *   />
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

interface ErrorStateProps {
  /** Lucide icon component (not JSX — pass the component reference) */
  icon: LucideIcon;
  /** Short headline shown below the icon */
  title: string;
  /** Explanatory message or guidance */
  message: string;
  /** Label for the optional call-to-action button */
  actionLabel?: string;
  /** Called when the CTA button is pressed */
  onAction?: () => void;
}

export function ErrorState({
  icon: Icon,
  title,
  message,
  actionLabel,
  onAction,
}: ErrorStateProps) {
  return (
    <View
      role="alert"
      accessibilityRole="none"
      accessibilityLiveRegion="polite"
      className="flex-1 items-center justify-center px-8 py-12"
    >
      {/* Icon circle */}
      <View
        className="w-20 h-20 rounded-full bg-neutral-100 items-center justify-center mb-5"
        aria-hidden={true}
      >
        <Icon size={36} color="#64748B" strokeWidth={1.5} />
      </View>

      {/* Title */}
      <Text
        className="text-neutral-800 text-xl font-bold text-center mb-2"
        allowFontScaling
      >
        {title}
      </Text>

      {/* Message */}
      <Text
        className="text-neutral-500 text-base text-center leading-relaxed"
        allowFontScaling
      >
        {message}
      </Text>

      {/* Optional CTA */}
      {actionLabel !== undefined && onAction !== undefined && (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          className="mt-6 bg-brand-600 rounded-2xl px-6 py-3.5 items-center active:bg-brand-700"
          style={{ minHeight: 48 }}
        >
          <Text className="text-white text-base font-semibold" allowFontScaling>
            {actionLabel}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
