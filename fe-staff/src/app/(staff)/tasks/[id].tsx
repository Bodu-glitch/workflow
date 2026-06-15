import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, ActivityIndicator, RefreshControl, Image as RNImage } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { View, Text, Pressable, ScrollView, TextInput } from '@/tw';
import { requestsApi, type ServiceRequestSummary } from '@/lib/api/requests';
import { meApi } from '@/lib/api/me';
import { ChecklistAndPayment } from '@/components/tasks/ChecklistAndPayment';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorView } from '@/components/ui/ErrorView';
import { ApiError } from '@/lib/api/client';

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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
      <Text className="text-xs font-semibold text-on-surface-variant w-28">{label}</Text>
      <Text className="text-sm text-on-surface flex-1">{value}</Text>
    </View>
  );
}

const STATUS_STEPS = [
  { key: 'assigned',    label: 'Chờ bắt đầu', icon: '🕐' },
  { key: 'moving',     label: 'Đang di chuyển', icon: '🚗' },
  { key: 'arrived',    label: 'Đã đến', icon: '📍' },
  { key: 'in_progress', label: 'Đang làm', icon: '🔧' },
  { key: 'completed',  label: 'Hoàn thành', icon: '✅' },
];

function StatusFlow({ current }: { current: string }) {
  const idx = STATUS_STEPS.findIndex((s) => s.key === current);
  return (
    <View className="flex-row items-center justify-between mb-1">
      {STATUS_STEPS.map((step, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <View key={step.key} className="items-center flex-1">
            <View className={`w-8 h-8 rounded-full items-center justify-center mb-1 ${active ? 'bg-primary' : done ? 'bg-primary/30' : 'bg-surface-container-high'}`}>
              <Text className="text-sm">{step.icon}</Text>
            </View>
            <Text className={`text-[9px] text-center font-semibold ${active ? 'text-primary' : 'text-on-surface-variant'}`} numberOfLines={2}>
              {step.label}
            </Text>
            {i < STATUS_STEPS.length - 1 && (
              <View className={`absolute top-4 left-1/2 h-0.5 w-full ${done ? 'bg-primary/40' : 'bg-surface-container-high'}`} style={{ zIndex: -1 }} />
            )}
          </View>
        );
      })}
    </View>
  );
}

function GpsDistanceBadge({ req }: { req: ServiceRequestSummary }) {
  const [dist, setDist] = useState<number | null>(null);
  const lat = (req as any).location_lat as number | undefined;
  const lng = (req as any).location_lng as number | undefined;

  useEffect(() => {
    if (!lat || !lng) return;
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (!cancelled) setDist(Math.round(haversine(loc.coords.latitude, loc.coords.longitude, lat, lng)));
    })();
    return () => { cancelled = true; };
  }, [lat, lng]);

  if (dist === null || !lat) return null;
  const radius = (req as any).location_radius_m ?? 100;
  const ok = dist <= radius;
  return (
    <View className={`flex-row items-center gap-2 px-4 py-2.5 rounded-xl mb-3 ${ok ? 'bg-success/10' : 'bg-warning/10'}`}>
      <Text className="text-base">{ok ? '✅' : '📡'}</Text>
      <View>
        <Text className={`text-xs font-bold ${ok ? 'text-success' : 'text-warning'}`}>
          {ok ? `Trong phạm vi (${dist}m)` : `Cách ${dist}m — cần trong ${radius}m`}
        </Text>
        <Text className="text-[10px] text-on-surface-variant">GPS tự cập nhật</Text>
      </View>
    </View>
  );
}

function MovingTracker({ req, onArrived }: { req: ServiceRequestSummary; onArrived: () => void }) {
  const [dist, setDist] = useState<number | null>(null);
  const arrivedRef = useRef(false);
  const lat = (req as any).location_lat as number | undefined;
  const lng = (req as any).location_lng as number | undefined;

  useEffect(() => {
    if (!lat || !lng) return;
    let watchSub: Location.LocationSubscription | null = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      watchSub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 },
        (loc) => {
          const d = Math.round(haversine(loc.coords.latitude, loc.coords.longitude, lat, lng));
          setDist(d);
          const radius = (req as any).location_radius_m ?? 100;
          if (d <= radius && !arrivedRef.current) {
            arrivedRef.current = true;
            onArrived();
          }
        },
      );
    })();
    return () => { watchSub?.remove(); };
  }, [lat, lng, req, onArrived]);

  const radius = (req as any).location_radius_m ?? 100;
  return (
    <View className="bg-blue-50 rounded-xl px-4 py-3 mb-3">
      <Text className="text-xs font-bold text-blue-700 mb-1">🚗 Đang di chuyển đến điểm làm việc</Text>
      {dist !== null ? (
        <Text className="text-sm text-blue-600">Còn cách <Text className="font-bold">{dist}m</Text> (phạm vi: {radius}m)</Text>
      ) : (
        <Text className="text-xs text-blue-400">Đang lấy vị trí GPS...</Text>
      )}
    </View>
  );
}

function ActionPanel({ req, onSuccess }: { req: ServiceRequestSummary; onSuccess: () => void }) {
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);

  const lat = (req as any).location_lat as number | undefined;
  const lng = (req as any).location_lng as number | undefined;

  const startMut = useMutation({
    mutationFn: () => meApi.startMoving(req.id),
    onSuccess,
    onError: () => Alert.alert('Lỗi', 'Không thể bắt đầu di chuyển.'),
  });

  const arrivedMut = useMutation({
    mutationFn: () => meApi.markArrived(req.id),
    onSuccess,
    onError: () => Alert.alert('Lỗi', 'Không thể cập nhật trạng thái.'),
  });

  const beginMut = useMutation({
    mutationFn: async () => {
      let gpsLat = lat ?? 0;
      let gpsLng = lng ?? 0;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          gpsLat = loc.coords.latitude;
          gpsLng = loc.coords.longitude;
        }
      } catch {
        // GPS unavailable
      }
      return meApi.beginWork(req.id, gpsLat, gpsLng);
    },
    onSuccess,
    onError: (e: any) => {
      const msg = e?.code === 'GPS_OUT_OF_RANGE' || e?.message?.includes('GPS_OUT_OF_RANGE')
        ? e.message ?? 'Bạn chưa ở đúng vị trí.'
        : 'Xác nhận vị trí thất bại.';
      Alert.alert('Không thể bắt đầu làm', msg);
    },
  });

  async function buildCheckoutForm() {
    const form = new FormData();
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        // @ts-expect-error RN FormData
        form.append('gps_lat', loc.coords.latitude);
        // @ts-expect-error RN FormData
        form.append('gps_lng', loc.coords.longitude);
      }
    } catch {
      // GPS unavailable on web
    }
    if (notes.trim()) form.append('notes', notes.trim());
    if (photoUri) {
      const filename = photoUri.split('/').pop() ?? 'photo.jpg';
      const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpg';
      // @ts-expect-error RN FormData
      form.append('photo', { uri: photoUri, name: filename, type: ext === 'png' ? 'image/png' : 'image/jpeg' });
    }
    return form;
  }

  const checkoutMut = useMutation({
    mutationFn: async () => requestsApi.checkout(req.id, await buildCheckoutForm()),
    onSuccess: () => { onSuccess(); Alert.alert('✅ Hoàn thành', 'Yêu cầu đã hoàn thành!'); },
    onError: (e) => Alert.alert('Lỗi', e instanceof ApiError ? e.message : 'Checkout thất bại.'),
  });

  const rejectMut = useMutation({
    mutationFn: () => meApi.rejectTask(req.id, rejectReason),
    onSuccess: () => { onSuccess(); setShowReject(false); },
    onError: (e) => Alert.alert('Lỗi', e instanceof ApiError ? e.message : 'Thất bại.'),
  });

  async function pickImage(source: 'camera' | 'library') {
    const perm = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') return;
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, allowsEditing: true });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  }

  const { status } = req;
  const loading = startMut.isPending || arrivedMut.isPending || beginMut.isPending || checkoutMut.isPending || rejectMut.isPending;

  return (
    <View>
      {status === 'assigned' && (
        <Section title="Hành động">
          <Pressable onPress={() => startMut.mutate()} disabled={loading}
            className="py-4 rounded-2xl bg-primary items-center active:opacity-80 disabled:opacity-50">
            {startMut.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold text-base">🚗 Bắt đầu di chuyển</Text>}
          </Pressable>
        </Section>
      )}

      {status === 'moving' && (
        <Section title="Hành động">
          <MovingTracker req={req} onArrived={() => arrivedMut.mutate()} />
          <Text className="text-xs text-on-surface-variant text-center mb-3">Tự động cập nhật khi đến nơi</Text>
          <Pressable onPress={() => arrivedMut.mutate()} disabled={loading}
            className="py-3 rounded-xl border border-primary items-center active:opacity-70 disabled:opacity-50">
            {arrivedMut.isPending ? <ActivityIndicator color="#1E40AF" size="small" /> : <Text className="text-primary font-semibold text-sm">📍 Xác nhận đã đến (thủ công)</Text>}
          </Pressable>
        </Section>
      )}

      {status === 'arrived' && (
        <Section title="Xác nhận vị trí">
          <GpsDistanceBadge req={req} />
          <Pressable onPress={() => beginMut.mutate()} disabled={loading}
            className="py-4 rounded-2xl bg-success items-center active:opacity-80 disabled:opacity-50">
            {beginMut.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold text-base">🔧 Bắt đầu làm việc</Text>}
          </Pressable>
        </Section>
      )}

      {status === 'in_progress' && (
        <>
          <ChecklistAndPayment
            taskId={req.id}
            taskTitle={req.description?.substring(0, 60) ?? 'Yêu cầu dịch vụ'}
            tenantId={(req as any).tenant_id ?? ''}
          />
          <Section title="Hoàn thành yêu cầu">
            <TextInput
              className="bg-surface-container-high rounded-xl px-4 py-3 text-sm text-on-surface mb-3"
              placeholder="Ghi chú (tùy chọn)"
              placeholderTextColor="#737685"
              value={notes} onChangeText={setNotes}
              multiline numberOfLines={3} textAlignVertical="top"
            />
            {/* Ảnh hoàn thành */}
            {photoUri ? (
              <View className="mb-3">
                <View style={{ position: 'relative' }}>
                  <RNImage source={{ uri: photoUri }} style={{ width: '100%', height: 200, borderRadius: 16 }} resizeMode="cover" />
                  <Pressable onPress={() => setPhotoUri(null)}
                    style={{ position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 20, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>✕</Text>
                  </Pressable>
                  <Pressable onPress={() => pickImage('camera')}
                    style={{ position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>📷 Chụp lại</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable onPress={() => pickImage('camera')}
                className="mb-3 rounded-2xl border-2 border-dashed border-primary/30 items-center justify-center active:opacity-70"
                style={{ height: 120, backgroundColor: '#eff6ff' }}>
                <Text style={{ fontSize: 32, marginBottom: 6 }}>📷</Text>
                <Text className="text-sm font-semibold text-primary">Chụp ảnh hoàn thành</Text>
                <Text className="text-xs text-on-surface-variant mt-1">Hoặc chọn từ thư viện</Text>
              </Pressable>
            )}
            {!photoUri && (
              <Pressable onPress={() => pickImage('library')} className="mb-3 py-2.5 rounded-xl bg-surface-container-high items-center active:opacity-70">
                <Text className="text-sm font-semibold text-on-surface-variant">🖼 Chọn từ thư viện</Text>
              </Pressable>
            )}
            <Pressable onPress={() => checkoutMut.mutate()} disabled={loading}
              className="py-4 rounded-2xl kinetic-gradient items-center active:opacity-80 disabled:opacity-50">
              {checkoutMut.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold text-base">🏁 Hoàn thành</Text>}
            </Pressable>
          </Section>
        </>
      )}

      {['assigned', 'moving', 'arrived'].includes(status) && (
        <Section title="Từ chối yêu cầu">
          {showReject ? (
            <View className="gap-3">
              <TextInput
                className="bg-surface-container-high rounded-xl px-4 py-3 text-sm text-on-surface"
                placeholder="Lý do từ chối"
                placeholderTextColor="#737685"
                value={rejectReason} onChangeText={setRejectReason}
                multiline numberOfLines={2} textAlignVertical="top"
              />
              <View className="flex-row gap-2">
                <Pressable onPress={() => rejectMut.mutate()} disabled={loading}
                  className="flex-1 bg-error rounded-xl py-3 items-center active:opacity-70 disabled:opacity-50">
                  {rejectMut.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text className="text-on-error font-bold text-sm">Xác nhận từ chối</Text>}
                </Pressable>
                <Pressable onPress={() => { setShowReject(false); setRejectReason(''); }}
                  className="px-4 py-3 rounded-xl bg-surface-container items-center active:opacity-70">
                  <Text className="text-sm text-on-surface-variant">Hủy</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable onPress={() => setShowReject(true)} className="py-3 rounded-xl bg-error-container items-center active:opacity-70">
              <Text className="text-sm font-bold text-on-error-container">✕ Từ chối yêu cầu</Text>
            </Pressable>
          )}
        </Section>
      )}
    </View>
  );
}

export default function StaffTaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['request', id],
    queryFn: () => requestsApi.getById(id),
    select: (d) => d.data,
    refetchInterval: 5000,
  });

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['request', id] });
    qc.invalidateQueries({ queryKey: ['me-tasks'] });
  }, [qc, id]);

  if (isLoading) return <LoadingScreen />;
  if (isError || !data) return <ErrorView onRetry={refetch} />;

  const req = data;
  const isTerminal = ['completed', 'completed_late', 'cancelled'].includes(req.status);

  return (
    <View className="flex-1 bg-surface">
      <View className="glass-effect px-5 pt-14 pb-4">
        <View className="flex-row items-center gap-3 mb-4">
          <Pressable onPress={() => router.back()} className="active:opacity-60">
            <Text className="text-primary font-semibold">← Quay lại</Text>
          </Pressable>
          <Text className="text-lg font-extrabold text-on-surface tracking-tight flex-1" numberOfLines={1}>
            Chi tiết yêu cầu
          </Text>
        </View>
        <StatusFlow current={req.status} />
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        <View className="bg-surface-container-lowest rounded-xl p-5 mb-4">
          <Text className="text-base font-bold text-primary mb-1">{req.category?.name ?? 'Dịch vụ'}</Text>
          <Text className="text-sm text-on-surface-variant leading-relaxed">{req.description}</Text>
        </View>

        <Section title="Thông tin">
          <InfoRow label="Khách hàng" value={req.customer?.full_name} />
          <InfoRow label="Điện thoại" value={req.customer?.phone} />
          <InfoRow label="Địa chỉ" value={(req as any).location_address} />
          <InfoRow label="Lịch hẹn" value={(req as any).scheduled_at ? new Date((req as any).scheduled_at).toLocaleString('vi-VN') : null} />
          {req.agreed_price != null && (
            <InfoRow label="Giá thoả thuận" value={`${Number(req.agreed_price).toLocaleString('vi-VN')}₫`} />
          )}
        </Section>

        {!isTerminal && <ActionPanel req={req} onSuccess={invalidate} />}

        {(req.status === 'completed' || req.status === 'completed_late') && (
          <Section title="Đã hoàn thành">
            <Text className="text-sm text-success font-semibold text-center">
              ✅ Yêu cầu đã hoàn thành{req.collected_amount != null ? ` — Thu: ${Number(req.collected_amount).toLocaleString('vi-VN')}₫` : ''}
            </Text>
          </Section>
        )}

        {req.status === 'cancelled' && (
          <Section title="Trạng thái">
            <Text className="text-sm text-error font-semibold text-center">❌ Yêu cầu đã bị hủy</Text>
          </Section>
        )}

        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
