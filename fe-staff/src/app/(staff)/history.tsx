import { useState } from 'react';
import { FlatList, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { View, Text, Pressable } from '@/tw';
import { meApi } from '@/lib/api/me';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorView } from '@/components/ui/ErrorView';
import type { Task } from '@/types/api';

const STATUS_LABELS: Record<string, string> = {
  done: 'Hoàn thành',
  cancelled: 'Đã hủy',
  rejected: 'Từ chối',
};

const STATUS_COLORS: Record<string, string> = {
  done: '#10B981',
  cancelled: '#9CA3AF',
  rejected: '#EF4444',
};

export default function WorkHistoryScreen() {
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['me-history', page],
    queryFn: () => meApi.history(page, 20),
  });

  const tasks: Task[] = data?.data ?? [];
  const meta = data?.meta;

  if (isLoading) return <LoadingScreen />;
  if (isError) return <ErrorView onRetry={refetch} />;

  function renderTask({ item: task }: { item: Task }) {
    const statusColor = STATUS_COLORS[task.status] ?? '#9CA3AF';
    const statusLabel = STATUS_LABELS[task.status] ?? task.status;

    return (
      <Pressable
        onPress={() => router.push({ pathname: '/(staff)/tasks/[id]', params: { id: task.id } })}
        className="bg-surface-container-lowest rounded-xl p-5 mb-3 mx-4 overflow-hidden active:opacity-70"
      >
        <View className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: statusColor }} />
        <View className="flex-row items-start justify-between mb-2">
          <View className="flex-1 mr-3 gap-0.5">
            <Text className="text-sm font-semibold text-on-surface" numberOfLines={2}>{task.title}</Text>
            {task.description && (
              <Text className="text-xs text-on-surface-variant" numberOfLines={1}>{task.description}</Text>
            )}
          </View>
          <View style={{ backgroundColor: statusColor + '20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: statusColor }}>{statusLabel}</Text>
          </View>
        </View>

        <View className="gap-1 mt-1">
          {task.location_name && (
            <Text className="text-xs text-on-surface-variant" numberOfLines={1}>📍 {task.location_name}</Text>
          )}
          {task.deadline && (
            <Text className="text-xs text-on-surface-variant">
              ⏰ {new Date(task.deadline).toLocaleString('vi-VN')}
            </Text>
          )}
        </View>
      </Pressable>
    );
  }

  return (
    <View className="flex-1 bg-surface-container-low">
      <View className="glass-effect px-5 pt-14 pb-4">
        <Text className="text-xl font-extrabold text-on-surface tracking-tight">Lịch sử công việc</Text>
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        renderItem={renderTask}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => { setPage(1); refetch(); }} />
        }
        ListEmptyComponent={
          <View className="py-16 items-center gap-2">
            <Text className="text-4xl">📋</Text>
            <Text className="text-on-surface-variant text-sm">Chưa có công việc nào hoàn thành</Text>
          </View>
        }
        ListFooterComponent={
          meta && meta.page * meta.limit < meta.total ? (
            <Pressable
              onPress={() => setPage((p) => p + 1)}
              className="mx-4 mb-4 py-3 rounded-xl bg-surface-container-high items-center active:opacity-60"
            >
              <Text className="text-primary font-semibold text-sm">Xem thêm</Text>
            </Pressable>
          ) : null
        }
      />
    </View>
  );
}
