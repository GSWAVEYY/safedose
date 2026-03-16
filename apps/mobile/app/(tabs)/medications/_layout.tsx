/**
 * Medications stack layout.
 *
 * Provides a Stack navigator for the medications tab so that the
 * add and detail screens can be pushed on top of the list screen.
 * The tab bar remains visible at all times.
 */

import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function MedicationsLayout() {
  const { t } = useTranslation();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#F8FAFC' },
        headerTintColor: '#0F172A',
        headerTitleStyle: { fontWeight: '600' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: '#F8FAFC' },
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title: t('medications.title'), headerShown: false }}
      />
      <Stack.Screen
        name="add"
        options={{ title: t('medications.addMedication'), headerBackTitle: t('common.back') }}
      />
      <Stack.Screen
        name="[id]"
        options={{ title: '', headerBackTitle: t('common.back') }}
      />
    </Stack>
  );
}
