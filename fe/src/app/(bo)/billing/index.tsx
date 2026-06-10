import { useState } from 'react';
import { RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { View, Text, Pressable, ScrollView } from '@/tw';
import { requestsApi, type ServiceRequestSummary } from '@/lib/api/requests';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorView } from '@/components/ui/ErrorView';

function fmt(n: number | null | undefined) {
  if (n == null) return '—';
  return Number(n).toLocaleString('vi-VN') + '₫';
}

export default function BillingScreen() {
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['billing', page],
    queryFn: () => requestsApi.list({ status: 'completed', page, limit: 20 }),
  });

  if (isLoading) return <LoadingScreen />;
  if (isError) return <ErrorView onRetry={refetch} />;

  const requests = data?.data ?? [];
  const meta = data?.meta;

  const totalRevenue = requests.reduce((s, r) => s + Number(r.final_amount ?? r.collected_amount ?? r.agreed_price ?? 0), 0);
  const totalDiscount = requests.reduce((s, r) => s + Number(r.discount_amount ?? 0), 0);

  return (
    <View className="flex-1 bg-surface">
      <View className="glass-effect px-5 pt-14 pb-4">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-3">
            <Pressable onPress={() => router.back()} className="active:opacity-60">
              <Text className="text-primary font-semibold">← Quay lại</Text>
            </Pressable>
            <Text className="text-2xl font-extrabold text-on-surface tracking-tight">Billing</Text>
          </View>
          <Pressable
            onPress={() => router.push('/(bo)/billing/commission')}
            className="bg-primary/10 px-3 py-2 rounded-xl active:opacity-70"
          >
            <Text className="text-xs font-bold text-primary">⚙️ Hoa hồng</Text>
          </Pressable>
        </View>

        {/* Revenue summary */}
        <View className="flex-row gap-3">
          <View className="flex-1 bg-success/10 rounded-xl px-3 py-2">
            <Text className="text-xs text-on-surface-variant">Doanh thu (trang này)</Text>
            <Text className="text-lg font-extrabold text-success">{fmt(totalRevenue)}</Text>
          </View>
          <View className="flex-1 bg-warning/10 rounded-xl px-3 py-2">
            <Text className="text-xs text-on-surface-variant">Đã giảm giá</Text>
            <Text className="text-lg font-extrabold text-warning">{fmt(totalDiscount)}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {requests.length === 0 ? (
          <View className="items-center justify-center py-20 gap-3">
            <Text className="text-4xl">🧾</Text>
            <Text className="text-sm text-on-surface-variant">Chưa có đơn hoàn thành</Text>
          </View>
        ) : (
          <>
            {requests.map((req: ServiceRequestSummary & { final_amount?: number | null; discount_amount?: number | null }) => {
              const amount = req.final_amount ?? req.collected_amount ?? req.agreed_price;
              const hasDiscount = req.discount_amount && Number(req.discount_amount) > 0;
              return (
                <Pressable
                  key={req.id}
                  onPress={() => router.push({ pathname: '/(bo)/billing/[id]', params: { id: req.id } })}
                  className="bg-surface-container-lowest rounded-xl p-4 mb-3 active:opacity-80"
                >
                  <View className="flex-row items-start justify-between mb-2">
                    <View className="flex-1">
                      <Text className="text-xs font-bold text-primary">{req.category?.name ?? 'Dịch vụ'}</Text>
                      <Text className="text-sm font-semibold text-on-surface mt-0.5" numberOfLines={2}>
                        {req.description}
                      </Text>
                      <Text className="text-xs text-on-surface-variant mt-1">
                        👤 {req.customer?.full_name ?? 'Khách hàng'}
                      </Text>
                      {req.staff && (
                        <Text className="text-xs text-on-surface-variant">
                          🔧 {req.staff.full_name}
                        </Text>
                      )}
                    </View>
                    <View className="items-end ml-3">
                      <Text className="text-base font-extrabold text-success">{fmt(amount)}</Text>
                      {hasDiscount && (
                        <Text className="text-xs text-warning">-{fmt(Number(req.discount_amount))}</Text>
                      )}
                      <Text className="text-xs text-on-surface-variant mt-1">
                        {req.completed_at ? new Date(req.completed_at).toLocaleDateString('vi-VN') : '—'}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}

            {/* Pagination */}
            {meta && meta.total > 20 && (
              <View className="flex-row justify-center gap-3 mt-2 mb-4">
                <Pressable
                  onPress={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 bg-surface-container-high rounded-xl active:opacity-70 disabled:opacity-40"
                >
                  <Text className="text-sm font-bold text-on-surface">← Trước</Text>
                </Pressable>
                <Text className="text-sm text-on-surface-variant self-center">
                  {page} / {Math.ceil(meta.total / 20)}
                </Text>
                <Pressable
                  onPress={() => setPage(p => p + 1)}
                  disabled={page * 20 >= meta.total}
                  className="px-4 py-2 bg-surface-container-high rounded-xl active:opacity-70 disabled:opacity-40"
                >
                  <Text className="text-sm font-bold text-on-surface">Sau →</Text>
                </Pressable>
              </View>
            )}
          </>
        )}
        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
