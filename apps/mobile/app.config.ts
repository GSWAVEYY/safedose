import type { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'SafeDose',
  slug: 'safedose',
  scheme: 'safedose',
  version: '1.0.0',
  extra: {
    // Sentry DSN for mobile error monitoring.
    // Set EXPO_PUBLIC_SENTRY_DSN in your .env or EAS secrets.
    // Leave undefined to disable Sentry (safe — it no-ops without a DSN).
    // PHI POLICY: only opaque IDs and non-health event data reach Sentry.
    EXPO_PUBLIC_SENTRY_DSN: process.env['EXPO_PUBLIC_SENTRY_DSN'],
  },
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0f172a',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.vraxon.safedose',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0f172a',
    },
    package: 'com.vraxon.safedose',
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    '@sentry/react-native',
    'expo-sharing',
    'expo-web-browser',
    [
      'expo-camera',
      {
        cameraPermission: 'Allow SafeDose to access your camera to scan medication labels.',
      },
    ],
    [
      'expo-local-authentication',
      {
        faceIDPermission: 'Allow SafeDose to use Face ID for secure authentication.',
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#0f172a',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
});
