import { useState } from 'react';
import { FlatList, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { View, Text, Pressable } from '@/tw';
import { technicianApi } from '@/lib/api/technician';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorView } from '@/components/ui/ErrorView';
import type { ServiceRequestSummary } from '@/lib/api/requests';

const STATUS_LABELS: Record<string, string> = {
  completed: 'Completed',
  completed_late: 'Completed (late)',
  cancelled: 'Cancelled',
};

const STATUS_COLORS: Record<string, string> = {
  completed: '#10B981',
  completed_late: '#F59E0B',
  cancelled: '#9CA3AF',
};

export default function WorkHistoryScreen() {
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['technician-history', page],
    queryFn: () => technicianApi.getHistory({ page, limit: 20 }),
  });

  const jobs: ServiceRequestSummary[] = data?.data ?? [];
  const meta = data?.meta;

  if (isLoading) return <LoadingScreen />;
  if (isError) return <ErrorView onRetry={refetch} />;

  function renderJob({ item: job }: { item: ServiceRequestSummary }) {
    const statusColor = STATUS_COLORS[job.status] ?? '#9CA3AF';
    const statusLabel = STATUS_LABELS[job.status] ?? job.status;

    return (
      <Pressable
        onPress={() => router.push({ pathname: '/(staff)/jobs/[id]', params: { id: job.id } })}
        className="bg-surface-container-lowest rounded-xl p-5 mb-3 mx-4 overflow-hidden active:opacity-70"
      >
        <View className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: statusColor }} />
        <View className="flex-row items-start justify-between mb-2">
          <View className="flex-1 mr-3 gap-0.5">
            <Text className="text-xs font-bold" style={{ color: statusColor }}>{job.category?.name ?? 'Service'}</Text>
            <Text className="text-sm font-semibold text-on-surface" numberOfLines={2}>{job.description}</Text>
          </View>
          <View style={{ backgroundColor: statusColor + '20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: statusColor }}>{statusLabel}</Text>
          </View>
        </View>

        <View className="gap-1 mt-1">
          {job.customer && (
            <Text className="text-xs text-on-surface-variant">👤 {job.customer.full_name}</Text>
          )}
          {job.completed_at && (
            <Text className="text-xs text-on-surface-variant">
              ✅ {new Date(job.completed_at).toLocaleString('en-US')}
            </Text>
          )}
          {job.collected_amount != null && (
            <View className="flex-row items-center justify-between mt-1 pt-2 border-t border-outline/20">
              <Text className="text-xs text-on-surface-variant">Collected</Text>
              <Text className="text-sm font-bold text-success">💰 {job.collected_amount.toLocaleString('en-US')}₫</Text>
            </View>
          )}
        </View>
      </Pressable>
    );
  }

  return (
    <View className="flex-1 bg-surface-container-low">
      <View className="glass-effect px-5 pt-14 pb-4">
        <Text className="text-xl font-extrabold text-on-surface tracking-tight">Work History</Text>
      </View>

      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        renderItem={renderJob}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => { setPage(1); refetch(); }} />
        }
        ListEmptyComponent={
          <View className="py-16 items-center gap-2">
            <Text className="text-4xl">📋</Text>
            <Text className="text-on-surface-variant text-sm">No completed jobs yet</Text>
          </View>
        }
        ListFooterComponent={
          meta && meta.page * meta.limit < meta.total ? (
            <Pressable
              onPress={() => setPage((p) => p + 1)}
              className="mx-4 mb-4 py-3 rounded-xl bg-surface-container-high items-center active:opacity-60"
            >
              <Text className="text-primary font-semibold text-sm">Load more</Text>
            </Pressable>
          ) : null
        }
      />
    </View>
  );
}
