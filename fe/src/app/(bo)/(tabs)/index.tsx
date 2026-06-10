import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshControl, ScrollView as RNScrollView, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { View, Text, Pressable, ScrollView } from '@/tw';
import { requestsApi, type RequestDashboardSummary } from '@/lib/api/requests';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorView } from '@/components/ui/ErrorView';
import { AppHeader } from '@/components/AppHeader';
import { ExportReportModal } from '@/components/tasks/ExportReportModal';
import { useAuth } from '@/context/auth';

const STAT_CARDS: {
  key: keyof RequestDashboardSummary;
  label: string;
  color: string;
  bgColor: string;
  statusFilter?: string;
}[] = [
  { key: 'available',         label: 'Chờ xử lý',    color: '#3B82F6', bgColor: '#eff6ff', statusFilter: 'available' },
  { key: 'pending_assignment', label: 'Chờ phân công', color: '#F59E0B', bgColor: '#fffbeb', statusFilter: 'pending_assignment' },
  { key: 'in_progress',       label: 'Đang thực hiện', color: '#8B5CF6', bgColor: '#f5f3ff', statusFilter: 'in_progress' },
  { key: 'completed',         label: 'Hoàn thành',    color: '#10B981', bgColor: '#f0fdf4', statusFilter: 'completed,completed_late' },
];

const REQUEST_STATUS_COLORS: Record<string, string> = {
  unavailable: '#6B7280',
  available: '#3B82F6',
  negotiating: '#8B5CF6',
  pending_assignment: '#F59E0B',
  assigned: '#8B5CF6',
  in_progress: '#EF4444',
  completed: '#10B981',
  completed_late: '#F59E0B',
  cancelled: '#9CA3AF',
};

const REQUEST_STATUS_LABELS: Record<string, string> = {
  available: 'Chờ xử lý',
  pending_assignment: 'Chờ phân công',
  assigned: 'Đã giao',
  in_progress: 'Đang thực hiện',
  completed: 'Hoàn thành',
  completed_late: 'Hoàn thành (trễ)',
  cancelled: 'Đã hủy',
};

function emptyDashboard(): RequestDashboardSummary {
  return {
    unavailable: 0, available: 0, pending_assignment: 0,
    assigned: 0, in_progress: 0, completed: 0,
    completed_late: 0, cancelled: 0, emergency: 0,
  };
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Chào buổi sáng';
  if (h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

export default function BODashboardScreen() {
  const { user } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const [showExport, setShowExport] = useState(false);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['requests-dashboard'],
    queryFn: () => requestsApi.dashboard(),
  });

  const { data: urgentData } = useQuery({
    queryKey: ['urgent-requests'],
    queryFn: () => requestsApi.list({ status: 'available,pending_assignment', limit: 5 }),
    select: (d) => d.data,
  });

  if (isLoading) return <LoadingScreen />;
  if (isError) return <ErrorView onRetry={refetch} />;

  const summary = (data as any)?.data?.summary ?? emptyDashboard();
  const total = summary.available + summary.pending_assignment + summary.assigned
    + summary.in_progress + summary.completed + summary.completed_late + summary.cancelled;

  const currentTenant = user?.tenants?.find((t) => t.id === user.tenant_id) ?? user?.tenants?.[0];
  const tenantName = currentTenant?.name ?? 'My Workspace';
  const roleLabel =
    user?.role === 'business_owner' ? 'Business Owner'
    : user?.role === 'operator' ? 'Operator'
    : user?.full_name ?? 'User';

  const urgentRequests = urgentData ?? [];

  // Donut slice data for today overview
  const donutSlices = [
    { label: 'Chờ xử lý',    value: summary.available,          color: '#3B82F6' },
    { label: 'Chờ phân công', value: summary.pending_assignment,  color: '#F59E0B' },
    { label: 'Đang thực hiện', value: summary.in_progress,        color: '#8B5CF6' },
    { label: 'Hoàn thành',    value: summary.completed + summary.completed_late, color: '#10B981' },
  ];

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

          {/* Quick chips */}
          <View className="flex-row gap-2">
            <View
              className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
              style={{ backgroundColor: '#dbeafe' }}
            >
              <Text style={{ fontSize: 13 }}>🚨</Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#1E40AF' }}>
                {summary.emergency} Khẩn cấp
              </Text>
            </View>
            <View
              className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
              style={{ backgroundColor: '#fef9c3' }}
            >
              <Text style={{ fontSize: 13 }}>📋</Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#854d0e' }}>
                {total} Tổng yêu cầu
              </Text>
            </View>
          </View>
        </View>

        {/* Stat Cards */}
        <RNScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 12, gap: 12 }}
        >
          {STAT_CARDS.map(({ key, label, color, bgColor, statusFilter }) => (
            <Pressable
              key={key}
              onPress={() => {
                if (statusFilter) {
                  router.push({ pathname: '/(bo)/requests', params: { status: statusFilter } });
                } else {
                  router.push('/(bo)/requests');
                }
              }}
              style={{ backgroundColor: bgColor, borderRadius: 16, padding: 16, width: 140, minHeight: 100 }}
            >
              <Text style={{ fontSize: 10, fontWeight: '700', color, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {label}
              </Text>
              <Text style={{ fontSize: 36, fontWeight: '900', color: '#0d1c2e', marginTop: 8 }}>
                {summary[key]}
              </Text>
            </Pressable>
          ))}
        </RNScrollView>

        <View className="px-5 gap-4 pb-24">
          {/* Request Overview */}
          <View className="bg-surface-container-lowest rounded-2xl p-4">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-base font-bold text-on-surface">Tổng quan yêu cầu</Text>
              <Text className="text-sm font-semibold text-on-surface-variant">{total} yêu cầu</Text>
            </View>
            <View className="gap-2.5">
              {donutSlices.filter(s => s.value > 0).map(({ label, value, color }) => {
                const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                return (
                  <View key={label} className="flex-row items-center gap-3">
                    <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                    <Text className="text-sm text-on-surface-variant flex-1">{label}</Text>
                    <Text className="text-sm font-bold" style={{ color }}>{value}</Text>
                    <Text className="text-xs text-on-surface-variant w-10 text-right">{pct}%</Text>
                  </View>
                );
              })}
              {total === 0 && (
                <Text className="text-sm text-on-surface-variant text-center py-4">Chưa có yêu cầu nào 🎉</Text>
              )}
            </View>
          </View>

          {/* Management shortcuts */}
          <View className="bg-surface-container-lowest rounded-2xl p-4">
            <Text className="text-base font-bold text-on-surface mb-3">Quản lý</Text>
            <View className="flex-row flex-wrap gap-2">
              {[
                { label: '💰 Giá dịch vụ', href: '/(bo)/pricing' as const,           bg: '#eff6ff', color: '#1E40AF' },
                { label: '🎟️ Voucher',     href: '/(bo)/vouchers' as const,           bg: '#f0fdf4', color: '#16a34a' },
                { label: '🧾 Billing',      href: '/(bo)/billing' as const,            bg: '#fefce8', color: '#ca8a04' },
                { label: '⚙️ Hoa hồng',   href: '/(bo)/billing/commission' as const, bg: '#fdf4ff', color: '#9333ea' },
                { label: '🎫 Hỗ trợ',      href: '/(bo)/support' as const,            bg: '#fff7ed', color: '#ea580c' },
              ].map(({ label, href, bg, color }) => (
                <Pressable
                  key={href}
                  onPress={() => router.push(href)}
                  className="rounded-xl px-4 py-3 active:opacity-70"
                  style={{ backgroundColor: bg }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color }}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Requests Table */}
          <View className="bg-surface-container-lowest rounded-2xl overflow-hidden">
            {/* Table header */}
            <View className="flex-row items-center justify-between px-4 py-3 bg-primary/5 border-b border-outline/10">
              <Text className="text-base font-bold text-on-surface">Yêu cầu cần xử lý</Text>
              <Pressable onPress={() => router.push('/(bo)/requests')} className="active:opacity-60">
                <Text className="text-xs font-bold text-primary uppercase tracking-wide">Xem tất cả →</Text>
              </Pressable>
            </View>

            {urgentRequests.length === 0 ? (
              <View className="px-4 py-6 items-center">
                <Text className="text-sm text-on-surface-variant">Không có yêu cầu nào đang chờ 🎉</Text>
              </View>
            ) : (
              <>
                {/* Column headers */}
                <View className="flex-row px-3 py-1.5 bg-surface-container-high/50">
                  <Text style={{ flex: 2, fontSize: 10, fontWeight: '700', color: '#737685', textTransform: 'uppercase', letterSpacing: 0.4 }}>Dịch vụ / Khách hàng</Text>
                  <Text style={{ flex: 1, fontSize: 10, fontWeight: '700', color: '#737685', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'center' }}>Trạng thái</Text>
                  <Text style={{ flex: 1, fontSize: 10, fontWeight: '700', color: '#737685', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'right' }}>Thời gian</Text>
                </View>

                {urgentRequests.map((req: any, idx: number) => {
                  const statusColor = REQUEST_STATUS_COLORS[req.status] ?? '#9CA3AF';
                  const statusLabel = REQUEST_STATUS_LABELS[req.status] ?? req.status;
                  const isLast = idx === urgentRequests.length - 1;
                  return (
                    <Pressable
                      key={req.id}
                      onPress={() => router.navigate({ pathname: '/(bo)/requests/[id]', params: { id: req.id } })}
                      className={`flex-row items-center px-3 py-2.5 active:opacity-70 ${!isLast ? 'border-b border-outline/10' : ''}`}
                    >
                      {/* Service + customer */}
                      <View style={{ flex: 2, paddingRight: 6 }}>
                        <View className="flex-row items-center gap-1.5">
                          {req.is_emergency && <Text style={{ fontSize: 11 }}>🚨</Text>}
                          <Text className="text-xs font-bold text-primary" numberOfLines={1}>
                            {req.category?.name ?? 'Dịch vụ'}
                          </Text>
                        </View>
                        <Text className="text-[11px] text-on-surface-variant mt-0.5" numberOfLines={1}>
                          {req.customer?.full_name ?? 'Khách hàng'}
                        </Text>
                      </View>

                      {/* Status badge */}
                      <View style={{ flex: 1, alignItems: 'center' }}>
                        <View style={{ backgroundColor: statusColor + '20', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: statusColor }}>{statusLabel}</Text>
                        </View>
                      </View>

                      {/* Time */}
                      <View style={{ flex: 1, alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 10, color: '#737685' }}>
                          {new Date(req.created_at).toLocaleDateString('vi-VN')}
                        </Text>
                        <Text style={{ fontSize: 10, color: '#737685' }}>
                          {new Date(req.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
