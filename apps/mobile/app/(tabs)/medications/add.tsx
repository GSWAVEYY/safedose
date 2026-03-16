/**
 * Add Medication screen.
 *
 * Form fields:
 *   - Drug name via DrugSearchInput (auto-fills rxcui on DB selection)
 *   - Dosage amount (numeric TextInput)
 *   - Dosage unit (DosageUnit segmented selector)
 *   - Route (DosageRoute segmented selector, scrollable row)
 *   - Instructions (multiline TextInput)
 *   - Prescriber name
 *   - Pharmacy name
 *   - Scan Bottle — Coming Soon (disabled placeholder button)
 *
 * On save:
 *   1. Validate required field (name).
 *   2. Call store.saveMedication().
 *   3. Run interaction check via useInteractionCheck if rxcui is known.
 *   4. For each interaction found: show InteractionAlert (sequentially).
 *   5. Navigate back after all alerts are dismissed.
 *
 * States: idle, saving, checking interactions, done.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useMedicationsStore } from '@/store/medications';
import { useInteractionCheck } from '@/lib/interactions';
import type { DrugInteraction } from '@/lib/interactions/types';
import type { DrugSearchResult } from '@/lib/interactions/types';
import type { DosageUnit, DosageRoute, MedicationCreate } from '@safedose/shared-types';

import { Button } from '@/components/ui/Button';
import { DrugSearchInput } from '@/components/medications/DrugSearchInput';
import { InteractionAlert } from '@/components/medications/InteractionAlert';

// ---------------------------------------------------------------------------
// Dosage unit options (the spec's "dosage form" picker maps to DosageUnit)
// ---------------------------------------------------------------------------

const DOSAGE_UNITS: DosageUnit[] = [
  'tablet',
  'capsule',
  'mg',
  'mcg',
  'ml',
  'patch',
  'puff',
  'drop',
  'unit',
];

// The spec asks for a "dosage form" picker: tablet, capsule, liquid, patch,
// injection, inhaler, drops, cream.  These map to DosageUnit + DosageRoute
// combinations. We surface them as DosageUnit here since that's what the
// Medication type tracks.
const DOSAGE_FORM_DISPLAY: Record<DosageUnit, string> = {
  tablet: 'Tablet',
  capsule: 'Capsule',
  mg: 'mg',
  mcg: 'mcg',
  g: 'g',
  ml: 'Liquid (mL)',
  patch: 'Patch',
  puff: 'Inhaler',
  drop: 'Drops',
  unit: 'Other',
};

// ---------------------------------------------------------------------------
// Route options
// ---------------------------------------------------------------------------

const DOSAGE_ROUTES: DosageRoute[] = [
  'oral',
  'inhaled',
  'topical',
  'injection',
  'transdermal',
  'nasal',
  'ophthalmic',
  'otic',
  'sublingual',
  'rectal',
];

// ---------------------------------------------------------------------------
// Form state type
// ---------------------------------------------------------------------------

interface FormState {
  name: string;
  rxcui: string;
  dosageAmount: string;
  dosageUnit: DosageUnit;
  route: DosageRoute;
  instructions: string;
  prescriber: string;
  pharmacy: string;
}

const INITIAL_FORM: FormState = {
  name: '',
  rxcui: '',
  dosageAmount: '',
  dosageUnit: 'tablet',
  route: 'oral',
  instructions: '',
  prescriber: '',
  pharmacy: '',
};

// ---------------------------------------------------------------------------
// Small reusable field label
// ---------------------------------------------------------------------------

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <Text className="text-neutral-600 text-sm font-semibold mb-1.5">
      {label}
      {required ? <Text className="text-red-500"> *</Text> : null}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function AddMedicationScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { saveMedication, medications, setInteractionResult } = useMedicationsStore();
  const { checkNewMed, isChecking } = useInteractionCheck();

  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [nameError, setNameError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);

  // Interaction alert queue
  const [interactionQueue, setInteractionQueue] = useState<DrugInteraction[]>([]);
  const [currentInteractionIndex, setCurrentInteractionIndex] = useState(0);

  // ---------------------------------------------------------------------------
  // Field handlers
  // ---------------------------------------------------------------------------

  const handleDrugSelect = useCallback((result: DrugSearchResult) => {
    setForm((prev) => ({ ...prev, name: result.name, rxcui: result.rxcui }));
    setNameError(null);
  }, []);

  const handleNameChange = useCallback((text: string) => {
    setForm((prev) => ({ ...prev, name: text, rxcui: '' }));
    if (text.trim()) setNameError(null);
  }, []);

  const setField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Interaction alert dismissal
  // ---------------------------------------------------------------------------

  const handleDismissInteraction = useCallback(() => {
    setCurrentInteractionIndex((prev) => {
      const next = prev + 1;
      if (next >= interactionQueue.length) {
        // All alerts shown — navigate back
        router.back();
      }
      return next;
    });
  }, [interactionQueue.length, router]);

  // ---------------------------------------------------------------------------
  // Save handler
  // ---------------------------------------------------------------------------

  const handleSave = useCallback(async () => {
    const name = form.name.trim();
    if (!name) {
      setNameError(t('medications.fieldRequired'));
      return;
    }

    const amount = parseFloat(form.dosageAmount);

    const payload: MedicationCreate = {
      name,
      rxcui: form.rxcui || undefined,
      dosageAmount: Number.isFinite(amount) && amount > 0 ? amount : 1,
      dosageUnit: form.dosageUnit,
      route: form.route,
      instructions: form.instructions.trim() || undefined,
      prescriber: form.prescriber.trim() || undefined,
      pharmacy: form.pharmacy.trim() || undefined,
    };

    setIsSaving(true);
    setStatusText(t('medications.savingMedication'));

    try {
      const saved = await saveMedication(payload);

      // Run interaction check if we have an rxcui
      if (saved.rxcui) {
        setStatusText(t('medications.checkingInteractions'));

        const existingRxcuis = medications
          .filter((m) => m.id !== saved.id && m.rxcui && m.isActive && !m.endedAt)
          .map((m) => m.rxcui as string);

        if (existingRxcuis.length > 0) {
          const result = await checkNewMed(saved.rxcui, existingRxcuis);
          setInteractionResult(saved.id, result);

          if (result.hasInteractions && result.interactions.length > 0) {
            setInteractionQueue(result.interactions);
            setCurrentInteractionIndex(0);
            setIsSaving(false);
            setStatusText(null);
            // Navigation happens after all alerts are dismissed
            return;
          }
        }
      }

      // No interactions or no rxcui — go back
      router.back();
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.error');
      Alert.alert(t('common.error'), message);
    } finally {
      setIsSaving(false);
      setStatusText(null);
    }
  }, [
    form,
    t,
    saveMedication,
    medications,
    checkNewMed,
    setInteractionResult,
    router,
  ]);

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const isProcessing = isSaving || isChecking;

  const currentInteraction =
    interactionQueue.length > 0 && currentInteractionIndex < interactionQueue.length
      ? interactionQueue[currentInteractionIndex]
      : null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 py-5 gap-y-5"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Drug name search */}
        <View>
          <FieldLabel label={t('medications.drugName')} required />
          <DrugSearchInput
            value={form.name}
            onChangeText={handleNameChange}
            onSelect={handleDrugSelect}
            error={nameError ?? undefined}
          />
        </View>

        {/* Dosage amount */}
        <View>
          <FieldLabel label={t('medications.dosageAmount')} />
          <View className="bg-white rounded-xl border border-neutral-200 px-4 py-3">
            <TextInput
              value={form.dosageAmount}
              onChangeText={(text) => setField('dosageAmount', text)}
              placeholder={t('medications.strengthPlaceholder')}
              placeholderTextColor="#94A3B8"
              keyboardType="decimal-pad"
              returnKeyType="done"
              accessibilityLabel={t('medications.strength')}
              className="text-neutral-900 text-base"
              allowFontScaling
            />
          </View>
        </View>

        {/* Dosage unit (form) */}
        <View>
          <FieldLabel label={t('medications.dosageForm')} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-x-2 py-1"
          >
            {DOSAGE_UNITS.map((unit) => {
              const selected = form.dosageUnit === unit;
              return (
                <Pressable
                  key={unit}
                  onPress={() => setField('dosageUnit', unit)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={DOSAGE_FORM_DISPLAY[unit]}
                  className={`px-4 py-2 rounded-xl border min-h-[44px] items-center justify-center ${
                    selected
                      ? 'bg-brand-500 border-brand-500'
                      : 'bg-white border-neutral-200'
                  }`}
                >
                  <Text
                    className={`text-sm font-medium ${selected ? 'text-white' : 'text-neutral-700'}`}
                    allowFontScaling={false}
                  >
                    {DOSAGE_FORM_DISPLAY[unit]}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Route */}
        <View>
          <FieldLabel label={t('medications.route')} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-x-2 py-1"
          >
            {DOSAGE_ROUTES.map((route) => {
              const selected = form.route === route;
              return (
                <Pressable
                  key={route}
                  onPress={() => setField('route', route)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={t(`dosageRoutes.${route}`)}
                  className={`px-4 py-2 rounded-xl border min-h-[44px] items-center justify-center ${
                    selected
                      ? 'bg-brand-500 border-brand-500'
                      : 'bg-white border-neutral-200'
                  }`}
                >
                  <Text
                    className={`text-sm font-medium ${selected ? 'text-white' : 'text-neutral-700'}`}
                    allowFontScaling={false}
                    numberOfLines={1}
                  >
                    {t(`dosageRoutes.${route}`)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Instructions */}
        <View>
          <FieldLabel label={t('medications.instructions')} />
          <View className="bg-white rounded-xl border border-neutral-200 px-4 py-3">
            <TextInput
              value={form.instructions}
              onChangeText={(text) => setField('instructions', text)}
              placeholder={t('medications.instructionsPlaceholder')}
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              accessibilityLabel={t('medications.instructions')}
              className="text-neutral-900 text-base min-h-[72px]"
              allowFontScaling
            />
          </View>
        </View>

        {/* Prescriber */}
        <View>
          <FieldLabel label={t('medications.prescriber')} />
          <View className="bg-white rounded-xl border border-neutral-200 px-4 py-3">
            <TextInput
              value={form.prescriber}
              onChangeText={(text) => setField('prescriber', text)}
              placeholder={t('medications.prescriberPlaceholder')}
              placeholderTextColor="#94A3B8"
              autoCapitalize="words"
              returnKeyType="next"
              accessibilityLabel={t('medications.prescriber')}
              className="text-neutral-900 text-base"
              allowFontScaling
            />
          </View>
        </View>

        {/* Pharmacy */}
        <View>
          <FieldLabel label={t('medications.pharmacy')} />
          <View className="bg-white rounded-xl border border-neutral-200 px-4 py-3">
            <TextInput
              value={form.pharmacy}
              onChangeText={(text) => setField('pharmacy', text)}
              placeholder={t('medications.pharmacyPlaceholder')}
              placeholderTextColor="#94A3B8"
              autoCapitalize="words"
              returnKeyType="done"
              accessibilityLabel={t('medications.pharmacy')}
              className="text-neutral-900 text-base"
              allowFontScaling
            />
          </View>
        </View>

        {/* Scan Bottle (placeholder) */}
        <Pressable
          disabled
          accessibilityRole="button"
          accessibilityLabel={t('medications.scanBottleComingSoon')}
          accessibilityState={{ disabled: true }}
          className="bg-white border-2 border-dashed border-neutral-200 rounded-2xl py-5 items-center gap-y-1 opacity-50"
        >
          <Text className="text-neutral-500 text-base font-medium">
            {t('medications.scanBottleComingSoon')}
          </Text>
          <Text className="text-neutral-400 text-xs">
            OCR label parsing — coming in Sprint 2
          </Text>
        </Pressable>

        {/* Status message while saving/checking */}
        {statusText ? (
          <View className="flex-row items-center gap-x-2 justify-center py-2">
            <ActivityIndicator size="small" color="#14B8A6" />
            <Text className="text-neutral-500 text-sm">{statusText}</Text>
          </View>
        ) : null}

        {/* Action buttons */}
        <View className="gap-y-3 mt-2">
          <Button
            label={isProcessing ? t('medications.savingMedication') : t('common.save')}
            variant="primary"
            onPress={handleSave}
            disabled={isProcessing}
            accessibilityLabel={t('common.save')}
          />
          <Button
            label={t('common.cancel')}
            variant="secondary"
            onPress={() => router.back()}
            disabled={isProcessing}
            accessibilityLabel={t('common.cancel')}
          />
        </View>

        {/* Bottom safe area padding */}
        <View className="h-6" />
      </ScrollView>

      {/* Interaction alert modal (sequentially walks the queue) */}
      {currentInteraction ? (
        <InteractionAlert
          interaction={currentInteraction}
          visible
          onDismiss={handleDismissInteraction}
        />
      ) : null}
    </SafeAreaView>
  );
}
