import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FlatList, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { View, Text, Pressable } from '@/tw';
import { meApi } from '@/lib/api/me';
import { StatusBadge, PriorityBadge } from '@/components/ui/StatusBadge';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorView } from '@/components/ui/ErrorView';
import { useAuth } from '@/context/auth';
import { NotifBell } from '@/components/NotifBell';
import { ChatBell } from '@/components/ChatBell';
import type { Task } from '@/types/api';

type TabKey = 'pool' | 'todo' | 'active' | 'done' | 'cancelled';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'pool',      label: '🏊 Pool' },
  { key: 'todo',      label: 'Mới' },
  { key: 'active',    label: '🔧 Đang thực hiện' },
  { key: 'done',      label: 'Hoàn thành' },
  { key: 'cancelled', label: 'Đã hủy' },
];

// ── Task card (my assigned tasks) ─────────────────────────────────────────────
function TaskCard({ task }: { task: Task }) {
  const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'done';

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/(staff)/tasks/[id]', params: { id: task.id } })}
      className="bg-surface-container-lowest rounded-xl p-5 mb-3 mx-4 overflow-hidden active:opacity-70"
    >
      <View className={`absolute left-0 top-0 bottom-0 w-1 ${isOverdue ? 'bg-warning' : 'bg-primary'}`} />
      <View className="flex-row items-start justify-between mb-2">
        <Text className="text-base font-bold text-on-surface flex-1 mr-3" numberOfLines={2}>
          {task.title}
        </Text>
        <StatusBadge status={task.status} />
      </View>

      <View className="flex-row flex-wrap gap-2 mb-2">
        {task.priority && <PriorityBadge priority={task.priority} />}
        {isOverdue && (
          <View className="self-start px-2.5 py-1 rounded-full bg-warning-container">
            <Text className="text-[10px] font-bold text-on-warning-container">⚠ QUÁ HẠN</Text>
          </View>
        )}
      </View>

      <View className="gap-1">
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

// ── Pool task card ─────────────────────────────────────────────────────────────
function PoolTaskCard({ task, onClaimed }: { task: Task; onClaimed: () => void }) {
  const [loading, setLoading] = useState(false);

  const handleClaim = useCallback(async () => {
    setLoading(true);
    try {
      await meApi.claimPoolTask(task.id);
      onClaimed();
      router.push({ pathname: '/(staff)/tasks/[id]', params: { id: task.id } });
    } catch (err: any) {
      const code = err?.code ?? '';
      Alert.alert(
        'Không thể nhận',
        code === 'TIME_CONFLICT'
          ? 'Thời gian nhiệm vụ này trùng với nhiệm vụ bạn đang có.'
          : code === 'ALREADY_CLAIMED'
          ? 'Nhiệm vụ đã được người khác nhận rồi.'
          : 'Vui lòng thử lại.',
      );
      onClaimed(); // refresh list
    } finally {
      setLoading(false);
    }
  }, [task.id, onClaimed]);

  return (
    <View className="bg-surface-container-lowest rounded-xl p-5 mb-3 mx-4 overflow-hidden">
      <View className="absolute left-0 top-0 bottom-0 w-1 bg-tertiary" />
      <View className="flex-row items-start justify-between mb-2">
        <Text className="text-base font-bold text-on-surface flex-1 mr-3" numberOfLines={2}>
          {task.title}
        </Text>
        {task.priority && <PriorityBadge priority={task.priority} />}
      </View>

      <View className="gap-1 mb-4">
        {task.location_name && (
          <Text className="text-xs text-on-surface-variant" numberOfLines={1}>📍 {task.location_name}</Text>
        )}
        {task.scheduled_at && (
          <Text className="text-xs text-on-surface-variant">
            🕐 {new Date(task.scheduled_at).toLocaleString('vi-VN')}
          </Text>
        )}
        {task.deadline && (
          <Text className="text-xs text-on-surface-variant">
            ⏰ {new Date(task.deadline).toLocaleString('vi-VN')}
          </Text>
        )}
      </View>

      <Pressable
        onPress={handleClaim}
        disabled={loading}
        className="py-2.5 rounded-xl bg-primary items-center active:opacity-80"
      >
        {loading
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text className="text-sm font-bold text-white">Nhận nhiệm vụ</Text>
        }
      </Pressable>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function MyTaskListScreen() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>('todo');

  const isPool = activeTab === 'pool';
  const status = isPool ? undefined : activeTab as string;

  const myTasksQuery = useQuery({
    queryKey: ['me-tasks', status],
    queryFn: () => meApi.tasks(status),
    enabled: !isPool,
  });

  const poolQuery = useQuery({
    queryKey: ['pool-tasks'],
    queryFn: () => meApi.poolTasks(),
    enabled: isPool,
    refetchInterval: 10_000,
  });

  const activeQuery = isPool ? poolQuery : myTasksQuery;
  const tasks = activeQuery.data?.data ?? [];

  useFocusEffect(useCallback(() => {
    if (isPool) qc.invalidateQueries({ queryKey: ['pool-tasks'] });
    else qc.invalidateQueries({ queryKey: ['me-tasks', status] });
  }, [isPool, status, qc]));

  const handlePoolClaimed = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['pool-tasks'] });
  }, [qc]);

  return (
    <View className="flex-1 bg-surface-container-low">
      {/* Header */}
      <View className="glass-effect px-5 pt-14 pb-3">
        <View className="flex-row items-center justify-between mb-4">
          <Pressable
            onPress={() => router.push('/profile')}
            className="flex-row items-center gap-3 active:opacity-70"
          >
            <View className="w-10 h-10 rounded-full bg-primary items-center justify-center">
              <Text className="text-white font-bold text-sm">
                {user?.full_name
                  ? user.full_name.trim().split(/\s+/).slice(-2).map((w: string) => w[0].toUpperCase()).join('')
                  : 'S'}
              </Text>
            </View>
            <View>
              <Text className="text-[10px] font-bold uppercase tracking-widest text-primary" style={{ opacity: 0.7 }}>Nhiệm vụ</Text>
              <Text className="text-xl font-extrabold text-on-surface tracking-tight">
                {user?.full_name ?? 'Staff'}
              </Text>
            </View>
          </Pressable>
          <View className="flex-row items-center gap-1">
            <ChatBell />
            <NotifBell />
          </View>
        </View>

        {/* Tabs */}
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={TABS}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setActiveTab(item.key)}
              className={`px-4 py-2 rounded-full mr-2 ${activeTab === item.key ? 'kinetic-gradient' : 'bg-surface-container-highest'}`}
            >
              <Text className={`text-xs font-bold ${activeTab === item.key ? 'text-on-primary' : 'text-on-surface-variant'}`}>
                {item.label}
              </Text>
            </Pressable>
          )}
        />
      </View>

      {/* Content */}
      {activeQuery.isLoading
        ? <LoadingScreen />
        : activeQuery.isError
        ? <ErrorView onRetry={activeQuery.refetch} />
        : (
          <FlatList
            data={tasks}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) =>
              isPool
                ? <PoolTaskCard task={item} onClaimed={handlePoolClaimed} />
                : <TaskCard task={item} />
            }
            contentContainerStyle={{ paddingTop: 16, paddingBottom: 32 }}
            refreshControl={
              <RefreshControl
                refreshing={activeQuery.isRefetching}
                onRefresh={activeQuery.refetch}
              />
            }
            ListEmptyComponent={
              <View className="py-20 items-center gap-2">
                <Text className="text-4xl">{isPool ? '🏊' : '✅'}</Text>
                <Text className="text-on-surface-variant text-sm">
                  {isPool ? 'Không có nhiệm vụ trong pool' : 'Không có nhiệm vụ nào'}
                </Text>
                <Text className="text-outline text-xs">Kéo xuống để làm mới</Text>
              </View>
            }
          />
        )
      }
    </View>
  );
}
