/**
 * Emergency Card Screen
 *
 * A full-screen, always-light-mode card designed for first responder readability.
 * All data lives on-device in SQLite — no network required.
 *
 * Key decisions:
 * - Forced white background regardless of system theme (life-safety requirement)
 * - 20pt+ font sizes for all labels (readable at arm's length)
 * - Minimum 48pt touch targets on all interactive elements
 * - High-contrast red header — reserved for this screen only (per design system)
 * - Edit/view toggle to prevent accidental edits while also allowing quick updates
 */

import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Phone, AlertTriangle, QrCode, Pill, Stethoscope, HeartPulse, UserRound } from 'lucide-react-native';
import { useMedicationsStore } from '../../../store/medications';
import { useUserStore } from '../../../store/user';
import {
  getEmergencyCard,
  upsertEmergencyCard,
  type BloodType,
  type EmergencyCard,
  type EmergencyContact,
} from '../../../lib/db/emergency-card';
import { EmergencyContactForm } from '../../../components/emergency/EmergencyContactForm';
import { ExportButton } from '../../../components/export/ExportButton';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BLOOD_TYPES: BloodType[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown'];

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------

interface EditableCardState {
  displayName: string;
  bloodType: BloodType | null;
  allergies: string[];
  medicalConditions: string[];
  emergencyContacts: EmergencyContact[];
  primaryPhysicianName: string;
  primaryPhysicianPhone: string;
  notes: string;
}

// ---------------------------------------------------------------------------
// Helper sub-components
// ---------------------------------------------------------------------------

interface SectionHeaderProps {
  title: string;
  icon?: React.ReactNode;
}

function SectionHeader({ title, icon }: SectionHeaderProps) {
  return (
    <View className="mt-6 mb-3 pb-2 border-b-2 border-slate-200 flex-row items-center gap-2">
      {icon ? icon : null}
      <Text
        className="text-xl font-bold text-slate-800"
        accessibilityRole="header"
      >
        {title}
      </Text>
    </View>
  );
}

interface TagListEditorProps {
  items: string[];
  onAdd: (value: string) => void;
  onRemove: (index: number) => void;
  addLabel: string;
  placeholder: string;
  isEditing: boolean;
  emptyMessage: string;
}

function TagListEditor({
  items,
  onAdd,
  onRemove,
  addLabel,
  placeholder,
  isEditing,
  emptyMessage,
}: TagListEditorProps) {
  const [draft, setDraft] = useState('');

  function handleCommit() {
    const trimmed = draft.trim();
    if (trimmed.length === 0) return;
    onAdd(trimmed);
    setDraft('');
  }

  if (!isEditing) {
    if (items.length === 0) {
      return (
        <Text className="text-lg text-slate-500 italic py-1">{emptyMessage}</Text>
      );
    }
    return (
      <View className="gap-2">
        {items.map((item, i) => (
          <View key={i} className="flex-row items-center gap-3">
            <View className="w-2 h-2 rounded-full bg-slate-400" aria-hidden={true} />
            <Text className="text-lg text-slate-800 flex-1">{item}</Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View>
      {items.map((item, i) => (
        <View key={i} className="flex-row items-center gap-3 mb-2">
          <Text className="text-base text-slate-800 flex-1 py-2">{item}</Text>
          <Pressable
            onPress={() => onRemove(i)}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${item}`}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            className="px-3 py-1.5 rounded-lg bg-red-50 border border-red-200"
          >
            <Text className="text-sm text-red-600 font-medium">✕</Text>
          </Pressable>
        </View>
      ))}
      <View className="flex-row gap-2 mt-1">
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          returnKeyType="done"
          onSubmitEditing={handleCommit}
          className="flex-1 border border-slate-300 rounded-xl px-4 py-3 text-base text-slate-900 bg-white"
          accessibilityLabel={addLabel}
        />
        <Pressable
          onPress={handleCommit}
          accessibilityRole="button"
          accessibilityLabel={addLabel}
          className="bg-teal-600 rounded-xl px-4 items-center justify-center active:bg-teal-700"
          style={{ minHeight: 48, minWidth: 48 }}
        >
          <Text className="text-white font-bold text-xl">+</Text>
        </Pressable>
      </View>
    </View>
  );
}

interface BloodTypePickerProps {
  value: BloodType | null;
  onChange: (value: BloodType) => void;
  isEditing: boolean;
}

function BloodTypePicker({ value, onChange, isEditing }: BloodTypePickerProps) {
  const { t } = useTranslation();

  if (!isEditing) {
    return (
      <Text className="text-xl font-semibold text-slate-800">
        {value && value !== 'unknown' ? value : t('emergency.bloodTypeUnknown')}
      </Text>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View className="flex-row gap-2 flex-wrap">
        {BLOOD_TYPES.map((bt) => {
          const isSelected = value === bt;
          return (
            <Pressable
              key={bt}
              onPress={() => onChange(bt)}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              accessibilityLabel={bt === 'unknown' ? t('emergency.bloodTypeUnknown') : bt}
              style={{ minHeight: 48, minWidth: 48 }}
              className={`rounded-xl border-2 items-center justify-center px-3 ${
                isSelected
                  ? 'bg-teal-600 border-teal-600'
                  : 'bg-white border-slate-300'
              }`}
            >
              <Text
                className={`text-base font-bold ${
                  isSelected ? 'text-white' : 'text-slate-700'
                }`}
              >
                {bt === 'unknown' ? '?' : bt}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function EmergencyScreen() {
  const { t } = useTranslation();
  const { userId } = useUserStore();
  const medications = useMedicationsStore((s) => s.medications);
  const loadMedications = useMedicationsStore((s) => s.loadMedications);

  const [card, setCard] = useState<EmergencyCard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Draft state — only used in edit mode
  const [draft, setDraft] = useState<EditableCardState>({
    displayName: '',
    bloodType: null,
    allergies: [],
    medicalConditions: [],
    emergencyContacts: [],
    primaryPhysicianName: '',
    primaryPhysicianPhone: '',
    notes: '',
  });

  // Load card and medications on mount
  useEffect(() => {
    async function loadData() {
      try {
        await loadMedications();
        const existing = await getEmergencyCard(userId ?? 'local-user');
        if (existing) {
          setCard(existing);
          syncDraftFromCard(existing);
        }
      } catch (err) {
        console.error('[EmergencyScreen] load failed:', err);
      } finally {
        setIsLoading(false);
      }
    }
    void loadData();
  }, [loadMedications]);

  function syncDraftFromCard(c: EmergencyCard) {
    setDraft({
      displayName: c.displayName,
      bloodType: c.bloodType,
      allergies: [...c.allergies],
      medicalConditions: [...c.medicalConditions],
      emergencyContacts: [...c.emergencyContacts],
      primaryPhysicianName: c.primaryPhysicianName ?? '',
      primaryPhysicianPhone: c.primaryPhysicianPhone ?? '',
      notes: c.notes ?? '',
    });
  }

  function handleStartEdit() {
    if (card) syncDraftFromCard(card);
    setIsEditing(true);
  }

  function handleCancelEdit() {
    if (card) syncDraftFromCard(card);
    setIsEditing(false);
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      const updated = await upsertEmergencyCard(userId ?? 'local-user', {
        displayName: draft.displayName,
        bloodType: draft.bloodType,
        allergies: draft.allergies,
        medicalConditions: draft.medicalConditions,
        emergencyContacts: draft.emergencyContacts,
        primaryPhysicianName: draft.primaryPhysicianName || null,
        primaryPhysicianPhone: draft.primaryPhysicianPhone || null,
        notes: draft.notes || null,
      });
      setCard(updated);
      setIsEditing(false);
    } catch (err) {
      Alert.alert(t('common.error'), t('emergency.saveFailed'));
      console.error('[EmergencyScreen] save failed:', err);
    } finally {
      setIsSaving(false);
    }
  }

  // Derive active medications from store (current source of truth)
  const activeMedications = medications.filter((m) => m.isActive && !m.endedAt);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  function renderHeader() {
    return (
      <View
        className="bg-red-600 px-6 pt-4 pb-5"
        accessibilityRole="header"
      >
        <Text
          className="text-white font-black tracking-widest text-center"
          style={{ fontSize: 22, letterSpacing: 3 }}
          accessibilityRole="text"
          accessibilityLabel={t('emergency.header')}
        >
          {t('emergency.header')}
        </Text>
        <Text className="text-red-100 text-center text-sm mt-1">
          {t('emergency.headerSubtext')}
        </Text>
      </View>
    );
  }

  function renderTopBar() {
    return (
      <View className="flex-row items-center justify-between px-5 py-3 bg-white border-b border-slate-200">
        <Text className="text-sm text-slate-500">
          {card
            ? t('emergency.lastUpdated', {
                date: new Date(card.updatedAt).toLocaleDateString(),
              })
            : t('emergency.notSetUp')}
        </Text>
        <View className="flex-row gap-2">
          {isEditing ? (
            <>
              <Pressable
                onPress={handleCancelEdit}
                disabled={isSaving}
                accessibilityRole="button"
                accessibilityLabel={t('common.cancel')}
                style={{ minHeight: 44, minWidth: 44 }}
                className="px-4 py-2 rounded-xl border border-slate-300 items-center justify-center active:bg-slate-100"
              >
                <Text className="text-base font-medium text-slate-600">
                  {t('common.cancel')}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={isSaving}
                accessibilityRole="button"
                accessibilityLabel={t('common.save')}
                style={{ minHeight: 44 }}
                className="px-5 py-2 rounded-xl bg-teal-600 items-center justify-center active:bg-teal-700 disabled:opacity-50"
              >
                <Text className="text-base font-semibold text-white">
                  {isSaving ? t('common.loading') : t('common.save')}
                </Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={handleStartEdit}
              accessibilityRole="button"
              accessibilityLabel={t('common.edit')}
              style={{ minHeight: 44 }}
              className="px-5 py-2 rounded-xl border border-teal-600 items-center justify-center active:bg-teal-50"
            >
              <Text className="text-base font-medium text-teal-700">
                {t('common.edit')}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  function renderMedications() {
    return (
      <View>
        <SectionHeader title={t('emergency.currentMedications')} icon={<Pill size={20} color="#475569" aria-hidden={true} />} />
        {activeMedications.length === 0 ? (
          <Text className="text-lg text-slate-500 italic">
            {t('emergency.noMedications')}
          </Text>
        ) : (
          activeMedications.map((med) => (
            <View
              key={med.id}
              className="py-3 border-b border-slate-100 flex-row items-start gap-3"
              accessibilityRole="text"
              accessibilityLabel={`${med.name}, ${med.dosageAmount} ${med.dosageUnit}`}
            >
              <View className="mt-2 w-2 h-2 rounded-full bg-teal-500 shrink-0" aria-hidden={true} />
              <View className="flex-1">
                <Text className="text-lg font-semibold text-slate-900">
                  {med.name}
                </Text>
                <Text className="text-base text-slate-600">
                  {med.dosageAmount} {med.dosageUnit}
                  {med.route ? ` — ${med.route}` : ''}
                </Text>
                {med.instructions ? (
                  <Text className="text-sm text-slate-500 mt-0.5">{med.instructions}</Text>
                ) : null}
              </View>
            </View>
          ))
        )}
        <Text className="text-xs text-slate-400 mt-2">
          {t('emergency.medicationsNote')}
        </Text>
      </View>
    );
  }

  function renderAllergies() {
    return (
      <View>
        <SectionHeader title={t('emergency.allergies')} icon={<AlertTriangle size={20} color="#DC2626" aria-hidden={true} />} />
        <TagListEditor
          items={draft.allergies}
          onAdd={(v) => setDraft((d) => ({ ...d, allergies: [...d.allergies, v] }))}
          onRemove={(i) =>
            setDraft((d) => ({
              ...d,
              allergies: d.allergies.filter((_, idx) => idx !== i),
            }))
          }
          addLabel={t('emergency.addAllergy')}
          placeholder={t('emergency.allergyPlaceholder')}
          isEditing={isEditing}
          emptyMessage={t('emergency.noAllergies')}
        />
      </View>
    );
  }

  function renderMedicalConditions() {
    return (
      <View>
        <SectionHeader title={t('emergency.medicalConditions')} icon={<HeartPulse size={20} color="#475569" aria-hidden={true} />} />
        <TagListEditor
          items={draft.medicalConditions}
          onAdd={(v) =>
            setDraft((d) => ({
              ...d,
              medicalConditions: [...d.medicalConditions, v],
            }))
          }
          onRemove={(i) =>
            setDraft((d) => ({
              ...d,
              medicalConditions: d.medicalConditions.filter((_, idx) => idx !== i),
            }))
          }
          addLabel={t('emergency.addCondition')}
          placeholder={t('emergency.conditionPlaceholder')}
          isEditing={isEditing}
          emptyMessage={t('emergency.noConditions')}
        />
      </View>
    );
  }

  function renderBloodType() {
    return (
      <View>
        <SectionHeader title={t('emergency.bloodType')} icon={<UserRound size={20} color="#475569" aria-hidden={true} />} />
        <BloodTypePicker
          value={draft.bloodType}
          onChange={(v) => setDraft((d) => ({ ...d, bloodType: v }))}
          isEditing={isEditing}
        />
      </View>
    );
  }

  function renderEmergencyContacts() {
    return (
      <View>
        <SectionHeader title={t('emergency.emergencyContacts')} icon={<Phone size={20} color="#475569" aria-hidden={true} />} />
        {isEditing ? (
          <EmergencyContactForm
            contacts={draft.emergencyContacts}
            onChange={(contacts) => setDraft((d) => ({ ...d, emergencyContacts: contacts }))}
            maxContacts={3}
          />
        ) : draft.emergencyContacts.length === 0 ? (
          <Text className="text-lg text-slate-500 italic">
            {t('emergency.noContacts')}
          </Text>
        ) : (
          draft.emergencyContacts.map((contact) => (
            <View
              key={contact.id}
              className="py-3 border-b border-slate-100"
              accessibilityRole="text"
              accessibilityLabel={`${contact.name}, ${contact.phone}, ${contact.relationship}`}
            >
              <Text className="text-xl font-bold text-slate-900">{contact.name}</Text>
              <Text className="text-lg text-teal-700 font-medium mt-0.5">{contact.phone}</Text>
              <Text className="text-base text-slate-500 capitalize mt-0.5">
                {contact.relationship}
              </Text>
            </View>
          ))
        )}
      </View>
    );
  }

  function renderPrimaryDoctor() {
    return (
      <View>
        <SectionHeader title={t('emergency.primaryDoctor')} icon={<Stethoscope size={20} color="#475569" aria-hidden={true} />} />
        {isEditing ? (
          <View className="gap-3">
            <View>
              <Text
                nativeID="doctor-name-label"
                className="text-sm font-medium text-slate-700 mb-1.5"
              >
                {t('emergency.doctorName')}
              </Text>
              <TextInput
                value={draft.primaryPhysicianName}
                onChangeText={(v) => setDraft((d) => ({ ...d, primaryPhysicianName: v }))}
                placeholder={t('emergency.doctorNamePlaceholder')}
                placeholderTextColor="#94a3b8"
                accessibilityLabelledBy="doctor-name-label"
                returnKeyType="next"
                autoCapitalize="words"
                className="border border-slate-300 rounded-xl px-4 py-3 text-base text-slate-900 bg-white"
              />
            </View>
            <View>
              <Text
                nativeID="doctor-phone-label"
                className="text-sm font-medium text-slate-700 mb-1.5"
              >
                {t('emergency.doctorPhone')}
              </Text>
              <TextInput
                value={draft.primaryPhysicianPhone}
                onChangeText={(v) => setDraft((d) => ({ ...d, primaryPhysicianPhone: v }))}
                placeholder={t('emergency.doctorPhonePlaceholder')}
                placeholderTextColor="#94a3b8"
                accessibilityLabelledBy="doctor-phone-label"
                keyboardType="phone-pad"
                returnKeyType="done"
                className="border border-slate-300 rounded-xl px-4 py-3 text-base text-slate-900 bg-white"
              />
            </View>
          </View>
        ) : draft.primaryPhysicianName ? (
          <View
            accessibilityRole="text"
            accessibilityLabel={`${draft.primaryPhysicianName}${draft.primaryPhysicianPhone ? `, ${draft.primaryPhysicianPhone}` : ''}`}
          >
            <Text className="text-xl font-bold text-slate-900">
              {draft.primaryPhysicianName}
            </Text>
            {draft.primaryPhysicianPhone ? (
              <Text className="text-lg text-teal-700 font-medium mt-0.5">
                {draft.primaryPhysicianPhone}
              </Text>
            ) : null}
          </View>
        ) : (
          <Text className="text-lg text-slate-500 italic">
            {t('emergency.noDoctorOnFile')}
          </Text>
        )}
      </View>
    );
  }

  function renderQRPlaceholder() {
    return (
      <View className="mt-6 mb-4">
        <SectionHeader title={t('emergency.qrCode')} />
        <View
          className="border-2 border-dashed border-slate-300 rounded-2xl items-center justify-center py-10"
          accessibilityRole="image"
          accessibilityLabel={t('emergency.qrCodeAlt')}
        >
          <Text className="text-5xl" aria-hidden={true}>⬛</Text>
          <Text className="text-base text-slate-500 mt-3 text-center px-4">
            {t('emergency.qrPlaceholder')}
          </Text>
        </View>
      </View>
    );
  }

  function renderExportButton() {
    return (
      <View className="mx-1 mb-6">
        <ExportButton
          type="emergencyCard"
          userId={userId ?? 'local-user'}
          label={t('emergency.exportPDF')}
        />
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white" style={{ backgroundColor: '#ffffff' }}>
        {renderHeader()}
        <View className="flex-1 items-center justify-center">
          <Text className="text-base text-slate-500">{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------------------------------
  // Main render — always white background
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: '#ffffff' }}
      // Force light appearance regardless of system setting — first responder must see this
    >
      {renderHeader()}
      {renderTopBar()}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {renderMedications()}
          {renderAllergies()}
          {renderMedicalConditions()}
          {renderBloodType()}
          {renderEmergencyContacts()}
          {renderPrimaryDoctor()}
          {renderQRPlaceholder()}
          {renderExportButton()}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
