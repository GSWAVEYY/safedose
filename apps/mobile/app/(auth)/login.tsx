import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router } from 'expo-router';
import { useUserStore } from '../../store/user';
import { isBiometricEnabled } from '../../lib/auth/index';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showBiometric, setShowBiometric] = useState(false);

  const { login, biometricUnlock, isLoading, error, clearError } = useUserStore();

  useEffect(() => {
    isBiometricEnabled().then(setShowBiometric).catch(() => setShowBiometric(false));
  }, []);

  async function handleLogin() {
    if (!email.trim()) {
      Alert.alert('Missing email', 'Please enter your email address.');
      return;
    }
    if (!password) {
      Alert.alert('Missing password', 'Please enter your password.');
      return;
    }

    clearError();
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace('/(tabs)');
    } catch {
      // Error is set in the store — rendered below
    }
  }

  async function handleBiometricUnlock() {
    clearError();
    const success = await biometricUnlock();
    if (success) {
      router.replace('/(tabs)');
    } else {
      Alert.alert('Biometric failed', 'Could not verify identity. Please use your password.');
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-dark">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View className="flex-1 items-center justify-center px-6">

          {/* Logo / wordmark */}
          <View className="mb-10 items-center">
            <Text className="text-teal-400 text-4xl font-bold tracking-tight">
              SafeDose
            </Text>
            <Text className="text-white/50 text-sm mt-1">
              Medication safety, simplified.
            </Text>
          </View>

          {/* Email input */}
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
              onChangeText={setEmail}
              editable={!isLoading}
            />
          </View>

          {/* Password input */}
          <View className="w-full mb-2">
            <Text className="text-white/70 text-sm mb-1 ml-1">Password</Text>
            <TextInput
              className="w-full bg-white/10 text-white rounded-xl px-4 py-3 text-base"
              placeholder="••••••••"
              placeholderTextColor="rgba(255,255,255,0.3)"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              editable={!isLoading}
              onSubmitEditing={handleLogin}
              returnKeyType="done"
            />
          </View>

          {/* Error message */}
          {error !== null && (
            <View className="w-full mb-3 bg-red-500/20 rounded-lg px-4 py-2">
              <Text className="text-red-400 text-sm">{error}</Text>
            </View>
          )}

          {/* Log In button */}
          <TouchableOpacity
            className="w-full bg-teal-500 rounded-xl py-4 items-center mt-2"
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-white font-semibold text-base">Log In</Text>
            )}
          </TouchableOpacity>

          {/* Biometric unlock */}
          {showBiometric && !isLoading && (
            <TouchableOpacity
              className="w-full mt-3 border border-white/20 rounded-xl py-4 items-center"
              onPress={handleBiometricUnlock}
              activeOpacity={0.7}
            >
              <Text className="text-white/70 text-base">Use Biometric Unlock</Text>
            </TouchableOpacity>
          )}

          {/* Register link */}
          <View className="flex-row mt-8">
            <Text className="text-white/50 text-sm">Don't have an account? </Text>
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity>
                <Text className="text-teal-400 text-sm font-medium">Create Account</Text>
              </TouchableOpacity>
            </Link>
          </View>

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
