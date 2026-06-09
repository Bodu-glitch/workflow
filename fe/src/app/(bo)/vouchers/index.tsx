import { Alert, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { View, Text, Pressable, ScrollView } from '@/tw';
import { vouchersApi, type Voucher } from '@/lib/api/vouchers';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorView } from '@/components/ui/ErrorView';
import { ApiError } from '@/lib/api/client';

function fmt(n: number | null | undefined) {
  if (n == null) return null;
  return Number(n).toLocaleString('vi-VN') + '₫';
}

function VoucherCard({ item, onToggle }: { item: Voucher; onToggle: () => void }) {
  const isExpired = item.ends_at && new Date(item.ends_at) < new Date();
  const valueDisplay = item.type === 'percent'
    ? `${item.value}% off${item.max_discount != null ? ` (tối đa ${fmt(item.max_discount)})` : ''}`
    : `Giảm ${fmt(item.value)}`;
  const statusColor = !item.is_active || isExpired ? '#9CA3AF' : '#10B981';
  const statusLabel = !item.is_active ? 'Vô hiệu' : isExpired ? 'Hết hạn' : 'Đang hoạt động';

  return (
    <View className="bg-surface-container-lowest rounded-xl p-4 mb-3">
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <View className="bg-primary px-3 py-1 rounded-lg">
              <Text className="text-white font-extrabold text-sm tracking-wide">{item.code}</Text>
            </View>
            <View style={{ backgroundColor: statusColor + '20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: statusColor }}>{statusLabel}</Text>
            </View>
          </View>
          <Text className="text-base font-bold text-on-surface mt-2">{valueDisplay}</Text>
          {item.min_order_value != null && item.min_order_value > 0 && (
            <Text className="text-xs text-on-surface-variant">Đơn tối thiểu: {fmt(item.min_order_value)}</Text>
          )}
          {item.category && (
            <Text className="text-xs text-on-surface-variant">Danh mục: {item.category.name}</Text>
          )}
          <View className="flex-row gap-3 mt-1">
            <Text className="text-xs text-on-surface-variant">
              Đã dùng: {item.usage_count}{item.usage_limit != null ? `/${item.usage_limit}` : ''}
            </Text>
            {item.ends_at && (
              <Text className="text-xs text-on-surface-variant">
                HSD: {new Date(item.ends_at).toLocaleDateString('vi-VN')}
              </Text>
            )}
          </View>
        </View>
        <Pressable
          onPress={onToggle}
          className={`ml-3 px-3 py-2 rounded-xl active:opacity-70 ${item.is_active ? 'bg-error-container' : 'bg-success/20'}`}
        >
          <Text className={`text-xs font-bold ${item.is_active ? 'text-on-error-container' : 'text-success'}`}>
            {item.is_active ? 'Tắt' : 'Bật'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function VouchersScreen() {
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['vouchers'],
    queryFn: () => vouchersApi.list(),
    select: (d) => d.data,
  });

  const toggleMutation = useMutation({
    mutationFn: (voucher: Voucher) =>
      vouchersApi.update(voucher.id, { is_active: !voucher.is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vouchers'] }),
    onError: (e) => Alert.alert('Lỗi', e instanceof ApiError ? e.message : 'Thất bại'),
  });

  if (isLoading) return <LoadingScreen />;
  if (isError) return <ErrorView onRetry={refetch} />;

  const vouchers = data ?? [];
  const active = vouchers.filter(v => v.is_active && !(v.ends_at && new Date(v.ends_at) < new Date()));
  const inactive = vouchers.filter(v => !v.is_active || (v.ends_at && new Date(v.ends_at) < new Date()));

  return (
    <View className="flex-1 bg-surface">
      <View className="glass-effect px-5 pt-14 pb-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <Pressable onPress={() => router.back()} className="active:opacity-60">
              <Text className="text-primary font-semibold">← Quay lại</Text>
            </Pressable>
            <Text className="text-2xl font-extrabold text-on-surface tracking-tight">Voucher</Text>
          </View>
          <Pressable
            onPress={() => router.push('/(bo)/vouchers/create')}
            className="bg-primary px-4 py-2 rounded-xl active:opacity-70"
          >
            <Text className="text-white text-sm font-bold">+ Tạo</Text>
          </Pressable>
        </View>

        {/* Stats */}
        <View className="flex-row gap-3 mt-3">
          <View className="flex-1 bg-success/10 rounded-xl px-3 py-2">
            <Text className="text-xs text-on-surface-variant">Đang hoạt động</Text>
            <Text className="text-xl font-extrabold text-success">{active.length}</Text>
          </View>
          <View className="flex-1 bg-surface-container-high rounded-xl px-3 py-2">
            <Text className="text-xs text-on-surface-variant">Vô hiệu / Hết hạn</Text>
            <Text className="text-xl font-extrabold text-on-surface-variant">{inactive.length}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {vouchers.length === 0 ? (
          <View className="items-center justify-center py-20 gap-3">
            <Text className="text-4xl">🎟️</Text>
            <Text className="text-sm text-on-surface-variant">Chưa có voucher nào</Text>
            <Pressable
              onPress={() => router.push('/(bo)/vouchers/create')}
              className="bg-primary px-6 py-3 rounded-xl active:opacity-70 mt-2"
            >
              <Text className="text-white font-bold">Tạo voucher đầu tiên</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {active.length > 0 && (
              <>
                <Text className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-3">
                  Đang hoạt động ({active.length})
                </Text>
                {active.map(v => (
                  <VoucherCard
                    key={v.id}
                    item={v}
                    onToggle={() => toggleMutation.mutate(v)}
                  />
                ))}
              </>
            )}
            {inactive.length > 0 && (
              <>
                <Text className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-3 mt-4">
                  Vô hiệu / Hết hạn ({inactive.length})
                </Text>
                {inactive.map(v => (
                  <VoucherCard
                    key={v.id}
                    item={v}
                    onToggle={() => toggleMutation.mutate(v)}
                  />
                ))}
              </>
            )}
          </>
        )}
        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
