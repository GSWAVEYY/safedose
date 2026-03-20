import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  Pill,
  CalendarDays,
  Users,
  ShieldAlert,
  Settings,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect } from 'react';
import { View, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

// ─── Design tokens ────────────────────────────────────────────────────────────
const ACTIVE_COLOR = '#0D9488';   // brand-600 teal
const INACTIVE_COLOR = '#94A3B8'; // neutral-400 slate
const ICON_SIZE = 24;

// ─── Spring config ────────────────────────────────────────────────────────────
const SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
};

// ─── Animated indicator dot ───────────────────────────────────────────────────
interface TabIconProps {
  Icon: LucideIcon;
  focused: boolean;
  color: string;
}

function TabIcon({ Icon, focused, color }: TabIconProps) {
  const dotScale = useSharedValue(focused ? 1 : 0);
  const dotOpacity = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    dotScale.value = withSpring(focused ? 1 : 0, SPRING_CONFIG);
    dotOpacity.value = withSpring(focused ? 1 : 0, SPRING_CONFIG);
  }, [focused, dotScale, dotOpacity]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: dotScale.value }],
    opacity: dotOpacity.value,
  }));

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', gap: 4 }}>
      <Icon size={ICON_SIZE} color={color} strokeWidth={focused ? 2.2 : 1.8} />
      <Animated.View
        style={[
          {
            width: 20,
            height: 3,
            borderRadius: 2,
            backgroundColor: ACTIVE_COLOR,
          },
          dotStyle,
        ]}
      />
    </View>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────
export default function TabLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 0,
          marginBottom: Platform.OS === 'ios' ? 0 : 4,
        },
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E2E8F0',
          height: Platform.OS === 'ios' ? 84 : 65,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          // Elevation / shadow
          ...Platform.select({
            android: {
              elevation: 8,
            },
            ios: {
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
            },
          }),
        },
        tabBarItemStyle: {
          paddingTop: 4,
        },
      }}
    >
      {/* ── Visible tabs ───────────────────────────────────────────────── */}
      <Tabs.Screen
        name="medications/index"
        options={{
          title: t('tabs.medications'),
          tabBarLabel: t('tabs.medications'),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon Icon={Pill} focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="schedule/index"
        options={{
          title: t('tabs.schedule'),
          tabBarLabel: t('tabs.schedule'),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon Icon={CalendarDays} focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="caregiving/index"
        options={{
          title: t('tabs.caregiving'),
          tabBarLabel: t('tabs.caregiving'),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon Icon={Users} focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="emergency/index"
        options={{
          title: t('tabs.emergency'),
          tabBarLabel: t('tabs.emergency'),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon Icon={ShieldAlert} focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings/index"
        options={{
          title: t('tabs.settings'),
          tabBarLabel: t('tabs.settings'),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon Icon={Settings} focused={focused} color={color} />
          ),
        }}
      />

      {/* ── Hidden screens (not shown in tab bar) ──────────────────────── */}
      <Tabs.Screen
        name="medications/[id]"
        options={{ href: null, headerShown: false }}
      />
      <Tabs.Screen
        name="medications/add"
        options={{ href: null, headerShown: false }}
      />
      <Tabs.Screen
        name="medications/_layout"
        options={{ href: null, headerShown: false }}
      />
      <Tabs.Screen
        name="schedule/symptoms"
        options={{ href: null, headerShown: false }}
      />
      <Tabs.Screen
        name="schedule/timeline"
        options={{ href: null, headerShown: false }}
      />
      <Tabs.Screen
        name="caregiving/wellness"
        options={{ href: null, headerShown: false }}
      />
      <Tabs.Screen
        name="settings/subscription"
        options={{ href: null, headerShown: false }}
      />
    </Tabs>
  );
}
