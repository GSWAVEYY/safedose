import { Redirect } from 'expo-router';

import { useUserStore } from '../store/user';

/**
 * Root index — redirects to the appropriate entry point.
 * Authenticated users go to the tabs, unauthenticated to login.
 */
export default function Index() {
  const isAuthenticated = useUserStore((s) => s.isAuthenticated);

  if (isAuthenticated) {
    return <Redirect href="/(tabs)/medications" />;
  }

  return <Redirect href="/(auth)/login" />;
}
