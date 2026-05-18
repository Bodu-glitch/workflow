import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FlatList, RefreshControl } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { View, Text, Pressable, TextInput } from '@/tw';
import { tasksApi } from '@/lib/api/tasks';
import { StatusBadge, PriorityBadge, PRIORITY_PILL_COLOR } from '@/components/ui/StatusBadge';
import { ErrorView } from '@/components/ui/ErrorView';
import { FilterDropdown } from '@/components/tasks/FilterDropdown';
import type { Task, TaskStatus, TaskPriority } from '@/types/api';

const STATUS_OPTIONS = [
  { label: 'All', value: undefined },
  { label: 'Pending', value: 'todo' as TaskStatus },
  { label: 'In Progress', value: 'in_progress' as TaskStatus },
  { label: 'Done', value: 'done' as TaskStatus },
  { label: 'Cancelled', value: 'cancelled' as TaskStatus },
  { label: 'Rejected', value: 'rejected' as TaskStatus },
];

const PRIORITY_OPTIONS = [
  { label: 'All', value: undefined },
  { label: 'Low', value: 'low' as TaskPriority },
  { label: 'Medium', value: 'medium' as TaskPriority },
  { label: 'High', value: 'high' as TaskPriority },
  { label: 'Urgent', value: 'urgent' as TaskPriority },
];

function TaskCard({ task, onPress }: { task: Task; onPress: () => void }) {
  const pillColor = task.priority ? PRIORITY_PILL_COLOR[task.priority] : 'bg-outline';
  return (
    <Pressable
      onPress={onPress}
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
        {task.area && (
          <Text className="text-xs text-on-surface-variant" numberOfLines={1}>🗺 {task.area}</Text>
        )}
        {task.service_type && (
          <Text className="text-xs text-on-surface-variant" numberOfLines={1}>🔧 {task.service_type}</Text>
        )}
        {task.scheduled_at && (
          <Text className="text-xs text-on-surface-variant">
            🕐 {new Date(task.scheduled_at).toLocaleDateString('en-US', {
              day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
            })}
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

export default function TaskManagerScreen() {
  const params = useLocalSearchParams<{ status?: TaskStatus }>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>(params.status);
  const [priorityFilter, setPriorityFilter] = useState<string | undefined>();
  const [areaFilter, setAreaFilter] = useState<string | undefined>();
  const [serviceFilter, setServiceFilter] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: filterOptionsData } = useQuery({
    queryKey: ['task-filter-options'],
    queryFn: () => tasksApi.filterOptions(),
    select: (d) => d.data,
  });

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['tasks', statusFilter, priorityFilter, areaFilter, serviceFilter, debouncedSearch, page],
    queryFn: () => tasksApi.list({
      status: statusFilter as TaskStatus | undefined,
      priority: priorityFilter as any,
      area: areaFilter,
      service_type: serviceFilter,
      search: debouncedSearch || undefined,
      page,
      limit: 20,
    }),
  });

  const tasks = data?.data ?? [];
  const meta = data?.meta;

  const areaOptions = [
    { label: 'All', value: undefined },
    ...(filterOptionsData?.areas ?? []).map((a) => ({ label: a, value: a })),
  ];
  const serviceOptions = [
    { label: 'All', value: undefined },
    ...(filterOptionsData?.service_types ?? []).map((s) => ({ label: s, value: s })),
  ];

  function resetPage() { setPage(1); }

  return (
    <View className="flex-1 bg-surface-container-low">
      <View className="glass-effect px-5 pt-14 pb-4">
        <Text className="text-xl font-extrabold text-on-surface tracking-tight mb-4">Tasks</Text>
        <View className="flex-row items-center bg-surface-container-high rounded-xl px-4 h-11 gap-2 mb-3">
          <Text className="text-on-surface-variant">🔍</Text>
          <TextInput
            className="flex-1 text-sm text-on-surface"
            placeholder="Search tasks..."
            placeholderTextColor="#737685"
            value={search}
            onChangeText={setSearch}
            style={{ outlineStyle: "none" } as any}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} className="active:opacity-60 pl-1">
              <Text className="text-on-surface-variant">✕</Text>
            </Pressable>
          )}
        </View>
        <View className="flex-row gap-2 mb-2">
          <FilterDropdown
            label="Status"
            value={statusFilter}
            options={STATUS_OPTIONS}
            onChange={(v) => { setStatusFilter(v); resetPage(); }}
          />
          <FilterDropdown
            label="Priority"
            value={priorityFilter}
            options={PRIORITY_OPTIONS}
            onChange={(v) => { setPriorityFilter(v); resetPage(); }}
          />
        </View>
        <View className="flex-row gap-2">
          <FilterDropdown
            label="Area"
            value={areaFilter}
            options={areaOptions}
            onChange={(v) => { setAreaFilter(v); resetPage(); }}
          />
          <FilterDropdown
            label="Service"
            value={serviceFilter}
            options={serviceOptions}
            onChange={(v) => { setServiceFilter(v); resetPage(); }}
          />
        </View>
      </View>

      {isError ? (
        <ErrorView onRetry={refetch} />
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TaskCard
              task={item}
              onPress={() => router.push({ pathname: '/(bo)/tasks/[id]', params: { id: item.id } })}
            />
          )}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => { setPage(1); refetch(); }} />
          }
          ListEmptyComponent={
            isLoading ? null : (
              <View className="flex-1 items-center justify-center py-20">
                <Text className="text-on-surface-variant text-sm">No tasks found</Text>
              </View>
            )
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

      <Pressable
        onPress={() => router.push('/(bo)/tasks/create')}
        className="absolute bottom-6 right-5 w-14 h-14 rounded-full items-center justify-center shadow-lg active:opacity-80"
        style={{ backgroundColor: '#1E40AF' }}
      >
        <Text className="text-white text-3xl font-light" style={{ lineHeight: 36 }}>+</Text>
      </Pressable>
    </View>
  );
}