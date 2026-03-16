import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router } from 'expo-router';
import { useUserStore } from '../../store/user';

// ─── Client-side validation ───────────────────────────────────────────────────

function validateEmail(value: string): string | null {
  if (!value.trim()) return 'Email is required.';
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(value.trim())) return 'Please enter a valid email address.';
  return null;
}

function validatePassword(value: string): string | null {
  if (!value) return 'Password is required.';
  if (value.length < 8) return 'Password must be at least 8 characters.';
  return null;
}

function validateConfirmPassword(password: string, confirm: string): string | null {
  if (!confirm) return 'Please confirm your password.';
  if (password !== confirm) return 'Passwords do not match.';
  return null;
}

function validateDisplayName(value: string): string | null {
  if (!value.trim()) return 'Display name is required.';
  if (value.trim().length > 100) return 'Display name must be 100 characters or fewer.';
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RegisterScreen() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { register, isLoading, error, clearError } = useUserStore();

  function validate(): boolean {
    const errors: Record<string, string> = {};

    const nameErr = validateDisplayName(displayName);
    if (nameErr) errors['displayName'] = nameErr;

    const emailErr = validateEmail(email);
    if (emailErr) errors['email'] = emailErr;

    const pwErr = validatePassword(password);
    if (pwErr) errors['password'] = pwErr;

    const confirmErr = validateConfirmPassword(password, confirmPassword);
    if (confirmErr) errors['confirmPassword'] = confirmErr;

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleRegister() {
    clearError();
    if (!validate()) return;

    try {
      await register(email.trim().toLowerCase(), password, displayName.trim());
      router.replace('/(tabs)');
    } catch {
      // Error is set in the store — rendered via the `error` field
    }
  }

  function fieldError(field: string): JSX.Element | null {
    const msg = fieldErrors[field];
    if (!msg) return null;
    return (
      <Text className="text-red-400 text-xs mt-1 ml-1">{msg}</Text>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-dark">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="items-center justify-center px-6 py-10"
          keyboardShouldPersistTaps="handled"
        >

          {/* Logo / wordmark */}
          <View className="mb-8 items-center">
            <Text className="text-teal-400 text-4xl font-bold tracking-tight">
              SafeDose
            </Text>
            <Text className="text-white/50 text-sm mt-1">
              Create your account
            </Text>
          </View>

          {/* Display Name */}
          <View className="w-full mb-4">
            <Text className="text-white/70 text-sm mb-1 ml-1">Display Name</Text>
            <TextInput
              className="w-full bg-white/10 text-white rounded-xl px-4 py-3 text-base"
              placeholder="e.g. Maria"
              placeholderTextColor="rgba(255,255,255,0.3)"
              autoCapitalize="words"
              autoCorrect={false}
              value={displayName}
              onChangeText={(v) => {
                setDisplayName(v);
                if (fieldErrors['displayName']) setFieldErrors((p) => ({ ...p, displayName: '' }));
              }}
              editable={!isLoading}
            />
            {fieldError('displayName')}
          </View>

          {/* Email */}
          <View className="w-full mb-4">
            <Text className="text-white/70 text-sm mb-1 ml-1">Email</Text>
            <TextInput
              className="w-full bg-white/10 text-white rounded-xl px-4 py-3 text-base"
              placeholder="you@example.com"
              placeholderTextColor="rgba(255,255,255,0.3)"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                if (fieldErrors['email']) setFieldErrors((p) => ({ ...p, email: '' }));
              }}
              editable={!isLoading}
            />
            {fieldError('email')}
          </View>

          {/* Password */}
          <View className="w-full mb-4">
            <Text className="text-white/70 text-sm mb-1 ml-1">Password</Text>
            <TextInput
              className="w-full bg-white/10 text-white rounded-xl px-4 py-3 text-base"
              placeholder="Min. 8 characters"
              placeholderTextColor="rgba(255,255,255,0.3)"
              secureTextEntry
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                if (fieldErrors['password']) setFieldErrors((p) => ({ ...p, password: '' }));
              }}
              editable={!isLoading}
            />
            {fieldError('password')}
          </View>

          {/* Confirm Password */}
          <View className="w-full mb-2">
            <Text className="text-white/70 text-sm mb-1 ml-1">Confirm Password</Text>
            <TextInput
              className="w-full bg-white/10 text-white rounded-xl px-4 py-3 text-base"
              placeholder="Re-enter password"
              placeholderTextColor="rgba(255,255,255,0.3)"
              secureTextEntry
              value={confirmPassword}
              onChangeText={(v) => {
                setConfirmPassword(v);
                if (fieldErrors['confirmPassword']) setFieldErrors((p) => ({ ...p, confirmPassword: '' }));
              }}
              editable={!isLoading}
              onSubmitEditing={handleRegister}
              returnKeyType="done"
            />
            {fieldError('confirmPassword')}
          </View>

          {/* Server-side error */}
          {error !== null && (
            <View className="w-full mb-3 bg-red-500/20 rounded-lg px-4 py-2 mt-2">
              <Text className="text-red-400 text-sm">{error}</Text>
            </View>
          )}

          {/* Create Account button */}
          <TouchableOpacity
            className="w-full bg-teal-500 rounded-xl py-4 items-center mt-3"
            onPress={handleRegister}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-white font-semibold text-base">Create Account</Text>
            )}
          </TouchableOpacity>

          {/* Login link */}
          <View className="flex-row mt-8">
            <Text className="text-white/50 text-sm">Already have an account? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text className="text-teal-400 text-sm font-medium">Log In</Text>
              </TouchableOpacity>
            </Link>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
