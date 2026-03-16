/**
 * DrugSearchInput — search-as-you-type drug name input.
 *
 * Debounces keystrokes (300ms) then queries the on-device drug database.
 * Renders a floating dropdown FlatList of matching results. Tapping a result
 * fills the input and fires onSelect. A "Not found? Enter manually" option
 * always appears at the bottom of the dropdown.
 *
 * When the user types freely without selecting from the list, the raw text
 * value is still surfaced through onChangeText — the parent screen is
 * responsible for deciding how to handle a name-only (no rxcui) entry.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { searchDrugByName } from '@/lib/interactions/drug-db';
import type { DrugSearchResult } from '@/lib/interactions/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DrugSearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSelect: (result: DrugSearchResult) => void;
  /** Optional error message displayed below the input. */
  error?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DrugSearchInput({
  value,
  onChangeText,
  onSelect,
  error,
}: DrugSearchInputProps) {
  const { t } = useTranslation();

  const [results, setResults] = useState<DrugSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [dropdownVisible, setDropdownVisible] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track whether the current value was set by the user typing (vs. by a selection)
  const isUserTypingRef = useRef(false);

  // Run search whenever value changes and the user is actively typing
  useEffect(() => {
    if (!isUserTypingRef.current) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const query = value.trim();

    if (query.length < 2) {
      setResults([]);
      setDropdownVisible(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const found = await searchDrugByName(query);
        setResults(found);
        setDropdownVisible(true);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  const handleChangeText = useCallback(
    (text: string) => {
      isUserTypingRef.current = true;
      onChangeText(text);
      if (text.trim().length === 0) {
        setResults([]);
        setDropdownVisible(false);
      }
    },
    [onChangeText],
  );

  const handleSelect = useCallback(
    (result: DrugSearchResult) => {
      isUserTypingRef.current = false;
      setDropdownVisible(false);
      setResults([]);
      onChangeText(result.name);
      onSelect(result);
    },
    [onChangeText, onSelect],
  );

  const handleManualEntry = useCallback(() => {
    isUserTypingRef.current = false;
    setDropdownVisible(false);
    setResults([]);
    // Keep the typed value as-is; parent screen handles name-only entries
  }, []);

  const handleBlur = useCallback(() => {
    // Small delay so tapping a dropdown item registers before blur hides it
    setTimeout(() => {
      setDropdownVisible(false);
    }, 200);
  }, []);

  return (
    <View className="relative">
      {/* Input */}
      <View
        className={`bg-white rounded-xl border px-4 py-3 flex-row items-center ${
          error ? 'border-red-500' : 'border-neutral-200'
        }`}
      >
        <TextInput
          value={value}
          onChangeText={handleChangeText}
          onBlur={handleBlur}
          onFocus={() => {
            if (results.length > 0) setDropdownVisible(true);
          }}
          placeholder={t('medications.drugNamePlaceholder')}
          placeholderTextColor="#94A3B8"
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel={t('medications.drugName')}
          className="flex-1 text-neutral-900 text-base"
          allowFontScaling
        />
        {isSearching && (
          <ActivityIndicator
            size="small"
            color="#14B8A6"
            accessibilityLabel={t('common.loading')}
          />
        )}
      </View>

      {/* Error */}
      {error ? (
        <Text className="text-red-500 text-xs mt-1 ml-1">{error}</Text>
      ) : null}

      {/* Dropdown */}
      {dropdownVisible && (
        <View className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-neutral-200 shadow-md z-50 max-h-64 overflow-hidden">
          <FlatList
            data={results}
            keyExtractor={(item) => item.rxcui}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleSelect(item)}
                accessibilityRole="button"
                accessibilityLabel={`${item.name}${item.drugClass ? `, ${item.drugClass}` : ''}`}
                className="px-4 py-3 border-b border-neutral-100 active:bg-neutral-50"
              >
                <Text
                  className="text-neutral-900 text-base font-medium"
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                {item.drugClass ? (
                  <Text
                    className="text-neutral-400 text-xs mt-0.5"
                    numberOfLines={1}
                  >
                    {t('medications.drugClass')}: {item.drugClass}
                  </Text>
                ) : null}
              </Pressable>
            )}
            ListFooterComponent={
              <Pressable
                onPress={handleManualEntry}
                accessibilityRole="button"
                accessibilityLabel={t('medications.notFoundEnterManually')}
                className="px-4 py-3 active:bg-neutral-50"
              >
                <Text className="text-brand-600 text-sm font-medium">
                  {t('medications.notFoundEnterManually')}
                </Text>
              </Pressable>
            }
          />
        </View>
      )}
    </View>
  );
}
