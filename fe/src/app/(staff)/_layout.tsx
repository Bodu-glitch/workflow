import { NativeTabs } from 'expo-router/unstable-native-tabs';

export default function StaffLayout() {
  return (
    <NativeTabs
      tintColor="#1E40AF"
      backgroundColor="#ffffff"
      indicatorColor="#EFF6FF"
      labelStyle={{ selected: { color: '#1E40AF' } }}
    >
      <NativeTabs.Trigger name="index" disableTransparentOnScrollEdge>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'list.bullet', selected: 'list.bullet.fill' }}
          md="assignment"
        />
        <NativeTabs.Trigger.Label>Tasks</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="jobs" disableTransparentOnScrollEdge>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'wrench.and.screwdriver', selected: 'wrench.and.screwdriver.fill' }}
          md="build"
        />
        <NativeTabs.Trigger.Label>Jobs</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="history" disableTransparentOnScrollEdge>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'clock.arrow.circlepath', selected: 'clock.arrow.circlepath' }}
          md="history"
        />
        <NativeTabs.Trigger.Label>History</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
