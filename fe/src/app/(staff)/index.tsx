import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FlatList, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { View, Text, Pressable } from '@/tw';
import { meApi } from '@/lib/api/me';
import { StatusBadge, PriorityBadge } from '@/components/ui/StatusBadge';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorView } from '@/components/ui/ErrorView';
import { useAuth } from '@/context/auth';
import type { Task, TaskStatus } from '@/types/api';

const TABS: { label: string; status?: TaskStatus }[] = [
  { label: 'Active', status: undefined },
  { label: 'Pending', status: 'todo' },
  { label: 'In Progress', status: 'in_progress' },
];

function TaskCard({ task }: { task: Task }) {
  const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'done';

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/(staff)/tasks/[id]', params: { id: task.id } })}
      className="bg-surface-container-lowest rounded-xl p-5 mb-3 mx-4 overflow-hidden active:opacity-70"
    >
      <View className={`absolute left-0 top-0 bottom-0 w-1 ${isOverdue ? 'bg-warning' : 'bg-primary'}`} />
      <View className="flex-row items-start justify-between mb-3">
        <Text className="text-base font-bold text-on-surface flex-1 mr-3" numberOfLines={2}>
          {task.title}
        </Text>
        <StatusBadge status={task.status} />
      </View>

      <View className="flex-row flex-wrap gap-2 mb-2">
        {task.priority && <PriorityBadge priority={task.priority} />}
        {isOverdue && (
          <View className="self-start px-2.5 py-1 rounded-full bg-warning-container">
            <Text className="text-[10px] font-bold text-on-warning-container">⚠ OVERDUE</Text>
          </View>
        )}
      </View>

      <View className="gap-1.5">
        {task.location_name && (
          <Text className="text-xs text-on-surface-variant" numberOfLines={1}>📍 {task.location_name}</Text>
        )}
        {task.scheduled_at && (
          <Text className="text-xs text-on-surface-variant">
            🕐 {new Date(task.scheduled_at).toLocaleString('vi-VN')}
          </Text>
        )}
        {task.deadline && (
          <Text className={`text-xs ${isOverdue ? 'text-warning' : 'text-on-surface-variant'}`}>
            ⏰ {new Date(task.deadline).toLocaleString('vi-VN')}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export default function MyTaskListScreen() {
  const { user, logout } = useAuth();
  const [statusFilter, setStatusFilter] = useState<TaskStatus | undefined>();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['me-tasks', statusFilter],
    queryFn: () => meApi.tasks(statusFilter),
  });

  const tasks = data?.data ?? [];

  if (isLoading) return <LoadingScreen />;
  if (isError) return <ErrorView onRetry={refetch} />;

  return (
    <View className="flex-1 bg-surface-container-low">
      {/* Glass Header */}
      <View className="glass-effect px-5 pt-14 pb-3">
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-[10px] font-bold uppercase tracking-widest text-primary" style={{ opacity: 0.7 }}>My Tasks</Text>
            <Text className="text-xl font-extrabold text-on-surface tracking-tight">
              {user?.full_name ?? 'Staff'}
            </Text>
          </View>
          <View className="flex-row gap-3 items-center">
            <Pressable onPress={() => router.push('/notifications')} className="active:opacity-60">
              <Text className="text-2xl">🔔</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/(staff)/history')} className="active:opacity-60">
              <View className="px-3 py-1.5 rounded-full bg-surface-container-high">
                <Text className="text-xs font-bold text-primary">History</Text>
              </View>
            </Pressable>
            <Pressable onPress={logout} className="w-9 h-9 items-center justify-center rounded-xl active:opacity-60">
              <Text className="text-on-surface-variant text-lg">⎋</Text>
            </Pressable>
          </View>
        </View>

        {/* Filter tabs */}
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={TABS}
          keyExtractor={(item) => item.label}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setStatusFilter(item.status)}
              className={`px-5 py-2 rounded-full mr-2 ${statusFilter === item.status ? 'kinetic-gradient' : 'bg-surface-container-highest'}`}
            >
              <Text className={`text-xs font-bold ${statusFilter === item.status ? 'text-on-primary' : 'text-on-surface-variant'}`}>
                {item.label}
              </Text>
            </Pressable>
          )}
        />
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <TaskCard task={item} />}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        ListEmptyComponent={
          <View className="py-20 items-center">
            <Text className="text-on-surface-variant text-sm">No tasks assigned to you</Text>
            <Text className="text-outline text-xs mt-1">Pull to refresh</Text>
          </View>
        }
      />
    </View>
  );
}
