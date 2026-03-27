import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FlatList, RefreshControl } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { View, Text, Pressable } from '@/tw';
import { tasksApi } from '@/lib/api/tasks';
import { StatusBadge, PriorityBadge, PRIORITY_PILL_COLOR } from '@/components/ui/StatusBadge';
import { ErrorView } from '@/components/ui/ErrorView';
import type { Task, TaskStatus } from '@/types/api';

const STATUS_FILTERS: { label: string; value: TaskStatus | undefined }[] = [
  { label: 'All', value: undefined },
  { label: 'Pending', value: 'todo' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Completed', value: 'done' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'Rejected', value: 'rejected' },
];

function TaskCard({ task }: { task: Task }) {
  const pillColor = task.priority ? PRIORITY_PILL_COLOR[task.priority] : 'bg-outline';
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/(ot)/tasks/[id]', params: { id: task.id } })}
      className="bg-surface-container-lowest rounded-xl p-5 mb-3 mx-4 overflow-hidden active:opacity-75"
    >
      <View className={`absolute left-0 top-0 bottom-0 w-1 ${pillColor}`} />
      <View className="flex-row items-start justify-between mb-3">
        <Text className="text-base font-bold text-on-surface flex-1 mr-3" numberOfLines={2}>
          {task.title}
        </Text>
        <StatusBadge status={task.status} />
      </View>
      {task.priority && <View className="mb-3"><PriorityBadge priority={task.priority} /></View>}
      <View className="gap-1.5">
        {task.location_name && (
          <Text className="text-xs text-on-surface-variant" numberOfLines={1}>📍 {task.location_name}</Text>
        )}
        {task.scheduled_at && (
          <Text className="text-xs text-on-surface-variant">
            🕐 {new Date(task.scheduled_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}
        {(task.assignees?.length ?? 0) > 0 && (
          <Text className="text-xs text-on-surface-variant" numberOfLines={1}>
            👥 {task.assignees!.map((a) => a.full_name).join(', ')}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export default function OTTaskListScreen() {
  const params = useLocalSearchParams<{ status?: TaskStatus }>();
  const [statusFilter, setStatusFilter] = useState<TaskStatus | undefined>(params.status);
  const [page, setPage] = useState(1);

  const { data, isError, refetch, isRefetching } = useQuery({
    queryKey: ['tasks', statusFilter, page],
    queryFn: () => tasksApi.list({ status: statusFilter, page, limit: 20 }),
  });

  const tasks = data?.data ?? [];
  const meta = data?.meta;

  return (
    <View className="flex-1 bg-surface-container-low">
      {/* Glass Header */}
      <View className="glass-effect px-5 pt-14 pb-3">
        <View className="flex-row items-center justify-between mb-4">
          <Pressable onPress={() => router.back()} className="active:opacity-60 mr-3">
            <Text className="text-primary font-semibold">← Back</Text>
          </Pressable>
          <Text className="text-xl font-extrabold text-on-surface tracking-tight flex-1">Task Portfolio</Text>
          <Pressable
            onPress={() => router.push('/(ot)/tasks/create')}
            className="kinetic-gradient w-9 h-9 rounded-full items-center justify-center active:opacity-80"
          >
            <Text className="text-on-primary text-xl font-bold">+</Text>
          </Pressable>
        </View>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={STATUS_FILTERS}
          keyExtractor={(item) => item.label}
          renderItem={({ item }) => {
            const active = statusFilter === item.value;
            return (
              <Pressable
                onPress={() => { setStatusFilter(item.value); setPage(1); }}
                className={`px-5 py-2 rounded-full mr-2 ${active ? 'kinetic-gradient' : 'bg-surface-container-highest'}`}
              >
                <Text className={`text-xs font-bold ${active ? 'text-on-primary' : 'text-on-surface-variant'}`}>
                  {item.label}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      {isError ? (
        <ErrorView onRetry={refetch} />
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <TaskCard task={item} />}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => { setPage(1); refetch(); }} />
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-20">
              <Text className="text-on-surface-variant text-sm">No tasks found</Text>
            </View>
          }
          ListFooterComponent={
            meta && meta.page * meta.limit < meta.total ? (
              <Pressable
                onPress={() => setPage((p) => p + 1)}
                className="mx-4 mb-4 py-3 rounded-xl bg-surface-container-high items-center active:opacity-70"
              >
                <Text className="text-primary font-semibold text-sm">Load more</Text>
              </Pressable>
            ) : null
          }
        />
      )}
    </View>
  );
}
