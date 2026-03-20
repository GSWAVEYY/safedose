/**
 * Medications list screen.
 *
 * Features:
 *   - Real-time debounced search (300ms) via store.searchMedications
 *   - FlashList with section headers grouped by time-of-day bucket
 *   - Staggered entrance animation (Reanimated FadeInDown, 50ms per card)
 *   - Loading skeleton state (ActivityIndicator while initial load)
 *   - Amber error banner with retry
 *   - Empty state with Pill icon and Add CTA
 *   - Pull-to-refresh (brand-500 tint)
 *   - FAB (brand-600, Plus icon) with spring scale on press
 *   - Full accessibility: accessibilityRole, accessibilityLabel on all interactive elements
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Search, Pill, Plus, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { useMedicationsStore } from '../../../store/medications';
import { MedCard } from '../../../components/medications/MedCard';
import type { Medication } from '@safedose/shared-types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Brand-600 teal — single source of truth for imperative color usage */
const BRAND_600 = '#0D9488';
const BRAND_500 = '#14B8A6';
const BRAND_200 = '#99F6E4';
const BRAND_50  = '#F0FDFA';

const SEARCH_DEBOUNCE_MS = 300;

// ---------------------------------------------------------------------------
// Time-of-day bucketing
// ---------------------------------------------------------------------------

type TimeOfDay = 'Morning' | 'Afternoon' | 'Evening' | 'As Needed';

const TIME_BUCKETS: TimeOfDay[] = ['Morning', 'Afternoon', 'Evening', 'As Needed'];

/**
 * Deterministic bucket assignment — distributes medications across time-of-day
 * sections based on the last character of their ID. This keeps order stable
 * across re-renders without requiring schedule data.
 *
 * In a future sprint, swap this for actual schedule time from the schedules table.
 */
function bucketForMedication(med: Medication): TimeOfDay {
  // Inactive / discontinued always land in As Needed visually
  if (!med.isActive || med.endedAt) return 'As Needed';
  const code = med.id.charCodeAt(med.id.length - 1);
  return TIME_BUCKETS[code % 3] as TimeOfDay; // 0=Morning,1=Afternoon,2=Evening
}

// ---------------------------------------------------------------------------
// List item types — section header + med card rows
// ---------------------------------------------------------------------------

interface SectionHeaderItem {
  kind: 'header';
  title: TimeOfDay;
}

interface MedItem {
  kind: 'med';
  medication: Medication;
  /** Index within the full flattened list, used for stagger delay */
  index: number;
}

type ListItem = SectionHeaderItem | MedItem;

function buildListItems(medications: Medication[]): ListItem[] {
  if (medications.length === 0) return [];

  const buckets = new Map<TimeOfDay, Medication[]>();
  for (const bucket of TIME_BUCKETS) {
    buckets.set(bucket, []);
  }

  for (const med of medications) {
    const bucket = bucketForMedication(med);
    buckets.get(bucket)!.push(med);
  }

  const items: ListItem[] = [];
  let cardIndex = 0;

  for (const bucket of TIME_BUCKETS) {
    const meds = buckets.get(bucket) ?? [];
    if (meds.length === 0) continue;

    items.push({ kind: 'header', title: bucket });
    for (const med of meds) {
      items.push({ kind: 'med', medication: med, index: cardIndex });
      cardIndex++;
    }
  }

  return items;
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------

interface SectionHeaderProps {
  title: TimeOfDay;
}

function SectionHeader({ title }: SectionHeaderProps) {
  return (
    <View className="px-4 pt-5 pb-2">
      <Text
        className="text-neutral-500 text-xs font-semibold uppercase tracking-widest"
        allowFontScaling
        accessibilityRole="header"
      >
        {title}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Animated med card row
// ---------------------------------------------------------------------------

interface AnimatedMedRowProps {
  medication: Medication;
  hasInteraction: boolean;
  index: number;
  onPress: (id: string) => void;
}

function AnimatedMedRow({ medication, hasInteraction, index, onPress }: AnimatedMedRowProps) {
  const handlePress = useCallback(() => onPress(medication.id), [medication.id, onPress]);

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50).duration(300).springify()}
      className="px-4 pb-3"
    >
      <MedCard
        medication={medication}
        hasInteraction={hasInteraction}
        onPress={handlePress}
      />
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

interface EmptyStateProps {
  onAddPress: () => void;
}

function EmptyState({ onAddPress }: EmptyStateProps) {
  const { t } = useTranslation();

  return (
    <View
      className="flex-1 items-center justify-center px-8 py-16"
      accessibilityLiveRegion="polite"
    >
      {/* Icon circle */}
      <View
        className="w-20 h-20 rounded-full items-center justify-center mb-5"
        style={{ backgroundColor: BRAND_50 }}
        accessibilityElementsHidden
      >
        <Pill size={40} color={BRAND_200} strokeWidth={1.5} />
      </View>

      <Text
        className="text-neutral-800 text-xl font-bold text-center mb-2"
        allowFontScaling
        accessibilityRole="header"
      >
        {t('medications.noMedications')}
      </Text>

      <Text
        className="text-neutral-400 text-base text-center mb-8"
        allowFontScaling
      >
        {t('medications.noMedicationsMessage')}
      </Text>

      <Pressable
        onPress={onAddPress}
        accessibilityRole="button"
        accessibilityLabel={t('medications.addFirstMedication')}
        className="bg-brand-600 rounded-2xl px-8 py-3.5 min-h-[44px] items-center justify-center"
      >
        <Text
          className="text-white text-base font-semibold"
          allowFontScaling={false}
        >
          {t('medications.addFirstMedication')}
        </Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Error banner
// ---------------------------------------------------------------------------

interface ErrorBannerProps {
  message: string;
  onRetry: () => void;
}

function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  const { t } = useTranslation();

  return (
    <View className="mx-4 mb-3 bg-amber-50 rounded-xl px-4 py-3">
      <Text
        className="text-amber-700 text-sm font-medium"
        allowFontScaling
      >
        {message}
      </Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel={t('common.retry')}
      >
        <Text
          className="text-brand-600 text-sm mt-1 font-semibold"
          allowFontScaling
        >
          {t('common.retry')}
        </Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// FAB
// ---------------------------------------------------------------------------

interface FABProps {
  onPress: () => void;
}

function FAB({ onPress }: FABProps) {
  const { t } = useTranslation();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.9, { damping: 15, stiffness: 200 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 180 });
  }, [scale]);

  return (
    <Animated.View
      style={[
        animatedStyle,
        {
          position: 'absolute',
          bottom: 24,
          right: 20,
          // Elevation for Android
          ...Platform.select({
            android: { elevation: 6 },
            ios: {
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 8,
            },
          }),
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={t('medications.addMedication')}
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: BRAND_600,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Plus size={26} color="#FFFFFF" strokeWidth={2.2} />
      </Pressable>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Search bar
// ---------------------------------------------------------------------------

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onClear: () => void;
}

function SearchBar({ value, onChangeText, onClear }: SearchBarProps) {
  const { t } = useTranslation();

  return (
    <View className="mx-4 mb-4 flex-row items-center bg-white rounded-2xl px-4 min-h-[44px] border border-neutral-200">
      <Search size={18} color="#94A3B8" strokeWidth={2} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={t('medications.searchPlaceholder')}
        placeholderTextColor="#94A3B8"
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="never"
        accessibilityLabel={t('medications.searchPlaceholder')}
        allowFontScaling
        className="flex-1 ml-2 text-neutral-900 text-base py-2.5"
      />
      {value.length > 0 && (
        <Pressable
          onPress={onClear}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <X size={16} color="#94A3B8" strokeWidth={2} />
        </Pressable>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function MedicationsScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const {
    medications,
    isLoading,
    error,
    interactionResults,
    loadMedications,
    searchMedications,
    clearError,
  } = useMedicationsStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Medication[] | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -------------------------------------------------------------------------
  // Load medications on screen focus
  // -------------------------------------------------------------------------

  useFocusEffect(
    useCallback(() => {
      void loadMedications();
    }, [loadMedications])
  );

  // -------------------------------------------------------------------------
  // Debounced search
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (searchDebounceRef.current !== null) {
      clearTimeout(searchDebounceRef.current);
    }

    const trimmed = searchQuery.trim();

    if (!trimmed) {
      setSearchResults(null);
      return;
    }

    searchDebounceRef.current = setTimeout(() => {
      void searchMedications(trimmed).then((results) => {
        setSearchResults(results);
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (searchDebounceRef.current !== null) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchQuery, searchMedications]);

  // -------------------------------------------------------------------------
  // Navigation handlers
  // -------------------------------------------------------------------------

  const handleAddPress = useCallback(() => {
    router.push('/(tabs)/medications/add');
  }, [router]);

  const handleCardPress = useCallback(
    (id: string) => {
      router.push(`/(tabs)/medications/${id}`);
    },
    [router]
  );

  // -------------------------------------------------------------------------
  // Pull-to-refresh
  // -------------------------------------------------------------------------

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadMedications();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadMedications]);

  const handleRetry = useCallback(() => {
    clearError();
    void loadMedications();
  }, [clearError, loadMedications]);

  // -------------------------------------------------------------------------
  // Search clear
  // -------------------------------------------------------------------------

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults(null);
  }, []);

  // -------------------------------------------------------------------------
  // Derived data
  // -------------------------------------------------------------------------

  /** Medications to render — search results override full list */
  const displayedMedications = searchResults !== null ? searchResults : medications;

  /** Active-only count for the subtitle */
  const activeCount = medications.filter((m) => m.isActive && !m.endedAt).length;

  const listItems: ListItem[] = buildListItems(displayedMedications);

  const isInitialLoad = isLoading && medications.length === 0;

  // -------------------------------------------------------------------------
  // FlashList render item
  // -------------------------------------------------------------------------

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.kind === 'header') {
        return <SectionHeader title={item.title} />;
      }

      const hasInteraction =
        interactionResults[item.medication.id]?.hasInteractions === true;

      return (
        <AnimatedMedRow
          medication={item.medication}
          hasInteraction={hasInteraction}
          index={item.index}
          onPress={handleCardPress}
        />
      );
    },
    [interactionResults, handleCardPress]
  );

  const keyExtractor = useCallback(
    (item: ListItem) =>
      item.kind === 'header' ? `header-${item.title}` : `med-${item.medication.id}`,
    []
  );

  const getItemType = useCallback(
    (item: ListItem) => (item.kind === 'header' ? 'header' : 'med'),
    []
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['top']}>
      {/* Screen header */}
      <View className="px-4 pt-2 pb-3">
        <Text
          className="text-neutral-800 text-2xl font-bold"
          allowFontScaling
          accessibilityRole="header"
        >
          {t('medications.title')}
        </Text>
        <Text
          className="text-neutral-400 text-sm mt-0.5"
          allowFontScaling
          accessibilityElementsHidden
        >
          {activeCount === 1
            ? '1 active medication'
            : `${activeCount} active medications`}
        </Text>
      </View>

      {/* Search bar */}
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        onClear={handleClearSearch}
      />

      {/* Error banner */}
      {error !== null && !isLoading && (
        <ErrorBanner message={error} onRetry={handleRetry} />
      )}

      {/* Initial loading state */}
      {isInitialLoad && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={BRAND_500} />
          <Text
            className="text-neutral-400 text-sm mt-3"
            allowFontScaling
            accessibilityLiveRegion="polite"
          >
            {t('common.loading')}
          </Text>
        </View>
      )}

      {/* Medication list */}
      {!isInitialLoad && (
        <FlashList
          data={listItems}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          getItemType={getItemType}
          estimatedItemSize={88}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={
            listItems.length === 0
              ? { flexGrow: 1 }
              : { paddingTop: 4, paddingBottom: 96 }
          }
          ListEmptyComponent={<EmptyState onAddPress={handleAddPress} />}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={BRAND_500}
              colors={[BRAND_500]}
            />
          }
          accessibilityLabel="Medications list"
        />
      )}

      {/* Floating action button */}
      <FAB onPress={handleAddPress} />
    </SafeAreaView>
  );
}
