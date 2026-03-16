/**
 * SeveritySlider — custom 1-10 severity selector.
 *
 * Implemented with PanResponder + View rather than a third-party slider
 * to avoid new dependencies. Color-codes the fill:
 *   1-3: green  (mild)
 *   4-6: yellow (moderate)
 *   7-8: orange (severe)
 *   9-10: red   (critical)
 *
 * Accessibility: labeled with current value and range; works with step taps.
 */

import React, { useRef, useCallback } from 'react';
import {
  View,
  Text,
  PanResponder,
  type GestureResponderEvent,
  type PanResponderGestureState,
  Pressable,
} from 'react-native';
import { useTranslation } from 'react-i18next';

interface SeveritySliderProps {
  value: number;
  onChange: (value: number) => void;
}

const MIN = 1;
const MAX = 10;
const STEPS = MAX - MIN; // 9 intervals for 10 values

function getFillColor(value: number): string {
  if (value <= 3) return '#22c55e'; // green-500
  if (value <= 6) return '#eab308'; // yellow-500
  if (value <= 8) return '#f97316'; // orange-500
  return '#ef4444'; // red-500
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function SeveritySlider({ value, onChange }: SeveritySliderProps) {
  const { t } = useTranslation();
  const trackWidth = useRef(0);

  const valueFromX = useCallback((x: number): number => {
    if (trackWidth.current === 0) return value;
    const ratio = clamp(x / trackWidth.current, 0, 1);
    return clamp(Math.round(ratio * STEPS) + MIN, MIN, MAX);
  }, [value]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        const x = e.nativeEvent.locationX;
        const next = valueFromX(x);
        onChange(next);
      },
      onPanResponderMove: (e: GestureResponderEvent, _gs: PanResponderGestureState) => {
        const x = e.nativeEvent.locationX;
        const next = valueFromX(x);
        onChange(next);
      },
    })
  ).current;

  const fillPercent = ((value - MIN) / STEPS) * 100;
  const fillColor = getFillColor(value);

  const severityLabel =
    value <= 3
      ? t('symptoms.severityMild')
      : value <= 6
      ? t('symptoms.severityModerate')
      : value <= 8
      ? t('symptoms.severitySevere')
      : t('symptoms.severityCritical');

  return (
    <View>
      {/* Value display */}
      <View className="items-center mb-3">
        <Text
          className="text-4xl font-bold"
          style={{ color: fillColor }}
          allowFontScaling
          accessibilityLabel={t('symptoms.severityValue', { value, label: severityLabel })}
        >
          {value}
        </Text>
        <Text className="text-slate-500 text-sm mt-1" allowFontScaling>
          {severityLabel}
        </Text>
      </View>

      {/* Track */}
      <View
        className="h-[44px] justify-center"
        onLayout={(e) => {
          trackWidth.current = e.nativeEvent.layout.width;
        }}
        {...panResponder.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={t('symptoms.severitySliderLabel')}
        accessibilityValue={{ min: MIN, max: MAX, now: value }}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'increment') {
            onChange(clamp(value + 1, MIN, MAX));
          } else if (e.nativeEvent.actionName === 'decrement') {
            onChange(clamp(value - 1, MIN, MAX));
          }
        }}
        accessibilityActions={[
          { name: 'increment', label: t('symptoms.increaseLabel') },
          { name: 'decrement', label: t('symptoms.decreaseLabel') },
        ]}
      >
        {/* Track background */}
        <View className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <View
            className="h-full rounded-full"
            style={{ width: `${fillPercent}%`, backgroundColor: fillColor }}
          />
        </View>

        {/* Thumb */}
        <View
          className="absolute w-6 h-6 rounded-full border-2 border-white shadow-md"
          style={{
            backgroundColor: fillColor,
            left: `${fillPercent}%`,
            marginLeft: -12,
            top: '50%',
            marginTop: -12,
          }}
          pointerEvents="none"
        />
      </View>

      {/* Labels */}
      <View className="flex-row justify-between mt-1">
        <Text className="text-slate-400 text-xs" allowFontScaling>
          {MIN} – {t('symptoms.severityMild')}
        </Text>
        <Text className="text-slate-400 text-xs" allowFontScaling>
          {MAX} – {t('symptoms.severitySevere')}
        </Text>
      </View>

      {/* Step buttons for precise control */}
      <View className="flex-row justify-between mt-3">
        <Pressable
          onPress={() => onChange(clamp(value - 1, MIN, MAX))}
          className="w-11 h-11 rounded-full bg-slate-100 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel={t('symptoms.decreaseLabel')}
          disabled={value <= MIN}
        >
          <Text className="text-slate-700 text-lg font-semibold" allowFontScaling>
            −
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onChange(clamp(value + 1, MIN, MAX))}
          className="w-11 h-11 rounded-full bg-slate-100 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel={t('symptoms.increaseLabel')}
          disabled={value >= MAX}
        >
          <Text className="text-slate-700 text-lg font-semibold" allowFontScaling>
            +
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
