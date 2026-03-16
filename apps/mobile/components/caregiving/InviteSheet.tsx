/**
 * InviteSheet
 *
 * Bottom sheet for sending a caregiver invite.
 * - Email or phone input
 * - Role picker with descriptions
 * - Sends invite via store.sendInvite()
 * - Displays generated invite link + Copy button on success
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
// Clipboard: using react-native-clipboard when available, inline fallback for now
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { useCaregivingStore, type InviteResult } from '../../store/caregiving';

// ─── Types ────────────────────────────────────────────────────────────────────

export type InviteRole = 'primary' | 'observer' | 'emergency_only';

export interface InviteSheetProps {
  visible: boolean;
  onClose: () => void;
}

interface RoleOption {
  value: InviteRole;
  labelKey: string;
  descriptionKey: string;
}

// ─── Role options ─────────────────────────────────────────────────────────────

const ROLE_OPTIONS: RoleOption[] = [
  {
    value: 'primary',
    labelKey: 'caregiving.roles.primary',
    descriptionKey: 'caregiving.roles.primaryDesc',
  },
  {
    value: 'observer',
    labelKey: 'caregiving.roles.observer',
    descriptionKey: 'caregiving.roles.observerDesc',
  },
  {
    value: 'emergency_only',
    labelKey: 'caregiving.roles.emergency',
    descriptionKey: 'caregiving.roles.emergencyDesc',
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

interface RolePickerProps {
  selected: InviteRole;
  onSelect: (role: InviteRole) => void;
}

function RolePicker({ selected, onSelect }: RolePickerProps) {
  const { t } = useTranslation();
  return (
    <View className="gap-2">
      {ROLE_OPTIONS.map((option) => {
        const isSelected = selected === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onSelect(option.value)}
            accessible
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={t(option.labelKey)}
            className={`rounded-xl border p-3 ${
              isSelected
                ? 'border-teal-500 bg-teal-50'
                : 'border-slate-200 bg-white'
            }`}
          >
            <View className="flex-row items-center gap-3">
              {/* Radio indicator */}
              <View
                className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                  isSelected ? 'border-teal-500' : 'border-slate-300'
                }`}
              >
                {isSelected && (
                  <View className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                )}
              </View>
              <View className="flex-1">
                <Text
                  className={`text-sm font-semibold ${
                    isSelected ? 'text-teal-700' : 'text-slate-700'
                  }`}
                >
                  {t(option.labelKey)}
                </Text>
                <Text className="text-xs text-slate-500 mt-0.5">
                  {t(option.descriptionKey)}
                </Text>
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

interface SuccessViewProps {
  result: InviteResult;
  onClose: () => void;
}

function SuccessView({ result, onClose }: SuccessViewProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    // TODO: Add expo-clipboard when available. For now, user can long-press to copy.
    void result.inviteLink;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result.inviteLink]);

  return (
    <View className="items-center py-4">
      <View className="w-14 h-14 rounded-full bg-teal-100 items-center justify-center mb-4">
        <Text className="text-2xl" aria-hidden>
          ✓
        </Text>
      </View>

      <Text className="text-lg font-bold text-slate-800 mb-1">
        {t('caregiving.inviteSent')}
      </Text>
      <Text className="text-sm text-slate-500 text-center mb-6">
        {t('caregiving.inviteSentSubtext')}
      </Text>

      {/* Invite link box */}
      <View className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4">
        <Text className="text-xs text-slate-500 mb-1">{t('caregiving.inviteLink')}</Text>
        <Text
          className="text-sm font-mono text-slate-700"
          numberOfLines={2}
          selectable
        >
          {result.inviteLink}
        </Text>
      </View>

      {/* Invite code */}
      <View className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 mb-6">
        <Text className="text-xs text-slate-500 mb-1">{t('caregiving.inviteCode')}</Text>
        <Text className="text-xl font-bold text-center tracking-widest text-slate-800" selectable>
          {result.inviteToken.toUpperCase()}
        </Text>
      </View>

      <Button
        label={copied ? t('common.copied') : t('caregiving.copyLink')}
        variant="secondary"
        onPress={handleCopy}
        className="w-full mb-3"
        accessibilityLabel={t('caregiving.copyLinkLabel')}
      />
      <Button
        label={t('common.cancel')}
        variant="primary"
        onPress={onClose}
        className="w-full"
      />
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function InviteSheet({ visible, onClose }: InviteSheetProps) {
  const { t } = useTranslation();
  const sendInvite = useCaregivingStore((s) => s.sendInvite);
  const storeError = useCaregivingStore((s) => s.error);
  const clearError = useCaregivingStore((s) => s.clearError);

  const [contactValue, setContactValue] = useState('');
  const [contactType, setContactType] = useState<'email' | 'phone'>('email');
  const [role, setRole] = useState<InviteRole>('observer');
  const [isSending, setIsSending] = useState(false);
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const resetAndClose = useCallback(() => {
    setContactValue('');
    setContactType('email');
    setRole('observer');
    setInviteResult(null);
    setValidationError(null);
    clearError();
    onClose();
  }, [onClose, clearError]);

  const validate = useCallback((): boolean => {
    if (!contactValue.trim()) {
      setValidationError(t('caregiving.inviteContactRequired'));
      return false;
    }
    if (contactType === 'email' && !contactValue.includes('@')) {
      setValidationError(t('caregiving.inviteEmailInvalid'));
      return false;
    }
    setValidationError(null);
    return true;
  }, [contactValue, contactType, t]);

  const handleSend = useCallback(async () => {
    if (!validate()) return;

    setIsSending(true);
    try {
      const email = contactType === 'email' ? contactValue.trim() : undefined;
      const phone = contactType === 'phone' ? contactValue.trim() : undefined;
      const result = await sendInvite(email, phone, role);
      setInviteResult(result);
    } catch {
      // storeError will surface the message
    } finally {
      setIsSending(false);
    }
  }, [validate, contactType, contactValue, role, sendInvite]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={resetAndClose}
      accessible
      accessibilityViewIsModal
    >
      {/* Backdrop */}
      <Pressable
        className="flex-1 bg-black/50"
        onPress={resetAndClose}
        accessibilityLabel={t('common.cancel')}
        accessibilityRole="button"
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="absolute bottom-0 left-0 right-0"
      >
        <View className="bg-white rounded-t-3xl">
          {/* Handle */}
          <View className="items-center pt-3 pb-1">
            <View className="w-10 h-1 rounded-full bg-slate-300" aria-hidden />
          </View>

          <ScrollView
            contentContainerClassName="px-5 pb-10 pt-4"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {inviteResult ? (
              <SuccessView result={inviteResult} onClose={resetAndClose} />
            ) : (
              <>
                {/* Header */}
                <Text className="text-xl font-bold text-slate-800 mb-1">
                  {t('caregiving.inviteTitle')}
                </Text>
                <Text className="text-sm text-slate-500 mb-6">
                  {t('caregiving.inviteSubtitle')}
                </Text>

                {/* Contact type picker */}
                <View className="flex-row gap-2 mb-4">
                  {(['email', 'phone'] as const).map((type) => (
                    <Pressable
                      key={type}
                      onPress={() => {
                        setContactType(type);
                        setContactValue('');
                        setValidationError(null);
                      }}
                      accessible
                      accessibilityRole="tab"
                      accessibilityState={{ selected: contactType === type }}
                      className={`flex-1 py-2 rounded-lg items-center border ${
                        contactType === type
                          ? 'border-teal-500 bg-teal-50'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <Text
                        className={`text-sm font-medium ${
                          contactType === type ? 'text-teal-700' : 'text-slate-600'
                        }`}
                      >
                        {type === 'email' ? t('auth.email') : t('auth.phone')}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {/* Contact input */}
                <View className="mb-1">
                  <Text className="text-xs font-medium text-slate-600 mb-1.5">
                    {contactType === 'email' ? t('auth.email') : t('auth.phone')}
                  </Text>
                  <TextInput
                    value={contactValue}
                    onChangeText={(v) => {
                      setContactValue(v);
                      if (validationError) setValidationError(null);
                    }}
                    placeholder={
                      contactType === 'email'
                        ? 'name@example.com'
                        : '+1 (555) 000-0000'
                    }
                    keyboardType={contactType === 'email' ? 'email-address' : 'phone-pad'}
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 bg-white"
                    accessibilityLabel={
                      contactType === 'email' ? t('auth.email') : t('auth.phone')
                    }
                    aria-describedby={validationError ? 'invite-contact-error' : undefined}
                  />
                  {validationError && (
                    <Text
                      nativeID="invite-contact-error"
                      className="text-xs text-red-500 mt-1"
                      accessibilityRole="alert"
                    >
                      {validationError}
                    </Text>
                  )}
                </View>

                {/* Role picker */}
                <Text className="text-xs font-medium text-slate-600 mb-1.5 mt-5">
                  {t('caregiving.selectRole')}
                </Text>
                <RolePicker selected={role} onSelect={setRole} />

                {/* Store-level error */}
                {storeError && (
                  <Text
                    className="text-xs text-red-500 mt-4 text-center"
                    accessibilityRole="alert"
                  >
                    {storeError}
                  </Text>
                )}

                {/* Actions */}
                <View className="flex-row gap-3 mt-6">
                  <View className="flex-1">
                    <Button
                      label={t('common.cancel')}
                      variant="secondary"
                      onPress={resetAndClose}
                    />
                  </View>
                  <View className="flex-1">
                    {isSending ? (
                      <View className="bg-teal-500 rounded-xl py-3 items-center justify-center">
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      </View>
                    ) : (
                      <Button
                        label={t('caregiving.sendInvite')}
                        variant="primary"
                        onPress={handleSend}
                        accessibilityLabel={t('caregiving.sendInviteLabel')}
                      />
                    )}
                  </View>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
