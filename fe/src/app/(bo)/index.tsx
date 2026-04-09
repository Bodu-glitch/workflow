import { useQuery } from '@tanstack/react-query';
import { RefreshControl, ScrollView as RNScrollView } from 'react-native';
import { router } from 'expo-router';
import { View, Text, Pressable, ScrollView } from '@/tw';
import { tasksApi } from '@/lib/api/tasks';
import { notificationsApi } from '@/lib/api/notifications';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorView } from '@/components/ui/ErrorView';
import { AppHeader } from '@/components/AppHeader';
import { useAuth } from '@/context/auth';
import type { TaskStatus } from '@/types/api';

const STAT_CARDS: {
  key: 'total' | 'in_progress' | 'done' | 'overdue';
  label: string;
  color: string;
  bgColor: string;
  trend?: string;
}[] = [
  { key: 'total',       label: 'Total Tasks',  color: '#1E40AF', bgColor: '#eff6ff', trend: '+12%' },
  { key: 'in_progress', label: 'In Progress',  color: '#f59e0b', bgColor: '#fffbeb', trend: '⚡ Stable' },
  { key: 'done',        label: 'Completed',    color: '#10b981', bgColor: '#f0fdf4', trend: '✓' },
  { key: 'overdue',     label: 'Overdue',      color: '#ef4444', bgColor: '#fff1f2', trend: '⚠' },
];

const BAR_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function emptyStats() {
  return { todo: 0, in_progress: 0, done: 0, cancelled: 0, rejected: 0, overdue: 0 };
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 18) return 'Good Afternoon';
  return 'Good Evening';
}

function DonutRing({ percentage, size = 90, strokeWidth = 11 }: { percentage: number; size?: number; strokeWidth?: number }) {
  const half = size / 2;
  const r1 = Math.min(percentage, 50) / 50;
  const r2 = Math.max(0, percentage - 50) / 50;

  // Angle in degrees for each segment
  const angle1 = r1 * 180 - 135; // right half rotation
  const angle2 = r2 * 180 - 135; // left half rotation

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Background ring */}
      <View
        style={{
          position: 'absolute',
          width: size, height: size,
          borderRadius: half,
          borderWidth: strokeWidth,
          borderColor: '#dce9ff',
        }}
      />

      {/* Right half fill */}
      <View style={{ position: 'absolute', width: half, height: size, left: half, overflow: 'hidden' }}>
        <View
          style={{
            position: 'absolute',
            left: -half, top: 0,
            width: size, height: size,
            borderRadius: half,
            borderWidth: strokeWidth,
            borderColor: '#1E40AF',
            borderLeftColor: 'transparent',
            borderBottomColor: r1 < 1 ? 'transparent' : '#1E40AF',
            transform: [{ rotate: `${angle1}deg` }],
          }}
        />
      </View>

      {/* Left half fill (only when > 50%) */}
      {percentage > 50 && (
        <View style={{ position: 'absolute', width: half, height: size, left: 0, overflow: 'hidden' }}>
          <View
            style={{
              position: 'absolute',
              left: 0, top: 0,
              width: size, height: size,
              borderRadius: half,
              borderWidth: strokeWidth,
              borderColor: '#1E40AF',
              borderRightColor: 'transparent',
              borderTopColor: r2 < 1 ? 'transparent' : '#1E40AF',
              transform: [{ rotate: `${angle2}deg` }],
            }}
          />
        </View>
      )}

      <Text style={{ fontSize: 15, fontWeight: '800', color: '#0d1c2e' }}>{percentage}%</Text>
    </View>
  );
}

export default function BODashboardScreen() {
  const { user } = useAuth();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => tasksApi.dashboard(),
  });

  const { data: unreadData } = useQuery({
    queryKey: ['unread-count'],
    queryFn: () => notificationsApi.unreadCount(),
  });

  const { data: recentTasksData } = useQuery({
    queryKey: ['recent-tasks'],
    queryFn: () => tasksApi.list({ page: 1, limit: 3 }),
  });

  if (isLoading) return <LoadingScreen />;
  if (isError) return <ErrorView onRetry={refetch} />;

  const stats = data?.data ?? emptyStats();
  const total = stats.todo + stats.in_progress + stats.done + stats.cancelled + stats.rejected + stats.overdue;
  const active = stats.todo + stats.in_progress;
  const activePercent = total > 0 ? Math.round((active / total) * 100) : 0;
  const unreadCount = unreadData?.data?.unread_count ?? 0;

  const currentTenant = user?.tenants?.find((t) => t.id === user.tenant_id) ?? user?.tenants?.[0];
  const tenantName = currentTenant?.name ?? 'My Workspace';

  const roleLabel =
    user?.role === 'business_owner' ? 'Business Owner'
    : user?.role === 'operator' ? 'Operator'
    : user?.full_name ?? 'User';

  // Proportional bar heights for weekly chart (current week's last day = today's stats)
  const maxStat = Math.max(stats.todo, stats.in_progress, stats.done, 1);
  const barHeights = [
    Math.round((stats.done / maxStat) * 48) + 8,
    Math.round((stats.in_progress / maxStat) * 48) + 8,
    Math.round((stats.todo / maxStat) * 48) + 8,
    Math.round((stats.done / maxStat) * 40) + 8,
    Math.round((stats.in_progress / maxStat) * 44) + 8,
    Math.round((stats.overdue / maxStat) * 32) + 8,
    Math.max(total, 8) > 0 ? 56 : 8,
  ];

  const statValues: Record<'total' | 'in_progress' | 'done' | 'overdue', number> = {
    total,
    in_progress: stats.in_progress,
    done: stats.done,
    overdue: stats.overdue,
  };

  const statusNavMap: Partial<Record<'total' | 'in_progress' | 'done' | 'overdue', TaskStatus>> = {
    in_progress: 'in_progress',
    done: 'done',
  };

  const recentTasks = recentTasksData?.data ?? [];

  return (
    <View collapsable={false} style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      <AppHeader tenantName={tenantName} unreadCount={unreadCount} />

      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {/* Greeting */}
        <View className="px-5 pt-5 pb-2">
          <Text className="text-sm text-on-surface-variant">{getGreeting()},</Text>
          <Text className="text-2xl font-extrabold text-on-surface">{roleLabel}</Text>
        </View>

        {/* Stat Cards — horizontal scroll */}
        <RNScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 12, gap: 12 }}
        >
          {STAT_CARDS.map(({ key, label, color, bgColor, trend }) => (
            <Pressable
              key={key}
              onPress={() => {
                const status = statusNavMap[key];
                if (status) router.push({ pathname: '/(bo)/tasks', params: { status } });
                else if (key === 'overdue') router.push('/(bo)/rejected-overdue');
                else router.push('/(bo)/tasks/');
              }}
              style={{ backgroundColor: bgColor, borderRadius: 16, padding: 16, width: 140, minHeight: 100 }}
            >
              <Text style={{ fontSize: 10, fontWeight: '700', color, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {label}
              </Text>
              <Text style={{ fontSize: 36, fontWeight: '900', color: '#0d1c2e', marginTop: 8 }}>
                {statValues[key]}
              </Text>
              {trend ? (
                <Text style={{ fontSize: 11, fontWeight: '600', color, marginTop: 4 }}>{trend}</Text>
              ) : null}
            </Pressable>
          ))}
        </RNScrollView>

        <View className="px-5 gap-4 pb-24">
          {/* Weekly Productivity */}
          <View className="bg-surface-container-lowest rounded-2xl p-4">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-base font-bold text-on-surface">Weekly Productivity</Text>
              <Text className="text-xs text-on-surface-variant">...</Text>
            </View>
            <View className="flex-row items-end justify-between" style={{ height: 72 }}>
              {BAR_DAYS.map((day, i) => {
                const isToday = i === 6;
                return (
                  <View key={i} className="items-center gap-1" style={{ flex: 1 }}>
                    <View
                      style={{
                        width: 24,
                        height: barHeights[i],
                        borderRadius: 6,
                        backgroundColor: isToday ? '#1E40AF' : '#dce9ff',
                      }}
                    />
                    <Text style={{ fontSize: 10, color: isToday ? '#1E40AF' : '#94a3b8', fontWeight: isToday ? '700' : '400' }}>
                      {day}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Task Distribution */}
          <View className="bg-surface-container-lowest rounded-2xl p-4">
            <Text className="text-base font-bold text-on-surface mb-4">Task Distribution</Text>
            <View className="flex-row items-center gap-5">
              <DonutRing percentage={activePercent} />
              <View className="gap-2 flex-1">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#1E40AF' }} />
                    <Text className="text-sm text-on-surface-variant">Active</Text>
                  </View>
                  <Text className="text-sm font-bold text-on-surface">{active}</Text>
                </View>
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#dce9ff' }} />
                    <Text className="text-sm text-on-surface-variant">Completed</Text>
                  </View>
                  <Text className="text-sm font-bold text-on-surface">{stats.done}</Text>
                </View>
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#fecaca' }} />
                    <Text className="text-sm text-on-surface-variant">Overdue</Text>
                  </View>
                  <Text className="text-sm font-bold text-on-surface">{stats.overdue}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Critical Activities */}
          <View className="bg-surface-container-lowest rounded-2xl p-4">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-base font-bold text-on-surface">Critical Activities</Text>
              <Pressable onPress={() => router.push('/(bo)/tasks/')} className="active:opacity-60">
                <Text className="text-xs font-bold text-primary uppercase tracking-wide">View All</Text>
              </Pressable>
            </View>
            {recentTasks.length === 0 ? (
              <Text className="text-sm text-on-surface-variant">No recent activities</Text>
            ) : (
              recentTasks.map((task: any) => {
                const priorityIcon =
                  task.priority === 'urgent' ? '🔴' :
                  task.priority === 'high' ? '🟠' :
                  task.priority === 'medium' ? '🟡' : '🟢';
                const timeAgo = (() => {
                  const diff = Date.now() - new Date(task.created_at).getTime();
                  const h = Math.floor(diff / 3600000);
                  if (h < 24) return `${h}h ago`;
                  return `${Math.floor(h / 24)}d ago`;
                })();
                return (
                  <Pressable
                    key={task.id}
                    onPress={() => router.push({ pathname: '/(bo)/tasks/[id]', params: { id: task.id } })}
                    className="flex-row items-center gap-3 py-2.5 border-b border-surface-container active:opacity-70"
                  >
                    <View
                      className="w-8 h-8 rounded-xl items-center justify-center"
                      style={{ backgroundColor: '#eff6ff' }}
                    >
                      <Text style={{ fontSize: 14 }}>{priorityIcon}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-on-surface" numberOfLines={1}>
                        {task.title}
                      </Text>
                      <Text className="text-xs text-on-surface-variant" numberOfLines={1}>
                        {task.status.replace('_', ' ')} · {task.priority ?? 'normal'} priority
                      </Text>
                    </View>
                    <Text className="text-xs text-on-surface-variant">{timeAgo}</Text>
                  </Pressable>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>

      {/* Sticky Quick Create Task */}
      <View
        className="absolute bottom-0 left-0 right-0 px-5 pb-6 pt-2"
        style={{ backgroundColor: 'rgba(248,249,255,0.95)' }}
      >
        <Pressable
          onPress={() => router.push('/(bo)/tasks/create')}
          className="h-14 rounded-2xl flex-row items-center justify-center gap-2 active:opacity-80"
          style={{ backgroundColor: '#1E40AF' }}
        >
          <Text className="text-on-primary text-xl font-bold">+</Text>
          <Text className="text-on-primary font-bold text-base">Quick Create Task</Text>
        </Pressable>
      </View>
    </View>
  );
}
