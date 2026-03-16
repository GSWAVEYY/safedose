/**
 * EmergencyContactForm
 *
 * Reusable controlled component for managing a list of up to 3 emergency
 * contacts. Each contact has a name, phone number, and relationship.
 *
 * Props are fully controlled — parent owns state via onChange.
 */

import React from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { EmergencyContact } from '../../lib/db/emergency-card';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmergencyContactFormProps {
  contacts: EmergencyContact[];
  onChange: (contacts: EmergencyContact[]) => void;
  /** Maximum number of contacts allowed. Defaults to 3. */
  maxContacts?: number;
}

type RelationshipOption = {
  value: string;
  labelKey: string;
};

const RELATIONSHIP_OPTIONS: RelationshipOption[] = [
  { value: 'spouse', labelKey: 'emergency.relationshipSpouse' },
  { value: 'parent', labelKey: 'emergency.relationshipParent' },
  { value: 'child', labelKey: 'emergency.relationshipChild' },
  { value: 'sibling', labelKey: 'emergency.relationshipSibling' },
  { value: 'friend', labelKey: 'emergency.relationshipFriend' },
  { value: 'doctor', labelKey: 'emergency.relationshipDoctor' },
  { value: 'other', labelKey: 'emergency.relationshipOther' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateContactId(): string {
  return `contact-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface RelationshipPickerProps {
  value: string;
  onChange: (value: string) => void;
  contactIndex: number;
}

function RelationshipPicker({ value, onChange }: RelationshipPickerProps) {
  const { t } = useTranslation();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="mt-2"
      accessibilityRole="none"
      accessibilityLabel={t('emergency.relationshipLabel')}
    >
      <View className="flex-row gap-2">
        {RELATIONSHIP_OPTIONS.map((option) => {
          const isSelected = value === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              accessibilityLabel={t(option.labelKey)}
              className={`rounded-full px-4 py-2 border ${
                isSelected
                  ? 'bg-teal-600 border-teal-600'
                  : 'bg-white border-slate-300'
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  isSelected ? 'text-white' : 'text-slate-600'
                }`}
              >
                {t(option.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function EmergencyContactForm({
  contacts,
  onChange,
  maxContacts = 3,
}: EmergencyContactFormProps) {
  const { t } = useTranslation();

  function handleAdd() {
    if (contacts.length >= maxContacts) return;
    const newContact: EmergencyContact = {
      id: generateContactId(),
      name: '',
      phone: '',
      relationship: 'other',
    };
    onChange([...contacts, newContact]);
  }

  function handleRemove(id: string) {
    onChange(contacts.filter((c) => c.id !== id));
  }

  function handleUpdate(id: string, field: keyof Omit<EmergencyContact, 'id'>, value: string) {
    onChange(
      contacts.map((c) =>
        c.id === id ? { ...c, [field]: value } : c
      )
    );
  }

  return (
    <View accessibilityRole="none">
      {contacts.map((contact, index) => (
        <View
          key={contact.id}
          className="mb-4 p-4 rounded-2xl bg-slate-50 border border-slate-200"
          accessibilityLabel={t('emergency.contactNumber', { number: index + 1 })}
        >
          {/* Contact header row */}
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-base font-semibold text-slate-800">
              {t('emergency.contactNumber', { number: index + 1 })}
            </Text>
            <Pressable
              onPress={() => handleRemove(contact.id)}
              accessibilityRole="button"
              accessibilityLabel={t('emergency.removeContact', { number: index + 1 })}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              className="px-3 py-1.5 rounded-lg bg-red-50 border border-red-200"
            >
              <Text className="text-sm font-medium text-red-600">
                {t('common.delete')}
              </Text>
            </Pressable>
          </View>

          {/* Name field */}
          <Text
            nativeID={`contact-name-label-${contact.id}`}
            className="text-sm font-medium text-slate-700 mb-1.5"
          >
            {t('emergency.contactName')}
          </Text>
          <TextInput
            value={contact.name}
            onChangeText={(v) => handleUpdate(contact.id, 'name', v)}
            placeholder={t('emergency.contactNamePlaceholder')}
            placeholderTextColor="#94a3b8"
            accessibilityLabelledBy={`contact-name-label-${contact.id}`}
            accessibilityLabel={t('emergency.contactName')}
            returnKeyType="next"
            autoCapitalize="words"
            className="border border-slate-300 rounded-xl px-4 py-3 text-base text-slate-900 bg-white mb-3"
          />

          {/* Phone field */}
          <Text
            nativeID={`contact-phone-label-${contact.id}`}
            className="text-sm font-medium text-slate-700 mb-1.5"
          >
            {t('emergency.contactPhone')}
          </Text>
          <TextInput
            value={contact.phone}
            onChangeText={(v) => handleUpdate(contact.id, 'phone', v)}
            placeholder={t('emergency.contactPhonePlaceholder')}
            placeholderTextColor="#94a3b8"
            accessibilityLabelledBy={`contact-phone-label-${contact.id}`}
            accessibilityLabel={t('emergency.contactPhone')}
            keyboardType="phone-pad"
            returnKeyType="done"
            className="border border-slate-300 rounded-xl px-4 py-3 text-base text-slate-900 bg-white mb-3"
          />

          {/* Relationship picker */}
          <Text className="text-sm font-medium text-slate-700 mb-1">
            {t('emergency.relationshipLabel')}
          </Text>
          <RelationshipPicker
            value={contact.relationship}
            onChange={(v) => handleUpdate(contact.id, 'relationship', v)}
            contactIndex={index}
          />
        </View>
      ))}

      {/* Add contact button */}
      {contacts.length < maxContacts && (
        <Pressable
          onPress={handleAdd}
          accessibilityRole="button"
          accessibilityLabel={t('emergency.addContact')}
          className="flex-row items-center justify-center gap-2 border-2 border-dashed border-teal-400 rounded-2xl py-4 active:bg-teal-50"
        >
          <Text className="text-2xl text-teal-600" aria-hidden={true}>+</Text>
          <Text className="text-base font-medium text-teal-600">
            {t('emergency.addContact')}
          </Text>
        </Pressable>
      )}

      {contacts.length >= maxContacts && (
        <Text className="text-sm text-slate-500 text-center mt-2">
          {t('emergency.maxContactsReached', { max: maxContacts })}
        </Text>
      )}
    </View>
  );
}
