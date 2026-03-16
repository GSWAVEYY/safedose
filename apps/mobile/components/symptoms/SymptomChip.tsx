/**
 * SymptomChip — tappable tag chip for selecting symptom types.
 *
 * Selected state: teal background, white text.
 * Unselected state: white background with slate border, dark text.
 * Minimum 44pt touch target per accessibility guidelines.
 */

import React from 'react';
import { Pressable, Text } from 'react-native';

interface SymptomChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}

export function SymptomChip({
  label,
  selected,
  onPress,
  accessibilityLabel,
}: SymptomChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      className={[
        'min-h-[44px] px-4 py-2 rounded-full mr-2 mb-2',
        'items-center justify-center border',
        selected
          ? 'bg-teal-500 border-teal-500'
          : 'bg-white border-slate-300',
      ].join(' ')}
      style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
    >
      <Text
        className={[
          'text-sm font-medium',
          selected ? 'text-white' : 'text-slate-700',
        ].join(' ')}
        allowFontScaling
      >
        {label}
      </Text>
    </Pressable>
  );
}
