import { useState } from 'react';
import { FlatList, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { View, Text, Pressable } from '@/tw';
import { auditApi } from '@/lib/api/audit';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorView } from '@/components/ui/ErrorView';
import type { AuditAction, AuditLog } from '@/types/api';

const ACTION_FILTERS: { label: string; value: AuditAction | undefined }[] = [
  { label: 'All', value: undefined },
  { label: 'Created', value: 'task_created' },
  { label: 'Assigned', value: 'task_assigned' },
  { label: 'Check-in', value: 'checkin' },
  { label: 'Check-out', value: 'checkout' },
  { label: 'Completed', value: 'task_completed' },
  { label: 'Cancelled', value: 'task_cancelled' },
  { label: 'Rejected', value: 'task_rejected' },
  { label: 'Member invited', value: 'member_invited' },
  { label: 'Member removed', value: 'member_removed' },
];

const ACTION_PILL: Record<string, { pill: string; badge: string; badgeText: string }> = {
  task_created:   { pill: 'bg-primary',   badge: 'bg-secondary-container',  badgeText: 'text-on-secondary-container' },
  task_updated:   { pill: 'bg-warning',   badge: 'bg-warning-container',    badgeText: 'text-on-warning-container' },
  task_assigned:  { pill: 'bg-secondary', badge: 'bg-secondary-container',  badgeText: 'text-on-secondary-container' },
  task_cancelled: { pill: 'bg-outline',   badge: 'bg-surface-container-highest', badgeText: 'text-on-surface-variant' },
  task_rejected:  { pill: 'bg-error',     badge: 'bg-error-container',      badgeText: 'text-on-error-container' },
  checkin:        { pill: 'bg-success',   badge: 'bg-success-container',    badgeText: 'text-on-success-container' },
  checkout:       { pill: 'bg-success',   badge: 'bg-success-container',    badgeText: 'text-on-success-container' },
  member_invited: { pill: 'bg-secondary', badge: 'bg-secondary-container',  badgeText: 'text-on-secondary-container' },
  member_removed: { pill: 'bg-error',     badge: 'bg-error-container',      badgeText: 'text-on-error-container' },
  status_changed: { pill: 'bg-warning',   badge: 'bg-warning-container',    badgeText: 'text-on-warning-container' },
  task_completed: { pill: 'bg-success',   badge: 'bg-success-container',    badgeText: 'text-on-success-container' },
};

function AuditCard({ log }: { log: AuditLog }) {
  const style = ACTION_PILL[log.action] ?? { pill: 'bg-outline', badge: 'bg-surface-container-highest', badgeText: 'text-on-surface-variant' };

  return (
    <View className="bg-surface-container-lowest rounded-xl p-4 mb-3 flex-row items-start overflow-hidden">
      <View className={`absolute left-0 top-0 bottom-0 w-1 ${style.pill}`} />
      <View className="w-10 h-10 rounded-xl bg-surface-container-high items-center justify-center mr-3">
        <Text className="text-sm font-extrabold text-primary">{log.actor_name?.charAt(0) ?? '?'}</Text>
      </View>
      <View className="flex-1">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-sm font-bold text-on-surface">{log.actor_name}</Text>
          <Text className="text-[10px] text-outline uppercase tracking-wider">
            {new Date(log.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        <View className={`self-start px-2.5 py-0.5 rounded-full mb-1.5 ${style.badge}`}>
          <Text className={`text-[10px] font-bold uppercase tracking-wider ${style.badgeText}`}>
            {log.action.replace(/_/g, ' ')}
          </Text>
        </View>
        <Text className="text-xs text-outline">
          {new Date(log.created_at).toLocaleDateString('vi-VN')}
        </Text>
      </View>
    </View>
  );
}

export default function AuditLogScreen() {
  const [actionFilter, setActionFilter] = useState<AuditAction | undefined>();
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['audit', actionFilter, page],
    queryFn: () => auditApi.list(actionFilter, page),
  });

  const logs = data?.data ?? [];
  const meta = data?.meta;

  if (isLoading) return <LoadingScreen />;
  if (isError) return <ErrorView onRetry={refetch} />;

  return (
    <View className="flex-1 bg-surface-container-low">
      {/* Glass Header */}
      <View className="glass-effect px-5 pt-14 pb-3">
        <View className="flex-row items-center gap-3 mb-4">
          <Pressable onPress={() => router.back()} className="active:opacity-60">
            <Text className="text-primary font-semibold">← Back</Text>
          </Pressable>
          <Text className="text-xl font-extrabold text-on-surface tracking-tight flex-1">Audit Log</Text>
        </View>

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={ACTION_FILTERS}
          keyExtractor={(item) => item.label}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => { setActionFilter(item.value); setPage(1); }}
              className={`px-4 py-2 rounded-full mr-2 ${
                actionFilter === item.value ? 'kinetic-gradient' : 'bg-surface-container-highest'
              }`}
            >
              <Text className={`text-xs font-bold ${actionFilter === item.value ? 'text-on-primary' : 'text-on-surface-variant'}`}>
                {item.label}
              </Text>
            </Pressable>
          )}
        />
      </View>

      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <AuditCard log={item} />}
        contentContainerStyle={{ paddingTop: 16, paddingHorizontal: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => { setPage(1); refetch(); }} />
        }
        ListEmptyComponent={
          <View className="py-16 items-center">
            <Text className="text-on-surface-variant text-sm">No audit logs found</Text>
          </View>
        }
        ListFooterComponent={
          meta && meta.page * meta.limit < meta.total ? (
            <Pressable
              onPress={() => setPage((p) => p + 1)}
              className="py-3 rounded-xl bg-surface-container-high items-center mb-4 active:opacity-60"
            >
              <Text className="text-primary font-semibold text-sm">Load more</Text>
            </Pressable>
          ) : null
        }
      />
    </View>
  );
}
