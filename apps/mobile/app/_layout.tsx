import '../global.css';

import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, Redirect } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator } from 'react-native';

// i18n must be imported for side-effects (initializes before any screen renders)
import '../lib/i18n';
import { useUserStore } from '../store/user';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

function AuthGate() {
  const { isAuthenticated, isLoading, checkAuth } = useUserStore();
  const [bootChecked, setBootChecked] = useState(false);

  useEffect(() => {
    checkAuth().finally(() => setBootChecked(true));
  }, [checkAuth]);

  if (!bootChecked || isLoading) {
    // Splash-style loader while we verify stored tokens
    return (
      <View className="flex-1 bg-surface-dark items-center justify-center">
        <ActivityIndicator size="large" color="#2dd4bf" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return null; // authenticated — let the Stack render normally
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <AuthGate />
        <Stack screenOptions={{ headerShown: false }} />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
