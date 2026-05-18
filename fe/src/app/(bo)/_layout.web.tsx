import { Tabs, TabList, TabTrigger, TabSlot } from 'expo-router/ui';
import { StyleSheet } from 'react-native';
import { Pressable, Text, View } from '@/tw';
import type { TabTriggerSlotProps } from 'expo-router/ui';

const TAB_ICONS: Record<string, { default: string; focused: string }> = {
  Dashboard: {
    default: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>`,
    focused: `<svg width="22" height="22" viewBox="0 0 24 24" fill="#1E40AF" stroke="none"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>`,
  },
  'Requests': {
    default: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
    focused: `<svg width="22" height="22" viewBox="0 0 24 24" fill="#1E40AF" stroke="none"><path d="M12 2a6 6 0 0 0-6 6c0 5.25-2.5 8-3 9h18c-.5-1-3-3.75-3-9a6 6 0 0 0-6-6zm-1.73 19a2 2 0 0 0 3.46 0H10.27z"/></svg>`,
  },
  Staff: {
    default: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="7" r="3"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.85"/></svg>`,
    focused: `<svg width="22" height="22" viewBox="0 0 24 24" fill="#1E40AF" stroke="none"><path d="M9 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM3 19a6 6 0 0 1 12 0H3zm13-12a3 3 0 0 1 0 5.83V7zm2.5 12h-2.08A8 8 0 0 0 15 15h1a5 5 0 0 1 2.5 4z"/></svg>`,
  },
  Tasks: {
    default: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>`,
    focused: `<svg width="22" height="22" viewBox="0 0 24 24" fill="#1E40AF" stroke="none"><path d="M9 2a1 1 0 0 0-1 1v1H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1V3a1 1 0 0 0-1-1H9zm1 2h4v1H10V4zM8 11h8v1.5H8V11zm0 4h6v1.5H8V15z"/></svg>`,
  },
  Audit: {
    default: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 6 12 12 16 14"/></svg>`,
    focused: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1E40AF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 6 12 12 16 14"/></svg>`,
  },
};

function WebTabButton({ children, isFocused, ...props }: TabTriggerSlotProps & { children?: React.ReactNode }) {
  const label = typeof children === 'string' ? children : '';
  const icon = TAB_ICONS[label];

  return (
    <Pressable {...props} style={{ alignItems: 'center', flex: 1, paddingVertical: 8, gap: 4 }}>
      {icon && (
        <div
          dangerouslySetInnerHTML={{ __html: isFocused ? icon.focused : icon.default }}
          style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        />
      )}
      <Text style={{ fontSize: 11, fontWeight: isFocused ? '700' : '500', color: isFocused ? '#1E40AF' : '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Text>
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
        <TabTrigger name="requests" href="/(bo)/requests" asChild>
          <WebTabButton>Requests</WebTabButton>
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
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    paddingBottom: 8,
  },
});
