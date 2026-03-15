import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function TabLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0f172a',
          borderTopColor: '#1e293b',
        },
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#64748b',
      }}
    >
      <Tabs.Screen
        name="medications/index"
        options={{
          title: t('tabs.medications'),
          tabBarLabel: t('tabs.medications'),
          tabBarIcon: () => null,
        }}
      />
      <Tabs.Screen
        name="schedule/index"
        options={{
          title: t('tabs.schedule'),
          tabBarLabel: t('tabs.schedule'),
          tabBarIcon: () => null,
        }}
      />
      <Tabs.Screen
        name="caregiving/index"
        options={{
          title: t('tabs.caregiving'),
          tabBarLabel: t('tabs.caregiving'),
          tabBarIcon: () => null,
        }}
      />
      <Tabs.Screen
        name="emergency/index"
        options={{
          title: t('tabs.emergency'),
          tabBarLabel: t('tabs.emergency'),
          tabBarIcon: () => null,
        }}
      />
      <Tabs.Screen
        name="settings/index"
        options={{
          title: t('tabs.settings'),
          tabBarLabel: t('tabs.settings'),
          tabBarIcon: () => null,
        }}
      />
    </Tabs>
  );
}
