import { useQuery } from '@tanstack/react-query';
import { RefreshControl, ScrollView as RNScrollView } from 'react-native';
import { router } from 'expo-router';
import { Svg, Path, Text as SvgText } from 'react-native-svg';
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


function PieChart({ slices, size = 140 }: {
  slices: { value: number; color: string; label: string }[];
  size?: number;
}) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 4;
  const total = slices.reduce((s, sl) => s + sl.value, 0);
  if (total === 0) {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: size - 8, height: size - 8, borderRadius: (size - 8) / 2, backgroundColor: '#dce9ff' }} />
      </View>
    );
  }
  const toRad = (deg: number) => (deg - 90) * (Math.PI / 180);
  let paths: React.ReactNode[] = [];
  let startAngle = 0;
  slices.forEach((sl, i) => {
    if (sl.value === 0) return;
    const angle = (sl.value / total) * 360;
    const endAngle = startAngle + angle;
    const x1 = cx + r * Math.cos(toRad(startAngle));
    const y1 = cy + r * Math.sin(toRad(startAngle));
    const midAngle = startAngle + angle / 2;
    const labelR = r * 0.65;
    const lx = cx + labelR * Math.cos(toRad(midAngle));
    const ly = cy + labelR * Math.sin(toRad(midAngle));
    const pct = Math.round((sl.value / total) * 100);
    let d: string;
    if (angle > 359.99) {
      // Full circle: two 180° arcs to avoid degenerate SVG arc (start === end point)
      const xMid = cx + r * Math.cos(toRad(startAngle + 180));
      const yMid = cy + r * Math.sin(toRad(startAngle + 180));
      d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 1 1 ${xMid} ${yMid} A ${r} ${r} 0 1 1 ${x1} ${y1} Z`;
      paths.push(
        <Path key={i} d={d} fill={sl.color} />,
        <SvgText key={`t${i}`} x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="11" fontWeight="800">100%</SvgText>,
      );
    } else {
      const large = angle > 180 ? 1 : 0;
      const x2 = cx + r * Math.cos(toRad(endAngle));
      const y2 = cy + r * Math.sin(toRad(endAngle));
      d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
      paths.push(
        <Path key={i} d={d} fill={sl.color} />,
        pct >= 8 ? <SvgText key={`t${i}`} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="11" fontWeight="800">{pct}%</SvgText> : null,
      );
    }
    startAngle = endAngle;
  });
  return <Svg width={size} height={size}>{paths}</Svg>;
}

function emptyStats() {
  return { todo: 0, in_progress: 0, done: 0, cancelled: 0, rejected: 0, overdue: 0 };
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 18) return 'Good Afternoon';
  return 'Good Evening';
}


export default function OTDashboardScreen() {
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

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
  const { data: todayData } = useQuery({
    queryKey: ['dashboard-today'],
    queryFn: () => tasksApi.dashboard(todayStart.toISOString(), todayEnd.toISOString()),
  });

  if (isLoading) return <LoadingScreen />;
  if (isError) return <ErrorView onRetry={refetch} />;

  const stats = data?.data?.summary ?? emptyStats();
  const todayStats = todayData?.data?.summary ?? emptyStats();
  const total = stats.todo + stats.in_progress + stats.done + stats.cancelled + stats.rejected + stats.overdue;
  const unreadCount = unreadData?.data?.unread_count ?? 0;

  const currentTenant = user?.tenants?.find((t) => t.id === user.tenant_id) ?? user?.tenants?.[0];
  const tenantName = currentTenant?.name ?? 'My Workspace';

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
          <Text className="text-2xl font-extrabold text-on-surface">Operator</Text>
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
                if (status) router.push({ pathname: '/(ot)/tasks', params: { status } });
                else if (key === 'overdue') router.push('/(ot)/rejected-overdue');
                else router.push('/(ot)/tasks/');
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
          {/* Today Task */}
          <View className="bg-surface-container-lowest rounded-2xl p-4">
            <Text className="text-base font-bold text-on-surface mb-4">Today Task</Text>
            {(() => {
              const todayTotal = todayStats.todo + todayStats.in_progress + todayStats.done + todayStats.overdue;
              const pct = (n: number) => todayTotal > 0 ? Math.round((n / todayTotal) * 100) : 0;
              const rows = [
                { label: 'Active',      value: todayStats.todo,        color: '#1E40AF' },
                { label: 'Progressing', value: todayStats.in_progress, color: '#f59e0b' },
                { label: 'Completed',   value: todayStats.done,        color: '#10b981' },
                { label: 'Overdue',     value: todayStats.overdue,     color: '#ef4444' },
              ] as const;
              return (
                <View className="flex-row items-center gap-5">
                  <PieChart slices={[...rows]} size={140} />
                  <View className="gap-2.5 flex-1">
                    {rows.map(({ label, value, color }) => (
                      <View key={label} className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-2">
                          <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                          <Text className="text-sm text-on-surface-variant">{label}</Text>
                        </View>
                        <View className="flex-row items-center gap-2">
                          <Text className="text-xs text-on-surface-variant">{value}</Text>
                          <Text className="text-sm font-bold" style={{ color }}>{pct(value)}%</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })()}
          </View>

          {/* Critical Activities */}
          <View className="bg-surface-container-lowest rounded-2xl p-4">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-base font-bold text-on-surface">Critical Activities</Text>
              <Pressable onPress={() => router.push('/(ot)/tasks/')} className="active:opacity-60">
                <Text className="text-xs font-bold text-primary uppercase tracking-wide">View All</Text>
              </Pressable>
            </View>
            {recentTasks.length === 0 ? (
              <Text className="text-sm text-on-surface-variant">No recent activities</Text>
            ) : (
              recentTasks.map((task) => {
                const priorityIcon =
                  task.priority === 'urgent' ? '🔴' :
                  task.priority === 'high' ? '🟠' :
                  task.priority === 'medium' ? '🟡' : '🟢';
                const diff = Date.now() - new Date(task.created_at).getTime();
                const h = Math.floor(diff / 3600000);
                const timeAgo = h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
                return (
                  <Pressable
                    key={task.id}
                    onPress={() => router.push({ pathname: '/(ot)/tasks/[id]', params: { id: task.id } })}
                    className="flex-row items-center gap-3 py-2.5 border-b border-surface-container active:opacity-70"
                  >
                    <View className="w-8 h-8 rounded-xl items-center justify-center" style={{ backgroundColor: '#eff6ff' }}>
                      <Text style={{ fontSize: 14 }}>{priorityIcon}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-on-surface" numberOfLines={1}>{task.title}</Text>
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
          onPress={() => router.push('/(ot)/tasks/create')}
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
