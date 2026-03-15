import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text } from 'react-native';

export default function CaregivingScreen() {
  return (
    <SafeAreaView className="flex-1 bg-surface-dark">
      <View className="flex-1 items-center justify-center">
        <Text className="text-white text-2xl font-bold">Caregiving</Text>
        <Text className="text-white/60 text-sm mt-2">Sprint 2: Caregiver dashboard coming soon</Text>
      </View>
    </SafeAreaView>
  );
}
