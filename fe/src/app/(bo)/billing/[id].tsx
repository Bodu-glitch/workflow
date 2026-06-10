import { RefreshControl, Linking } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { View, Text, Pressable, ScrollView } from '@/tw';
import { requestsApi } from '@/lib/api/requests';
import { workspaceApi } from '@/lib/api/workspace';
import { tokenStore, BASE_URL } from '@/lib/api/client';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorView } from '@/components/ui/ErrorView';

function fmt(n: number | null | undefined) {
  if (n == null) return '—';
  return Number(n).toLocaleString('vi-VN') + '₫';
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View className="flex-row items-start mb-2">
      <Text className="text-xs text-on-surface-variant w-28">{label}</Text>
      <Text className="text-sm font-medium text-on-surface flex-1">{value}</Text>
    </View>
  );
}

export default function BillingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: reqData, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['request-detail', id],
    queryFn: () => requestsApi.getById(id),
    select: (d) => d.data,
  });

  const { data: payData } = useQuery({
    queryKey: ['workspace-payment-info'],
    queryFn: () => workspaceApi.getPaymentInfo(),
    select: (d) => d.data,
  });

  if (isLoading) return <LoadingScreen />;
  if (isError || !reqData) return <ErrorView onRetry={refetch} />;

  const req = reqData as any;
  const payment = payData;

  const grossAmount = Number(req.agreed_price ?? 0);
  const discountAmount = Number(req.discount_amount ?? 0);
  const finalAmount = Number(req.final_amount ?? req.collected_amount ?? grossAmount);
  const platformPct = payment?.commission_platform_percent ?? 10;
  const staffPct = payment?.commission_staff_percent ?? 70;
  const tenantPct = 100 - platformPct - staffPct;

  const platformFee = (finalAmount * platformPct) / 100;
  const staffFee = (finalAmount * staffPct) / 100;
  const tenantFee = (finalAmount * tenantPct) / 100;

  const handleDownloadInvoice = async () => {
    const token = await tokenStore.get();
    const url = `${BASE_URL}/requests/${id}/invoice${token ? `?token=${token}` : ''}`;
    await Linking.openURL(url);
  };

  return (
    <View className="flex-1 bg-surface">
      <View className="glass-effect px-5 pt-14 pb-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <Pressable onPress={() => router.back()} className="active:opacity-60">
              <Text className="text-primary font-semibold">← Quay lại</Text>
            </Pressable>
            <Text className="text-xl font-extrabold text-on-surface tracking-tight">Chi tiết Bill</Text>
          </View>
          <Pressable
            onPress={handleDownloadInvoice}
            className="bg-primary/10 px-3 py-2 rounded-xl active:opacity-70"
          >
            <Text className="text-xs font-bold text-primary">📄 PDF</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-5"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {/* Request info */}
        <View className="bg-surface-container-lowest rounded-xl p-5 mb-4">
          <Text className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-3">
            Thông tin đơn
          </Text>
          <InfoRow label="Dịch vụ" value={req.category?.name} />
          <InfoRow label="Mô tả" value={req.description} />
          <InfoRow label="Khách hàng" value={req.customer?.full_name} />
          <InfoRow label="Kỹ thuật viên" value={req.staff?.full_name} />
          <InfoRow label="Ngày hoàn thành" value={req.completed_at ? new Date(req.completed_at).toLocaleString('vi-VN') : null} />
          {req.voucher_code && <InfoRow label="Voucher" value={req.voucher_code} />}
        </View>

        {/* Completion checklist */}
        {req.completion_checklist && Array.isArray(req.completion_checklist) && req.completion_checklist.length > 0 && (
          <View className="bg-surface-container-lowest rounded-xl p-5 mb-4">
            <Text className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-3">
              Danh sách công việc thực hiện
            </Text>
            {req.completion_checklist.map((item: any) => (
              <View key={item.id} className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center gap-2">
                  <Text className={item.checked ? 'text-success' : 'text-on-surface-variant'}>
                    {item.checked ? '✓' : '○'}
                  </Text>
                  <Text className={`text-sm ${item.checked ? 'text-on-surface' : 'text-on-surface-variant line-through'}`}>
                    {item.name}
                  </Text>
                </View>
                <Text className={`text-sm font-bold ${item.checked ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                  {fmt(item.price)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Bill breakdown */}
        <View className="bg-surface-container-lowest rounded-xl p-5 mb-4">
          <Text className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-3">
            Chi tiết hóa đơn
          </Text>
          <View className="flex-row justify-between mb-2">
            <Text className="text-sm text-on-surface-variant">Giá thỏa thuận</Text>
            <Text className="text-sm font-medium text-on-surface">{fmt(grossAmount)}</Text>
          </View>
          {discountAmount > 0 && (
            <View className="flex-row justify-between mb-2">
              <Text className="text-sm text-warning">Giảm giá (voucher)</Text>
              <Text className="text-sm font-medium text-warning">-{fmt(discountAmount)}</Text>
            </View>
          )}
          <View className="flex-row justify-between pt-2 border-t border-outline/20">
            <Text className="text-base font-bold text-on-surface">Thực thu</Text>
            <Text className="text-lg font-extrabold text-success">{fmt(finalAmount)}</Text>
          </View>
        </View>

        {/* Commission split */}
        <View className="bg-surface-container-lowest rounded-xl p-5 mb-4">
          <Text className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-3">
            Phân chia hoa hồng
          </Text>
          <View className="flex-row justify-between mb-3">
            <View>
              <Text className="text-xs text-on-surface-variant">Platform ({platformPct}%)</Text>
              <Text className="text-base font-bold text-on-surface">{fmt(platformFee)}</Text>
            </View>
            <View className="items-center">
              <Text className="text-xs text-on-surface-variant">Tenant ({tenantPct}%)</Text>
              <Text className="text-base font-bold text-primary">{fmt(tenantFee)}</Text>
            </View>
            <View className="items-end">
              <Text className="text-xs text-on-surface-variant">Nhân viên ({staffPct}%)</Text>
              <Text className="text-base font-bold text-success">{fmt(staffFee)}</Text>
            </View>
          </View>

          {/* Visual bar */}
          <View className="h-3 rounded-full overflow-hidden flex-row">
            <View className="bg-error" style={{ flex: platformPct }} />
            <View className="bg-primary" style={{ flex: tenantPct }} />
            <View className="bg-success" style={{ flex: staffPct }} />
          </View>
          <View className="flex-row justify-between mt-1">
            <Text className="text-[10px] text-on-surface-variant">Platform</Text>
            <Text className="text-[10px] text-on-surface-variant">Tenant</Text>
            <Text className="text-[10px] text-on-surface-variant">Nhân viên</Text>
          </View>
        </View>

        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
