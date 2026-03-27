import { useState } from 'react';
import { FlatList, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { View, Text, Pressable } from '@/tw';
import { meApi } from '@/lib/api/me';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorView } from '@/components/ui/ErrorView';
import type { Task } from '@/types/api';

export default function WorkHistoryScreen() {
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['me-history', page],
    queryFn: () => meApi.history(page),
  });

  const tasks = data?.data ?? [];
  const meta = data?.meta;

  if (isLoading) return <LoadingScreen />;
  if (isError) return <ErrorView onRetry={refetch} />;

  function renderTask({ item: task }: { item: Task }) {
    const duration =
      task.checkin?.checked_in_at && task.checkout?.checked_out_at
        ? (() => {
            const diff =
              new Date(task.checkout.checked_out_at).getTime() -
              new Date(task.checkin.checked_in_at).getTime();
            const hours = Math.floor(diff / 3_600_000);
            const minutes = Math.floor((diff % 3_600_000) / 60_000);
            return `${hours}h ${minutes}m`;
          })()
        : null;

    return (
      <Pressable
        onPress={() => router.push({ pathname: '/(staff)/tasks/[id]', params: { id: task.id } })}
        className="bg-surface-container-lowest rounded-xl p-5 mb-3 mx-4 overflow-hidden active:opacity-70"
      >
        <View className="absolute left-0 top-0 bottom-0 w-1 bg-success" />
        <View className="flex-row items-start justify-between mb-3">
          <Text className="text-base font-bold text-on-surface flex-1 mr-3" numberOfLines={1}>
            {task.title}
          </Text>
          <StatusBadge status={task.status} />
        </View>

        <View className="gap-1.5">
          {task.location_name && (
            <Text className="text-xs text-on-surface-variant" numberOfLines={1}>📍 {task.location_name}</Text>
          )}
          {task.checkin?.checked_in_at && (
            <Text className="text-xs text-on-surface-variant">
              Check-in: {new Date(task.checkin.checked_in_at).toLocaleString('vi-VN')}
            </Text>
          )}
          {task.checkout?.checked_out_at && (
            <Text className="text-xs text-on-surface-variant">
              Check-out: {new Date(task.checkout.checked_out_at).toLocaleString('vi-VN')}
            </Text>
          )}
          {duration && (
            <View className="self-start mt-1 px-2.5 py-0.5 rounded-full bg-success-container">
              <Text className="text-[10px] font-bold text-on-success-container">⏱ {duration}</Text>
            </View>
          )}
          {task.checkin?.photo_url && (
            <Text className="text-xs text-primary mt-1">📷 Photo attached</Text>
          )}
        </View>
      </Pressable>
    );
  }

  return (
    <View className="flex-1 bg-surface-container-low">
      {/* Glass Header */}
      <View className="glass-effect px-5 pt-14 pb-4">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} className="active:opacity-60">
            <Text className="text-primary font-semibold">← Back</Text>
          </Pressable>
          <Text className="text-xl font-extrabold text-on-surface tracking-tight flex-1">Work History</Text>
        </View>
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
          <View className="py-16 items-center">
            <Text className="text-on-surface-variant text-sm">No completed tasks yet</Text>
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
