import { NativeTabs } from 'expo-router/unstable-native-tabs';

export default function OTLayout() {
  return (
    <NativeTabs
      tintColor="#1E40AF"
      backgroundColor="#ffffff"
      indicatorColor="#EFF6FF"
      labelStyle={{ selected: { color: '#1E40AF' } }}
    >
      <NativeTabs.Trigger name="index" disableTransparentOnScrollEdge>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' }}
          md="grid_view"
        />
        <NativeTabs.Trigger.Label>Dashboard</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="employees" disableTransparentOnScrollEdge>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'person.2', selected: 'person.2.fill' }}
          md="group"
        />
        <NativeTabs.Trigger.Label>Staff</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="tasks" disableTransparentOnScrollEdge>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'doc.text', selected: 'doc.text.fill' }}
          md="assignment"
        />
        <NativeTabs.Trigger.Label>Tasks</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="assignment" disableTransparentOnScrollEdge>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'person.badge.plus', selected: 'person.badge.plus.fill' }}
          md="assignment_ind"
        />
        <NativeTabs.Trigger.Label>Assign</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
