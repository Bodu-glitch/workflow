import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, RefreshControl } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { View, Text, Pressable, ScrollView } from '@/tw';
import { requestsApi } from '@/lib/api/requests';
import { staffApi } from '@/lib/api/staff';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorView } from '@/components/ui/ErrorView';
import type { StaffMember } from '@/types/api';

const STATUS_COLORS: Record<string, string> = {
  unavailable: '#6B7280',
  available: '#3B82F6',
  pending_assignment: '#F59E0B',
  assigned: '#8B5CF6',
  moving: '#3B82F6',
  arrived: '#10B981',
  in_progress: '#EF4444',
  completed: '#10B981',
  completed_late: '#F59E0B',
  cancelled: '#9CA3AF',
};

const STATUS_LABELS: Record<string, string> = {
  unavailable: 'Đã lên lịch',
  available: 'Chờ xử lý',
  pending_assignment: 'Chờ phân công',
  assigned: 'Đã giao nhân viên',
  moving: 'Nhân viên đang di chuyển',
  arrived: 'Nhân viên đã đến',
  in_progress: 'Đang thực hiện',
  completed: 'Hoàn thành',
  completed_late: 'Hoàn thành (trễ)',
  cancelled: 'Đã huỷ',
};

export default function BORequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['service-request', id],
    queryFn: () => requestsApi.getById(id),
    select: (d) => d.data,
    refetchInterval: 5000,
  });

  const { data: staffData, isLoading: staffLoading } = useQuery({
    queryKey: ['staff-list'],
    queryFn: () => staffApi.list(1, 50),
    select: (d) => (d as any).data as StaffMember[],
    enabled: data?.status === 'pending_assignment',
  });

  const assignMutation = useMutation({
    mutationFn: (staffId: string) => requestsApi.assign(id, staffId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-request', id] });
    },
    onError: (e: any) => {
      const msg = e?.message ?? 'Không thể giao nhân viên';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Lỗi', msg);
    },
  });

  if (isLoading) return <LoadingScreen />;
  if (isError || !data) return <ErrorView onRetry={refetch} />;

  const req = data;
  const statusColor = STATUS_COLORS[req.status] ?? '#9CA3AF';
  const statusLabel = STATUS_LABELS[req.status] ?? req.status;
  const isPendingAssign = req.status === 'pending_assignment';
  const staffList = (staffData ?? []).filter((s) => s.is_active);

  return (
    <View className="flex-1 bg-surface">
      <View className="glass-effect px-5 pt-14 pb-4">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} className="active:opacity-60">
            <Text className="text-primary font-semibold">← Back</Text>
          </Pressable>
          <Text className="text-lg font-extrabold text-on-surface flex-1" numberOfLines={1}>
            Request Detail
          </Text>
          <View style={{ backgroundColor: statusColor + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: statusColor }}>{statusLabel}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {/* Info card */}
        <View className="bg-surface-container-lowest rounded-xl p-5 mb-4">
          <Text className="text-xs font-bold text-primary mb-1">{req.category?.name ?? 'Dịch vụ'}</Text>
          <Text className="text-base font-semibold text-on-surface leading-relaxed mb-3">{req.description}</Text>
          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-on-surface-variant">👤 {req.customer?.full_name ?? 'Khách hàng'}</Text>
            {req.customer?.phone && <Text className="text-sm text-on-surface-variant">{req.customer.phone}</Text>}
          </View>
          <Text className="text-xs text-on-surface-variant mt-2">
            {new Date(req.created_at).toLocaleString('vi-VN')}
          </Text>
          {req.agreed_price != null && (
            <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-outline/20">
              <Text className="text-sm text-on-surface-variant">Giá đã thoả thuận</Text>
              <Text className="text-sm font-bold text-primary">{req.agreed_price.toLocaleString('vi-VN')}₫</Text>
            </View>
          )}
          {req.staff && (
            <View className="flex-row items-center gap-2 mt-3 pt-3 border-t border-outline/20">
              <Text className="text-sm text-on-surface-variant">Nhân viên:</Text>
              <Text className="text-sm font-semibold text-on-surface">{req.staff.full_name}</Text>
            </View>
          )}
        </View>

        {/* Staff assignment section */}
        {isPendingAssign && (
          <View className="bg-surface-container-lowest rounded-xl p-5 mb-4">
            <Text className="text-sm font-bold text-on-surface mb-1">Giao nhân viên</Text>
            <Text className="text-xs text-on-surface-variant mb-4">Chọn nhân viên để thực hiện yêu cầu này</Text>

            {staffLoading ? (
              <View className="items-center py-6">
                <ActivityIndicator color="#1E40AF" />
              </View>
            ) : staffList.length === 0 ? (
              <Text className="text-sm text-on-surface-variant text-center py-4">
                Chưa có nhân viên trong tenant
              </Text>
            ) : (
              <>
                {staffList.map((staff) => {
                  const isSelected = selectedStaffId === staff.id;
                  const onlineColor = staff.online_status === 'online' ? '#10B981' : staff.online_status === 'working' ? '#F59E0B' : '#9CA3AF';
                  return (
                    <Pressable
                      key={staff.id}
                      onPress={() => setSelectedStaffId(staff.id)}
                      className="flex-row items-center gap-3 p-3 rounded-xl mb-2 active:opacity-70"
                      style={{ backgroundColor: isSelected ? '#EFF6FF' : '#F8FAFC', borderWidth: 1.5, borderColor: isSelected ? '#1E40AF' : '#E2E8F0' }}
                    >
                      <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: '#DBEAFE' }}>
                        <Text className="font-bold text-primary text-sm">
                          {staff.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-on-surface">{staff.full_name}</Text>
                        <View className="flex-row items-center gap-1 mt-0.5">
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: onlineColor }} />
                          <Text className="text-xs text-on-surface-variant capitalize">{staff.online_status}</Text>
                          {staff.role === 'staff' && <Text className="text-xs text-on-surface-variant">· nhân viên</Text>}
                        </View>
                      </View>
                      {isSelected && (
                        <View className="w-6 h-6 rounded-full items-center justify-center" style={{ backgroundColor: '#1E40AF' }}>
                          <Text className="text-white text-xs font-bold">✓</Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}

                <Pressable
                  onPress={() => selectedStaffId && assignMutation.mutate(selectedStaffId)}
                  disabled={!selectedStaffId || assignMutation.isPending}
                  className="h-12 rounded-xl items-center justify-center mt-3 active:opacity-80"
                  style={{ backgroundColor: selectedStaffId ? '#1E40AF' : '#CBD5E1' }}
                >
                  {assignMutation.isPending ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text className="text-white font-bold text-sm">
                      {selectedStaffId ? '✓ Giao nhân viên' : 'Chọn nhân viên để giao'}
                    </Text>
                  )}
                </Pressable>
              </>
            )}
          </View>
        )}

        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
