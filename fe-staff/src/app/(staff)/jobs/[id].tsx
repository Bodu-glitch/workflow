import { useState, useEffect } from 'react';
import { Alert, ActivityIndicator, RefreshControl, Modal, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { View, Text, Pressable, ScrollView, TextInput } from '@/tw';
import { technicianApi } from '@/lib/api/technician';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorView } from '@/components/ui/ErrorView';
import { ApiError, BASE_URL, tokenStore } from '@/lib/api/client';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="bg-surface-container-lowest rounded-xl p-5 mb-4">
      <Text className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-4">{title}</Text>
      {children}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View className="flex-row items-start mb-3">
      <Text className="text-xs font-semibold text-on-surface-variant w-24">{label}</Text>
      <Text className="text-sm text-on-surface flex-1">{value}</Text>
    </View>
  );
}

function fmt(n: number) {
  return Number(n ?? 0).toLocaleString('vi-VN') + '₫';
}

interface ChecklistItem {
  id: string;
  name: string;
  price: number;
  checked: boolean;
}

interface PaymentInfo {
  qr_payment_url: string | null;
  bank_name: string | null;
  bank_account: string | null;
  bank_account_name: string | null;
}

export default function StaffJobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const [collectedAmount, setCollectedAmount] = useState('');
  const [showRequote, setShowRequote] = useState(false);
  const [requotePrice, setRequotePrice] = useState('');
  const [requoteReason, setRequoteReason] = useState('');
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [showQrModal, setShowQrModal] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['technician-job', id],
    queryFn: () => technicianApi.getJob(id),
    select: (d: any) => d.data ?? d,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['technician-job', id] });
    qc.invalidateQueries({ queryKey: ['technician-jobs'] });
  };

  // Initialize checklist from job data
  useEffect(() => {
    if (!data) return;
    const existing = data.completion_checklist;
    if (existing && Array.isArray(existing) && existing.length > 0) {
      setChecklist(existing);
    } else if (data.service_pricings && Array.isArray(data.service_pricings) && data.service_pricings.length > 0) {
      setChecklist(data.service_pricings.map((p: any, idx: number) => ({
        id: p.id ?? String(idx),
        name: p.name ?? p.service_name ?? 'Dịch vụ',
        price: Number(p.price ?? p.agreed_price ?? 0),
        checked: true,
      })));
    } else if (data.agreed_price) {
      setChecklist([{
        id: 'default',
        name: data.category?.name ?? 'Dịch vụ chính',
        price: Number(data.agreed_price),
        checked: true,
      }]);
    }
  }, [data?.id, data?.completion_checklist]);

  const acceptMutation = useMutation({
    mutationFn: () => technicianApi.acceptJob(id),
    onSuccess: () => { invalidate(); Alert.alert('Đã xác nhận', 'Bạn đã xác nhận nhận công việc.'); },
    onError: (e) => Alert.alert('Lỗi', e instanceof ApiError ? e.message : 'Thất bại'),
  });

  const declineMutation = useMutation({
    mutationFn: () => technicianApi.declineJob(id),
    onSuccess: () => { router.back(); },
    onError: (e) => Alert.alert('Lỗi', e instanceof ApiError ? e.message : 'Thất bại'),
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let lat = 0, lng = 0;
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      }
      return technicianApi.startJob(id, lat, lng);
    },
    onSuccess: invalidate,
    onError: (e) => Alert.alert('Lỗi', e instanceof ApiError ? e.message : 'Thất bại'),
  });

  const saveChecklistMutation = useMutation({
    mutationFn: () => technicianApi.updateChecklist(id, checklist),
    onSuccess: () => {
      invalidate();
      Alert.alert('Đã lưu', 'Danh sách dịch vụ đã được cập nhật.');
    },
    onError: (e) => Alert.alert('Lỗi', e instanceof ApiError ? e.message : 'Thất bại'),
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      // Save checklist first
      await technicianApi.updateChecklist(id, checklist);
      const totalAmount = checklist.filter(i => i.checked).reduce((s, i) => s + i.price, 0);
      const amount = collectedAmount.trim() ? Number(collectedAmount) : totalAmount;
      return technicianApi.completeJob(id, amount);
    },
    onSuccess: () => {
      invalidate();
      Alert.alert('Hoàn thành!', 'Công việc đã được hoàn thành thành công.');
      router.replace('/(staff)/jobs');
    },
    onError: (e) => Alert.alert('Lỗi', e instanceof ApiError ? e.message : 'Thất bại'),
  });

  const reqouteMutation = useMutation({
    mutationFn: () => technicianApi.requote(id, Number(requotePrice), requoteReason),
    onSuccess: () => {
      invalidate();
      setShowRequote(false);
      Alert.alert('Đã gửi', 'Yêu cầu báo giá lại đã được gửi cho khách hàng.');
    },
    onError: (e) => Alert.alert('Lỗi', e instanceof ApiError ? e.message : 'Thất bại'),
  });

  const handleShowQr = async () => {
    if (!data?.tenant_id) {
      Alert.alert('Thông báo', 'Không tìm thấy thông tin thanh toán');
      return;
    }
    try {
      const token = await tokenStore.get();
      const res = await fetch(`${BASE_URL}/workspace/public-payment/${data.tenant_id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const json = await res.json();
        setPaymentInfo(json.data ?? json);
      }
    } catch {
      setPaymentInfo(null);
    }
    setShowQrModal(true);
  };

  if (isLoading) return <LoadingScreen />;
  if (isError || !data) return <ErrorView onRetry={refetch} />;

  const job = data;
  const isAssigned = job.status === 'assigned';
  const isInProgress = job.status === 'in_progress';

  const checkedTotal = checklist.filter(i => i.checked).reduce((s, i) => s + i.price, 0);
  const transferContent = `DICHVU ${id.slice(-8).toUpperCase()} ${job.category?.name ?? ''}`.trim();

  return (
    <View className="flex-1 bg-surface">
      <View className="glass-effect px-5 pt-14 pb-4">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} className="active:opacity-60">
            <Text className="text-primary font-semibold">← Quay lại</Text>
          </Pressable>
          <Text className="text-lg font-extrabold text-on-surface tracking-tight flex-1" numberOfLines={1}>
            Chi tiết công việc
          </Text>
          {/* Support button */}
          <Pressable
            onPress={() => router.push({ pathname: '/(staff)/support/new', params: { job_id: id } })}
            className="bg-warning/10 px-3 py-2 rounded-xl active:opacity-70"
          >
            <Text className="text-xs font-bold text-warning">🎫 Hỗ trợ</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-5"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        <Section title="Thông tin yêu cầu">
          <InfoRow label="Dịch vụ" value={job.category?.name} />
          <InfoRow label="Mô tả" value={job.description} />
          <InfoRow label="Khách hàng" value={job.customer?.full_name} />
          <InfoRow label="Điện thoại" value={job.customer?.phone} />
          <InfoRow label="Địa chỉ" value={job.address} />
          <InfoRow label="Ưu tiên" value={job.is_emergency ? '🚨 Khẩn cấp' : 'Bình thường'} />
          {job.agreed_price != null && (
            <InfoRow label="Giá thỏa thuận" value={fmt(Number(job.agreed_price))} />
          )}
        </Section>

        {/* Chat with customer */}
        {!['completed', 'completed_late', 'cancelled'].includes(job.status) && (
          <Pressable
            onPress={() => router.push({ pathname: '/(staff)/jobs/[id]/chat', params: { id } })}
            className="py-4 rounded-xl items-center mb-4 active:opacity-80 flex-row justify-center gap-2"
            style={{ backgroundColor: '#1E40AF' }}
          >
            <Text className="text-white font-bold text-sm">💬 Chat với khách hàng</Text>
          </Pressable>
        )}

        {isAssigned && (
          <Section title="Xác nhận công việc">
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => acceptMutation.mutate()}
                disabled={acceptMutation.isPending}
                className="flex-1 bg-primary py-3 rounded-xl items-center active:opacity-70 disabled:opacity-50"
              >
                {acceptMutation.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text className="text-white font-bold text-sm">✅ Xác nhận</Text>
                }
              </Pressable>
              <Pressable
                onPress={() => declineMutation.mutate()}
                disabled={declineMutation.isPending}
                className="flex-1 bg-error-container py-3 rounded-xl items-center active:opacity-70 disabled:opacity-50"
              >
                {declineMutation.isPending
                  ? <ActivityIndicator size="small" />
                  : <Text className="text-on-error-container font-bold text-sm">✕ Từ chối</Text>
                }
              </Pressable>
            </View>
            <Pressable
              onPress={() => startMutation.mutate()}
              disabled={startMutation.isPending}
              className="mt-3 bg-success py-3 rounded-xl items-center active:opacity-70 disabled:opacity-50"
            >
              {startMutation.isPending
                ? <ActivityIndicator color="#fff" />
                : <Text className="text-white font-bold">🚗 Bắt đầu di chuyển</Text>
              }
            </Pressable>
          </Section>
        )}

        {isInProgress && (
          <>
            {/* Checklist */}
            <Section title="Danh sách dịch vụ thực hiện">
              {checklist.map((item, idx) => (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    const next = [...checklist];
                    next[idx] = { ...item, checked: !item.checked };
                    setChecklist(next);
                  }}
                  className="flex-row items-center justify-between py-3 border-b border-outline/10 active:opacity-70"
                >
                  <View className="flex-row items-center flex-1 gap-3">
                    <View className={`w-5 h-5 rounded border-2 items-center justify-center ${item.checked ? 'bg-primary border-primary' : 'border-outline'}`}>
                      {item.checked && <Text className="text-white text-xs font-bold">✓</Text>}
                    </View>
                    <Text className={`text-sm flex-1 ${item.checked ? 'text-on-surface' : 'text-on-surface-variant line-through'}`}>
                      {item.name}
                    </Text>
                  </View>
                  <Text className={`text-sm font-bold ml-3 ${item.checked ? 'text-primary' : 'text-on-surface-variant'}`}>
                    {fmt(item.price)}
                  </Text>
                </Pressable>
              ))}

              {/* Total */}
              <View className="flex-row items-center justify-between pt-3 mt-1">
                <Text className="text-sm font-bold text-on-surface">Tổng cộng</Text>
                <Text className="text-lg font-extrabold text-primary">{fmt(checkedTotal)}</Text>
              </View>

              <Pressable
                onPress={() => saveChecklistMutation.mutate()}
                disabled={saveChecklistMutation.isPending}
                className="mt-3 bg-surface-container-high py-2 rounded-xl items-center active:opacity-70 disabled:opacity-50"
              >
                {saveChecklistMutation.isPending
                  ? <ActivityIndicator size="small" />
                  : <Text className="text-sm font-semibold text-on-surface">💾 Lưu danh sách</Text>
                }
              </Pressable>
            </Section>

            {/* QR Payment button */}
            <Section title="Thanh toán">
              <Pressable
                onPress={handleShowQr}
                className="bg-success py-4 rounded-xl items-center active:opacity-80 mb-3"
              >
                <Text className="text-white font-bold text-base">📱 Tạo QR thanh toán ({fmt(checkedTotal)})</Text>
              </Pressable>

              <TextInput
                className="bg-surface-container-high rounded-xl px-4 py-3 text-base text-on-surface mb-3"
                placeholder={`Số tiền thu được (mặc định: ${fmt(checkedTotal)})`}
                placeholderTextColor="#737685"
                value={collectedAmount}
                onChangeText={setCollectedAmount}
                keyboardType="numeric"
              />

              <Pressable
                onPress={() => completeMutation.mutate()}
                disabled={completeMutation.isPending}
                className="bg-primary py-4 rounded-xl items-center active:opacity-80 disabled:opacity-50 mb-3"
              >
                {completeMutation.isPending
                  ? <ActivityIndicator color="#fff" />
                  : <Text className="text-white font-bold text-base">🏁 Hoàn thành công việc</Text>
                }
              </Pressable>

              <Pressable
                onPress={() => setShowRequote((v) => !v)}
                className="py-3 rounded-xl bg-surface-container-high items-center active:opacity-70"
              >
                <Text className="text-sm font-bold text-on-surface">💬 Báo giá lại</Text>
              </Pressable>

              {showRequote && (
                <View className="mt-3 gap-3">
                  <TextInput
                    className="bg-surface-container-high rounded-xl px-4 py-3 text-base text-on-surface"
                    placeholder="Giá mới (VNĐ)"
                    placeholderTextColor="#737685"
                    value={requotePrice}
                    onChangeText={setRequotePrice}
                    keyboardType="numeric"
                  />
                  <TextInput
                    className="bg-surface-container-high rounded-xl px-4 py-3 text-base text-on-surface"
                    placeholder="Lý do báo giá lại"
                    placeholderTextColor="#737685"
                    value={requoteReason}
                    onChangeText={setRequoteReason}
                    multiline
                  />
                  <Pressable
                    onPress={() => reqouteMutation.mutate()}
                    disabled={reqouteMutation.isPending || !requotePrice || !requoteReason}
                    className="bg-primary py-3 rounded-xl items-center active:opacity-70 disabled:opacity-50"
                  >
                    {reqouteMutation.isPending
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text className="text-white font-bold text-sm">Gửi báo giá lại</Text>
                    }
                  </Pressable>
                </View>
              )}
            </Section>
          </>
        )}

        <View className="h-8" />
      </ScrollView>

      {/* QR Payment Modal */}
      <Modal
        visible={showQrModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowQrModal(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-surface rounded-t-3xl px-5 pt-5 pb-10">
            <View className="flex-row items-center justify-between mb-5">
              <Text className="text-xl font-extrabold text-on-surface">Thanh toán</Text>
              <Pressable onPress={() => setShowQrModal(false)} className="active:opacity-70">
                <Text className="text-on-surface-variant text-2xl">✕</Text>
              </Pressable>
            </View>

            {/* Bill summary */}
            <View className="bg-surface-container-lowest rounded-xl p-4 mb-4">
              <Text className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-3">Tóm tắt bill</Text>
              {checklist.filter(i => i.checked).map((item) => (
                <View key={item.id} className="flex-row justify-between mb-2">
                  <Text className="text-sm text-on-surface flex-1">{item.name}</Text>
                  <Text className="text-sm font-bold text-on-surface ml-3">{fmt(item.price)}</Text>
                </View>
              ))}
              <View className="border-t border-outline/20 pt-2 mt-1 flex-row justify-between">
                <Text className="text-sm font-bold text-on-surface">Tổng cộng</Text>
                <Text className="text-lg font-extrabold text-primary">{fmt(checkedTotal)}</Text>
              </View>
            </View>

            {paymentInfo?.qr_payment_url ? (
              <View className="items-center">
                <Image
                  source={{ uri: paymentInfo.qr_payment_url }}
                  style={{ width: 200, height: 200, borderRadius: 12 }}
                  resizeMode="contain"
                />
                <View className="mt-4 gap-1 w-full">
                  {paymentInfo.bank_name && (
                    <Text className="text-sm text-center text-on-surface-variant">
                      🏦 {paymentInfo.bank_name}
                    </Text>
                  )}
                  {paymentInfo.bank_account && (
                    <Text className="text-base font-bold text-center text-on-surface">
                      {paymentInfo.bank_account}
                    </Text>
                  )}
                  {paymentInfo.bank_account_name && (
                    <Text className="text-sm text-center text-on-surface-variant">
                      {paymentInfo.bank_account_name}
                    </Text>
                  )}
                  <View className="bg-surface-container-high rounded-xl px-4 py-3 mt-2">
                    <Text className="text-xs text-on-surface-variant text-center mb-1">Số tiền</Text>
                    <Text className="text-2xl font-extrabold text-primary text-center">{fmt(checkedTotal)}</Text>
                    <Text className="text-xs text-on-surface-variant text-center mt-2">Nội dung CK</Text>
                    <Text className="text-sm font-bold text-on-surface text-center">{transferContent}</Text>
                  </View>
                </View>
              </View>
            ) : (
              <View className="bg-surface-container-high rounded-xl p-4 items-center gap-2">
                <Text className="text-3xl">💵</Text>
                <Text className="text-sm font-bold text-on-surface">Thanh toán tiền mặt</Text>
                <Text className="text-2xl font-extrabold text-primary">{fmt(checkedTotal)}</Text>
                <Text className="text-xs text-on-surface-variant text-center">
                  Công ty chưa cấu hình QR thanh toán. Vui lòng thu tiền mặt từ khách.
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
