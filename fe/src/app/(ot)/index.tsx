import { useQuery } from '@tanstack/react-query';
import { RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { View, Text, Pressable, ScrollView } from '@/tw';
import { tasksApi } from '@/lib/api/tasks';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorView } from '@/components/ui/ErrorView';
import { useAuth } from '@/context/auth';
import type { TaskStatus } from '@/types/api';

type StatKey = 'todo' | 'in_progress' | 'done' | 'cancelled' | 'rejected' | 'overdue';

function emptyStats() {
  return { todo: 0, in_progress: 0, done: 0, cancelled: 0, rejected: 0, overdue: 0 };
}

const STAT_CARDS: { key: StatKey; label: string; pillColor: string; status?: TaskStatus }[] = [
  { key: 'todo',        label: 'Pending',     pillColor: '#f59e0b', status: 'todo' },
  { key: 'in_progress', label: 'In Progress', pillColor: '#003d9b', status: 'in_progress' },
  { key: 'done',        label: 'Done',        pillColor: '#10b981', status: 'done' },
  { key: 'rejected',    label: 'Rejected',    pillColor: '#ba1a1a', status: 'rejected' },
  { key: 'overdue',     label: 'Overdue',     pillColor: '#f97316' },
  { key: 'cancelled',   label: 'Cancelled',   pillColor: '#94a3b8', status: 'cancelled' },
];

const QUICK_ACTIONS = [
  { label: 'Create Task', icon: '+',  onPress: () => router.push('/(ot)/tasks/create'), primary: true },
  { label: 'All Tasks',   icon: '≡',  onPress: () => router.push('/(ot)/tasks/') },
  { label: 'Assign',      icon: '📋', onPress: () => router.push('/(ot)/assignment') },
  { label: 'Employees',   icon: '👥', onPress: () => router.push('/(ot)/employees') },
  { label: 'Overdue',     icon: '⚠', onPress: () => router.push('/(ot)/rejected-overdue') },
];

export default function OTTeamDashboardScreen() {
  const { user, logout } = useAuth();
  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => tasksApi.dashboard(),
  });

  if (isLoading) return <LoadingScreen />;
  if (isError) return <ErrorView onRetry={refetch} />;

  const stats = data?.data ?? emptyStats();

  return (
    <ScrollView
      className="flex-1 bg-surface"
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
    >
      {/* Glass Header */}
      <View className="glass-effect px-5 pt-14 pb-4 flex-row items-center justify-between">
        <View>
          <Text className="text-[10px] font-bold uppercase tracking-widest text-primary" style={{ opacity: 0.7 }}>
            Welcome Back
          </Text>
          <Text className="text-lg font-extrabold text-on-surface tracking-tight">
            {user?.full_name ?? 'Operator'}
          </Text>
        </View>
        <Pressable onPress={logout} className="w-10 h-10 items-center justify-center rounded-xl active:opacity-60">
          <Text className="text-on-surface-variant text-lg">⎋</Text>
        </Pressable>
      </View>

      <View className="px-5 pt-8 gap-8 pb-10">
        {/* Stats Section */}
        <View>
          <View className="flex-row items-end justify-between mb-5">
            <View>
              <Text className="text-2xl font-extrabold text-on-surface tracking-tight">Task Overview</Text>
              <Text className="text-sm text-on-surface-variant mt-0.5">Team activity summary</Text>
            </View>
            <View className="px-3 py-1 rounded-full bg-surface-container-high">
              <Text className="text-xs font-bold text-primary uppercase tracking-widest">Today</Text>
            </View>
          </View>

          <View className="flex-row flex-wrap gap-4">
            {STAT_CARDS.map(({ key, label, pillColor, status }) => (
              <Pressable
                key={key}
                onPress={() => status ? router.push({ pathname: '/(ot)/tasks', params: { status } }) : undefined}
                className="bg-surface-container-lowest rounded-xl p-5 active:opacity-75 overflow-hidden"
                style={{ width: '47%', minHeight: 120 }}
              >
                <View className="absolute left-0 top-0 bottom-0" style={{ width: 4, backgroundColor: pillColor }} />
                <View className="flex-1 justify-between">
                  <Text className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-3">{label}</Text>
                  <Text className="text-4xl font-extrabold text-on-surface">{stats[key]}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Quick Actions */}
        <View>
          <Text className="text-lg font-bold text-on-surface mb-4">Quick Actions</Text>
          <View className="flex-row flex-wrap gap-3">
            {QUICK_ACTIONS.map(({ label, icon, onPress, primary }) => (
              <Pressable
                key={label}
                onPress={onPress}
                className="items-center gap-2 active:opacity-80"
                style={{ width: '18%' }}
              >
                <View className={`w-14 h-14 rounded-2xl items-center justify-center ${primary ? 'kinetic-gradient' : 'bg-surface-container-high'}`}>
                  <Text className={`text-xl ${primary ? 'text-on-primary' : 'text-primary'}`}>{icon}</Text>
                </View>
                <Text className="text-[10px] font-bold uppercase tracking-tight text-on-surface text-center">{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
