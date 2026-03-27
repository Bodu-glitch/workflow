import { Tabs, TabList, TabTrigger, TabSlot } from 'expo-router/ui';
import { StyleSheet } from 'react-native';
import { Pressable, Text, View } from '@/tw';
import type { TabTriggerSlotProps } from 'expo-router/ui';

function WebTabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  return (
    <Pressable {...props}>
      <View
        className={`px-4 py-2 rounded-xl ${isFocused ? 'bg-[#1E40AF]' : 'bg-surface-container'}`}>
        <Text
          className={`text-sm font-semibold ${isFocused ? 'text-white' : 'text-on-surface-variant'}`}>
          {children}
        </Text>
      </View>
    </Pressable>
  );
}

export default function BOWebLayout() {
  return (
    <Tabs>
      <TabSlot style={{ flex: 1 }} />
      <TabList style={styles.tabList}>
        <TabTrigger name="index" href="/(bo)" asChild>
          <WebTabButton>Dashboard</WebTabButton>
        </TabTrigger>
        <TabTrigger name="employees" href="/(bo)/employees" asChild>
          <WebTabButton>Staff</WebTabButton>
        </TabTrigger>
        <TabTrigger name="tasks" href="/(bo)/tasks" asChild>
          <WebTabButton>Tasks</WebTabButton>
        </TabTrigger>
        <TabTrigger name="audit-log" href="/(bo)/audit-log" asChild>
          <WebTabButton>Audit</WebTabButton>
        </TabTrigger>
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabList: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
});
