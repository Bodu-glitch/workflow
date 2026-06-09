import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshControl, ScrollView as RNScrollView, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Svg, Path, Text as SvgText } from 'react-native-svg';
import { View, Text, Pressable, ScrollView } from '@/tw';
import { tasksApi } from '@/lib/api/tasks';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorView } from '@/components/ui/ErrorView';
import { AppHeader } from '@/components/AppHeader';
import { TaskBarChart } from '@/components/ui/TaskBarChart';
import { ExportReportModal } from '@/components/tasks/ExportReportModal';
import { useAuth } from '@/context/auth';
import type { TaskStatus } from '@/types/api';

type ChartPeriod = 'week' | 'month' | 'year';

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
        <SvgText key={`t${i}`} x={cx} y={cy + 4} textAnchor="middle" fill="white" fontSize="11" fontWeight="800">100%</SvgText>,
      );
    } else {
      const large = angle > 180 ? 1 : 0;
      const x2 = cx + r * Math.cos(toRad(endAngle));
      const y2 = cy + r * Math.sin(toRad(endAngle));
      d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
      paths.push(
        <Path key={i} d={d} fill={sl.color} />,
        pct >= 8 ? <SvgText key={`t${i}`} x={lx} y={ly + 4} textAnchor="middle" fill="white" fontSize="11" fontWeight="800">{pct}%</SvgText> : null,
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


const CHART_DATASETS = [
  { label: 'Created',   color: '#1E40AF' },
  { label: 'Completed', color: '#10b981' },
  { label: 'Overdue',   color: '#ef4444' },
] as const;

export default function BODashboardScreen() {
  const { user } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = screenWidth - 40 - 32; // px-5 (20×2) + card p-4 (16×2)
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('week');
  const [showExport, setShowExport] = useState(false);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => tasksApi.dashboard(),
  });

  const { data: recentTasksData } = useQuery({
    queryKey: ['critical-tasks'],
    queryFn: () => tasksApi.list({ overdue: true, limit: 5 }),
  });

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
  const { data: todayData } = useQuery({
    queryKey: ['dashboard-today'],
    queryFn: () => tasksApi.dashboard(todayStart.toISOString(), todayEnd.toISOString()),
  });

  // ← tất cả hooks phải đặt trước mọi early return
  const { data: chartRes, isFetching: chartFetching } = useQuery({
    queryKey: ['task-chart', chartPeriod],
    queryFn: () => tasksApi.chartData(chartPeriod),
    refetchInterval: 5 * 60_000, // 5 min safety net for multi-user changes
    staleTime: 30_000,
  });

  if (isLoading) return <LoadingScreen />;
  if (isError) return <ErrorView onRetry={refetch} />;

  const stats = data?.data?.summary ?? emptyStats();
  const onTaskStaff = data?.data?.on_task_staff ?? 0;
  const unassignedStaff = data?.data?.unassigned_staff ?? 0;
  const todayStats = todayData?.data?.summary ?? emptyStats();
  const chartData = chartRes?.data;
  const total = stats.todo + stats.in_progress + stats.done + stats.cancelled + stats.rejected + stats.overdue;
  const currentTenant = user?.tenants?.find((t) => t.id === user.tenant_id) ?? user?.tenants?.[0];
  const tenantName = currentTenant?.name ?? 'My Workspace';

  const roleLabel =
    user?.role === 'business_owner' ? 'Business Owner'
    : user?.role === 'operator' ? 'Operator'
    : user?.full_name ?? 'User';

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
      <AppHeader tenantName={tenantName} rightAction={
        <Pressable onPress={() => setShowExport(true)} className="px-3 py-1.5 rounded-xl active:opacity-70" style={{ backgroundColor: '#eff6ff' }}>
          <Text className="text-xs font-bold" style={{ color: '#1E40AF' }}>⬇ Export</Text>
        </Pressable>
      } />
      <ExportReportModal visible={showExport} onClose={() => setShowExport(false)} />

      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {/* Greeting */}
        <View className="px-5 pt-5 pb-3">
          <Text className="text-sm text-on-surface-variant">{getGreeting()},</Text>
          <Text className="text-2xl font-extrabold text-on-surface mb-3">{roleLabel}</Text>

          {/* Quick stats chips */}
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => router.push('/(bo)/employees')}
              className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5 active:opacity-70"
              style={{ backgroundColor: '#dbeafe' }}
            >
              <Text style={{ fontSize: 13 }}>🔧</Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#1E40AF' }}>
                {onTaskStaff} On Task
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/(bo)/employees')}
              className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5 active:opacity-70"
              style={{ backgroundColor: '#fef9c3' }}
            >
              <Text style={{ fontSize: 13 }}>⏳</Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#854d0e' }}>
                {unassignedStaff} Unassigned
              </Text>
            </Pressable>
          </View>
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
          {/* Today Task */}
          <View className="bg-surface-container-lowest rounded-2xl p-4">
            {(() => {
              // overdue là subset của todo (todo task quá deadline) → không cộng riêng vào total
              const todayTotal = todayStats.todo + todayStats.in_progress + todayStats.done;
              const pct = (n: number) => todayTotal > 0 ? Math.round((n / todayTotal) * 100) : 0;
              const rows = [
                { label: 'Active',      value: Math.max(0, todayStats.todo - todayStats.overdue), color: '#1E40AF' },
                { label: 'Progressing', value: todayStats.in_progress,                            color: '#f59e0b' },
                { label: 'Completed',   value: todayStats.done,                                    color: '#10b981' },
                { label: 'Overdue',     value: todayStats.overdue,                                 color: '#ef4444' },
              ] as const;
              return (
                <>
                  <View className="flex-row items-center justify-between mb-4">
                    <Text className="text-base font-bold text-on-surface">Today Task</Text>
                    <Text className="text-sm font-semibold text-on-surface-variant">
                      {todayTotal} task{todayTotal !== 1 ? 's' : ''} in total
                    </Text>
                  </View>
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
                </>
              );
            })()}
          </View>

          {/* Task Overview Chart */}
          <View className="bg-surface-container-lowest rounded-2xl p-4">
            {/* Header + period tabs */}
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-base font-bold text-on-surface">Task Overview</Text>
              <View className="flex-row rounded-xl overflow-hidden" style={{ backgroundColor: '#f1f5f9' }}>
                {(['week', 'month', 'year'] as ChartPeriod[]).map((p) => (
                  <Pressable
                    key={p}
                    onPress={() => setChartPeriod(p)}
                    className="px-3 py-1.5"
                    style={{ backgroundColor: chartPeriod === p ? '#1E40AF' : 'transparent' }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: chartPeriod === p ? '#fff' : '#6b7280', textTransform: 'capitalize' }}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Chart */}
            {chartData ? (
              <>
                <TaskBarChart
                  labels={chartData.labels}
                  datasets={[
                    { label: 'Created',   color: '#1E40AF', data: chartData.created },
                    { label: 'Completed', color: '#10b981', data: chartData.completed },
                    { label: 'Overdue',   color: '#ef4444', data: chartData.overdue },
                  ]}
                  width={chartWidth}
                />
                {/* Legend */}
                <View className="flex-row justify-center gap-5 mt-3">
                  {CHART_DATASETS.map(({ label, color }) => (
                    <View key={label} className="flex-row items-center gap-1.5">
                      <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color }} />
                      <Text style={{ fontSize: 11, color: '#6b7280' }}>{label}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <View style={{ height: 180, alignItems: 'center', justifyContent: 'center' }}>
                <Text className="text-xs text-on-surface-variant">
                  {chartFetching ? 'Loading…' : 'No data'}
                </Text>
              </View>
            )}
          </View>

          {/* Services */}
          <View>
            <Text className="text-base font-bold text-on-surface mb-3">Services</Text>
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => router.push('/(bo)/pricing')}
                className="flex-1 rounded-2xl p-4 active:opacity-70"
                style={{ backgroundColor: '#eff6ff' }}
              >
                <Text style={{ fontSize: 22 }}>🏷️</Text>
                <Text className="text-sm font-bold mt-2" style={{ color: '#1E40AF' }}>Pricing</Text>
                <Text className="text-xs text-on-surface-variant mt-0.5">Manage service prices</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/(bo)/vouchers')}
                className="flex-1 rounded-2xl p-4 active:opacity-70"
                style={{ backgroundColor: '#f0fdf4' }}
              >
                <Text style={{ fontSize: 22 }}>🎟️</Text>
                <Text className="text-sm font-bold mt-2" style={{ color: '#059669' }}>Vouchers</Text>
                <Text className="text-xs text-on-surface-variant mt-0.5">Manage discount codes</Text>
              </Pressable>
            </View>
          </View>

          {/* Critical Activities */}
          <View className="bg-surface-container-lowest rounded-2xl p-4">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-base font-bold text-on-surface">Critical Activities</Text>
              <Pressable onPress={() => router.push({ pathname: '/(bo)/tasks', params: { status: 'overdue' } })} className="active:opacity-60">
                <Text className="text-xs font-bold text-primary uppercase tracking-wide">View All</Text>
              </Pressable>
            </View>
            {recentTasks.length === 0 ? (
              <Text className="text-sm text-on-surface-variant">No overdue tasks 🎉</Text>
            ) : (
              recentTasks.map((task: any) => {
                const priorityIcon =
                  task.priority === 'urgent' ? '🔴' :
                  task.priority === 'high' ? '🟠' :
                  task.priority === 'medium' ? '🟡' : '🟢';
                const overdueBy = (() => {
                  const diff = task.deadline ? Date.now() - new Date(task.deadline).getTime() : 0;
                  const h = Math.floor(diff / 3600000);
                  if (h < 24) return `${h}h overdue`;
                  return `${Math.floor(h / 24)}d overdue`;
                })();
                return (
                  <Pressable
                    key={task.id}
                    onPress={() => router.navigate({ pathname: '/(bo)/tasks/[id]', params: { id: task.id } })}
                    className="flex-row items-center gap-3 py-2.5 border-b border-surface-container active:opacity-70"
                  >
                    <View
                      className="w-8 h-8 rounded-xl items-center justify-center"
                      style={{ backgroundColor: '#fff1f2' }}
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
                    <Text className="text-xs font-semibold" style={{ color: '#ef4444' }}>{overdueBy}</Text>
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
