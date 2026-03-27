import { useState } from 'react';
import { FlatList, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { View, Text, Pressable } from '@/tw';
import { tasksApi } from '@/lib/api/tasks';
import { StatusBadge, PriorityBadge } from '@/components/ui/StatusBadge';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorView } from '@/components/ui/ErrorView';
import type { Task } from '@/types/api';

export default function OTRejectedOverdueScreen() {
  const [tab, setTab] = useState<'rejected' | 'overdue'>('rejected');

  const rejectedQuery = useQuery({
    queryKey: ['tasks', 'rejected'],
    queryFn: () => tasksApi.list({ status: 'rejected', limit: 50 }),
    select: (d) => d.data,
  });

  const overdueQuery = useQuery({
    queryKey: ['tasks', 'overdue-all'],
    queryFn: async () => {
      const [pending, inProgress] = await Promise.all([
        tasksApi.list({ status: 'todo', limit: 50 }),
        tasksApi.list({ status: 'in_progress', limit: 50 }),
      ]);
      return [...(pending.data ?? []), ...(inProgress.data ?? [])].filter(
        (t) => t.deadline && new Date(t.deadline) < new Date(),
      );
    },
  });

  const currentQuery = tab === 'rejected' ? rejectedQuery : overdueQuery;
  const items = (currentQuery.data as Task[] | undefined) ?? [];

  if (currentQuery.isLoading && !items.length) return <LoadingScreen />;
  if (currentQuery.isError) return <ErrorView onRetry={currentQuery.refetch} />;

  return (
    <View className="flex-1 bg-surface-container-low">
      {/* Glass Header */}
      <View className="glass-effect px-5 pt-14 pb-4">
        <View className="flex-row items-center gap-3 mb-4">
          <Pressable onPress={() => router.back()} className="active:opacity-60">
            <Text className="text-primary font-semibold">← Back</Text>
          </Pressable>
          <Text className="text-xl font-extrabold text-on-surface tracking-tight flex-1">
            Rejected / Overdue
          </Text>
        </View>
        <View className="flex-row gap-2">
          {(['rejected', 'overdue'] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              className={`flex-1 py-2.5 rounded-xl items-center ${tab === t ? 'kinetic-gradient' : 'bg-surface-container-highest'}`}
            >
              <Text className={`text-xs font-bold uppercase ${tab === t ? 'text-on-primary' : 'text-on-surface-variant'}`}>
                {t} ({tab === t ? items.length : '…'})
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingTop: 16, paddingHorizontal: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={currentQuery.isRefetching} onRefresh={currentQuery.refetch} />
        }
        renderItem={({ item: task }) => {
          const isOverdue = task.deadline && new Date(task.deadline) < new Date() && (task.status === 'todo' || task.status === 'in_progress');
          return (
            <Pressable
              onPress={() => router.push({ pathname: '/(ot)/tasks/[id]', params: { id: task.id } })}
              className="bg-surface-container-lowest rounded-xl p-5 mb-3 overflow-hidden active:opacity-70"
            >
              <View className={`absolute left-0 top-0 bottom-0 w-1 ${isOverdue ? 'bg-warning' : 'bg-error'}`} />
              <View className="flex-row items-start justify-between mb-3">
                <Text className="text-base font-bold text-on-surface flex-1 mr-3" numberOfLines={2}>{task.title}</Text>
                <StatusBadge status={task.status} />
              </View>
              <View className="flex-row flex-wrap gap-2 mb-2">
                {task.priority && <PriorityBadge priority={task.priority} />}
              </View>
              <View className="gap-1">
                {task.deadline && (
                  <Text className="text-xs text-on-surface-variant">
                    Deadline: {new Date(task.deadline).toLocaleString('vi-VN')}
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
        }}
        ListEmptyComponent={
          <View className="py-16 items-center">
            <Text className="text-on-surface-variant text-sm">No {tab} tasks</Text>
          </View>
        }
      />
    </View>
  );
}
