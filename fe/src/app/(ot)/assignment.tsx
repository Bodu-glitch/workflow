import { useState } from 'react';
import { Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FlatList } from 'react-native';
import { View, Text, Pressable } from '@/tw';
import { tasksApi } from '@/lib/api/tasks';
import { staffApi } from '@/lib/api/staff';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorView } from '@/components/ui/ErrorView';
import { ApiError } from '@/lib/api/client';
import type { Task } from '@/types/api';

export default function TaskAssignmentScreen() {
  const qc = useQueryClient();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const tasksQuery = useQuery({
    queryKey: ['tasks', 'todo'],
    queryFn: () => tasksApi.list({ status: 'todo', limit: 50 }),
    select: (d) => d.data,
  });

  const staffQuery = useQuery({
    queryKey: ['staff'],
    queryFn: () => staffApi.list(),
    select: (d) => d.data,
  });

  const assignMutation = useMutation({
    mutationFn: ({ taskId, staffId }: { taskId: string; staffId: string }) =>
      tasksApi.assign(taskId, [staffId]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      setSelectedTask(null);
    },
    onError: (e) => Alert.alert('Error', e instanceof ApiError ? e.message : 'Failed to assign'),
  });

  if (tasksQuery.isLoading || staffQuery.isLoading) return <LoadingScreen />;
  if (tasksQuery.isError || staffQuery.isError)
    return (
      <ErrorView
        onRetry={() => {
          tasksQuery.refetch();
          staffQuery.refetch();
        }}
      />
    );

  const tasks = tasksQuery.data ?? [];
  const staffList = staffQuery.data ?? [];

  return (
    <View className="flex-1 bg-surface-container-low">
      {/* Glass Header */}
      <View className="glass-effect px-5 pt-14 pb-4">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} className="active:opacity-60">
            <Text className="text-primary font-semibold">← Back</Text>
          </Pressable>
          <Text className="text-xl font-extrabold text-on-surface tracking-tight flex-1">Task Assignment</Text>
        </View>
      </View>

      {selectedTask ? (
        /* Staff picker for selected task */
        <View className="flex-1">
          <View className="px-4 py-4 bg-secondary-container">
            <Text className="text-[10px] font-bold uppercase tracking-wider text-on-secondary-container mb-1">
              Assigning task
            </Text>
            <Text className="text-base font-bold text-on-surface">{selectedTask.title}</Text>
            <Text className="text-xs text-on-surface-variant mt-0.5">
              Assigned: {(selectedTask.assignees ?? []).map((a) => a.full_name).join(', ') || 'None'}
            </Text>
          </View>

          <FlatList
            data={staffList}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16 }}
            refreshControl={
              <RefreshControl refreshing={staffQuery.isRefetching} onRefresh={staffQuery.refetch} />
            }
            ListHeaderComponent={
              <Pressable
                onPress={() => setSelectedTask(null)}
                className="mb-4 py-2.5 items-center rounded-xl bg-surface-container-high active:opacity-60"
              >
                <Text className="text-sm text-on-surface-variant font-semibold">← Back to tasks</Text>
              </Pressable>
            }
            renderItem={({ item: s }) => {
              const alreadyAssigned = (selectedTask.assignees ?? []).some((a) => a.id === s.id);
              return (
                <Pressable
                  onPress={() => {
                    if (alreadyAssigned) return;
                    assignMutation.mutate({ taskId: selectedTask.id, staffId: s.id });
                  }}
                  disabled={alreadyAssigned || assignMutation.isPending}
                  className={`flex-row items-center px-4 py-3.5 rounded-xl mb-3 ${
                    alreadyAssigned ? 'bg-success-container opacity-70' : 'bg-surface-container-lowest active:opacity-70'
                  }`}
                >
                  <View className="w-9 h-9 rounded-full bg-surface-container-high items-center justify-center mr-3">
                    <Text className="text-xs font-bold text-primary">{s.full_name.charAt(0)}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-on-surface">{s.full_name}</Text>
                    <Text className="text-xs text-on-surface-variant">{s.email}</Text>
                  </View>
                  {alreadyAssigned ? (
                    <Text className="text-xs text-on-success-container font-bold">Assigned ✓</Text>
                  ) : assignMutation.isPending ? (
                    <ActivityIndicator size="small" color="#003d9b" />
                  ) : (
                    <Text className="text-sm text-primary font-bold">Assign</Text>
                  )}
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <View className="py-12 items-center">
                <Text className="text-on-surface-variant text-sm">No staff available</Text>
              </View>
            }
          />
        </View>
      ) : (
        /* Task list */
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl refreshing={tasksQuery.isRefetching} onRefresh={tasksQuery.refetch} />
          }
          renderItem={({ item: task }) => (
            <Pressable
              onPress={() => setSelectedTask(task)}
              className="bg-surface-container-lowest rounded-xl p-4 mb-3 active:opacity-70"
            >
              <View className="flex-row items-start justify-between mb-2">
                <Text className="text-base font-bold text-on-surface flex-1 mr-3" numberOfLines={1}>
                  {task.title}
                </Text>
                <StatusBadge status={task.status} />
              </View>
              <Text className={`text-xs ${(task.assignees?.length ?? 0) === 0 ? 'text-warning' : 'text-on-surface-variant'}`}>
                {(task.assignees?.length ?? 0) === 0
                  ? '⚠ Unassigned'
                  : `👥 ${task.assignees!.map((a) => a.full_name).join(', ')}`}
              </Text>
              {task.scheduled_at && (
                <Text className="text-xs text-on-surface-variant mt-0.5">
                  🕐 {new Date(task.scheduled_at).toLocaleString('vi-VN')}
                </Text>
              )}
            </Pressable>
          )}
          ListEmptyComponent={
            <View className="py-16 items-center">
              <Text className="text-on-surface-variant text-sm">No pending tasks to assign</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
