import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, ActivityIndicator, RefreshControl, Image as RNImage } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { View, Text, Pressable, ScrollView, TextInput } from '@/tw';
import { tasksApi } from '@/lib/api/tasks';
import { meApi } from '@/lib/api/me';
import { ChecklistAndPayment } from '@/components/tasks/ChecklistAndPayment';
import { StatusBadge, PriorityBadge } from '@/components/ui/StatusBadge';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorView } from '@/components/ui/ErrorView';
import { ApiError } from '@/lib/api/client';
import type { Task } from '@/types/api';

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Status flow banner ────────────────────────────────────────────────────────
const STATUS_STEPS = [
  { key: 'todo',        label: 'Chờ bắt đầu', icon: '🕐' },
  { key: 'moving',      label: 'Đang di chuyển', icon: '🚗' },
  { key: 'arrived',     label: 'Đã đến', icon: '📍' },
  { key: 'in_progress', label: 'Đang làm', icon: '🔧' },
  { key: 'done',        label: 'Hoàn thành', icon: '✅' },
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

// ── GPS distance badge ────────────────────────────────────────────────────────
function GpsDistanceBadge({ task }: { task: Task }) {
  const [dist, setDist] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (!cancelled && task.location_lat && task.location_lng) {
        setDist(Math.round(haversine(loc.coords.latitude, loc.coords.longitude, task.location_lat, task.location_lng)));
      }
    })();
    return () => { cancelled = true; };
  }, [task.location_lat, task.location_lng]);

  if (dist === null || !task.location_lat) return null;
  const radius = task.location_radius_m ?? 100;
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

// ── Moving tracker (auto-detect arrival) ─────────────────────────────────────
function MovingTracker({ task, onArrived }: { task: Task; onArrived: () => void }) {
  const [dist, setDist] = useState<number | null>(null);
  const arrivedRef = useRef(false);

  useEffect(() => {
    if (!task.location_lat || !task.location_lng) return;
    let watchSub: Location.LocationSubscription | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      watchSub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 },
        (loc) => {
          const d = Math.round(haversine(loc.coords.latitude, loc.coords.longitude, task.location_lat!, task.location_lng!));
          setDist(d);
          const radius = task.location_radius_m ?? 100;
          if (d <= radius && !arrivedRef.current) {
            arrivedRef.current = true;
            onArrived();
          }
        },
      );
    })();

    return () => { watchSub?.remove(); };
  }, [task.location_lat, task.location_lng, task.location_radius_m, onArrived]);

  const radius = task.location_radius_m ?? 100;
  return (
    <View className="bg-blue-50 rounded-xl px-4 py-3 mb-3">
      <Text className="text-xs font-bold text-blue-700 mb-1">🚗 Đang di chuyển đến điểm làm việc</Text>
      {dist !== null ? (
        <Text className="text-sm text-blue-600">
          Còn cách <Text className="font-bold">{dist}m</Text> (phạm vi: {radius}m)
        </Text>
      ) : (
        <Text className="text-xs text-blue-400">Đang lấy vị trí GPS...</Text>
      )}
    </View>
  );
}

// ── Action buttons per status ─────────────────────────────────────────────────
function ActionPanel({ task, onSuccess }: { task: Task; onSuccess: () => void }) {
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [collectedAmount, setCollectedAmount] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [checklistTotal, setChecklistTotal] = useState(0);

  const startMut = useMutation({
    mutationFn: () => meApi.startMoving(task.id),
    onSuccess,
    onError: () => Alert.alert('Lỗi', 'Không thể bắt đầu di chuyển.'),
  });

  const arrivedMut = useMutation({
    mutationFn: () => meApi.markArrived(task.id),
    onSuccess,
    onError: () => Alert.alert('Lỗi', 'Không thể cập nhật trạng thái.'),
  });

  const beginMut = useMutation({
    mutationFn: async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') throw new Error('NO_GPS');
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      return meApi.beginWork(task.id, loc.coords.latitude, loc.coords.longitude);
    },
    onSuccess,
    onError: (e: any) => {
      const msg = e?.code === 'GPS_OUT_OF_RANGE' || e?.message?.includes('GPS_OUT_OF_RANGE')
        ? e.message ?? 'Bạn chưa ở đúng vị trí nhiệm vụ.'
        : e?.message === 'NO_GPS' ? 'Cần bật GPS để xác nhận vị trí.' : 'Xác nhận vị trí thất bại.';
      Alert.alert('Không thể bắt đầu làm', msg);
    },
  });

  const supportMutation = {
    mutate: () => router.push(`/chat?pendingTaskId=${id}&pendingTaskTitle=${encodeURIComponent(task?.title ?? '')}` as any),
    isPending: false,
  };

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access');
      return;
  async function buildCheckoutForm() {
    const form = new FormData();
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      // @ts-expect-error RN FormData
      form.append('gps_lat', loc.coords.latitude);
      // @ts-expect-error RN FormData
      form.append('gps_lng', loc.coords.longitude);
    }
    if (notes.trim()) form.append('notes', notes.trim());
    if (collectedAmount.trim()) form.append('collected_amount', collectedAmount.trim());
    if (photoUri) {
      const filename = photoUri.split('/').pop() ?? 'photo.jpg';
      const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpg';
      // @ts-expect-error RN FormData
      form.append('photo', { uri: photoUri, name: filename, type: ext === 'png' ? 'image/png' : 'image/jpeg' });
    }
    return form;
  }

  const checkoutMut = useMutation({
    mutationFn: async () => tasksApi.checkout(task.id, await buildCheckoutForm()),
    onSuccess: () => { onSuccess(); Alert.alert('✅ Hoàn thành', 'Nhiệm vụ đã hoàn thành!'); },
    onError: (e) => Alert.alert('Lỗi', e instanceof ApiError ? e.message : 'Checkout thất bại.'),
  });

  const rejectMut = useMutation({
    mutationFn: () => tasksApi.reject(task.id, rejectReason),
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

  const { status } = task;
  const loading = startMut.isPending || arrivedMut.isPending || beginMut.isPending || checkoutMut.isPending || rejectMut.isPending;

  return (
    <View>
      {/* ── todo: Bắt đầu di chuyển ── */}
      {status === 'todo' && (
        <Section title="Hành động">
          <Pressable onPress={() => startMut.mutate()} disabled={loading}
            className="py-4 rounded-2xl bg-primary items-center active:opacity-80 disabled:opacity-50">
            {startMut.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold text-base">🚗 Bắt đầu di chuyển</Text>}
          </Pressable>
        </Section>
      )}

      {/* ── moving: auto GPS + manual fallback ── */}
      {status === 'moving' && (
        <Section title="Hành động">
          <MovingTracker task={task} onArrived={() => arrivedMut.mutate()} />
          <Text className="text-xs text-on-surface-variant text-center mb-3">Tự động cập nhật khi đến nơi</Text>
          <Pressable onPress={() => arrivedMut.mutate()} disabled={loading}
            className="py-3 rounded-xl border border-primary items-center active:opacity-70 disabled:opacity-50">
            {arrivedMut.isPending ? <ActivityIndicator color="#1E40AF" size="small" /> : <Text className="text-primary font-semibold text-sm">📍 Xác nhận đã đến (thủ công)</Text>}
          </Pressable>
        </Section>
      )}

      {/* ── arrived: xác nhận vị trí GPS ── */}
      {status === 'arrived' && (
        <Section title="Xác nhận vị trí">
          <GpsDistanceBadge task={task} />
          <Pressable onPress={() => beginMut.mutate()} disabled={loading}
            className="py-4 rounded-2xl bg-success items-center active:opacity-80 disabled:opacity-50">
            {beginMut.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold text-base">🔧 Bắt đầu làm việc</Text>}
          </Pressable>
        </Section>
      )}

      {/* ── in_progress: check-out ── */}
      {status === 'in_progress' && (
        <>
        <ChecklistAndPayment
          taskId={task.id}
          taskTitle={task.title}
          tenantId={(task as any).tenant_id ?? ''}
          onChange={(_, total) => setChecklistTotal(total)}
        />
        <Section title="Hoàn thành nhiệm vụ">
          <TextInput
            className="bg-surface-container-high rounded-xl px-4 py-3 text-sm text-on-surface mb-3"
            placeholder="Ghi chú (tùy chọn)"
            placeholderTextColor="#737685"
            value={notes} onChangeText={setNotes}
            multiline numberOfLines={3} textAlignVertical="top"
          />
          <TextInput
            className="bg-surface-container-high rounded-xl px-4 py-3 text-sm text-on-surface mb-3"
            placeholder="Số tiền thu được (VNĐ)"
            placeholderTextColor="#737685"
            value={collectedAmount} onChangeText={setCollectedAmount}
            keyboardType="numeric"
          />
          <View className="flex-row gap-2 mb-3">
            <Pressable onPress={() => pickImage('camera')} className="flex-1 py-2.5 rounded-xl bg-surface-container-high items-center active:opacity-70">
              <Text className="text-sm font-semibold">📷 Camera</Text>
            </Pressable>
            <Pressable onPress={() => pickImage('library')} className="flex-1 py-2.5 rounded-xl bg-surface-container-high items-center active:opacity-70">
              <Text className="text-sm font-semibold">🖼 Thư viện</Text>
            </Pressable>
          </View>
          {photoUri && (
            <View className="mb-3 relative">
              <RNImage source={{ uri: photoUri }} style={{ width: '100%', height: 160, borderRadius: 12 }} resizeMode="cover" />
              <Pressable onPress={() => setPhotoUri(null)} className="absolute top-2 right-2 bg-black/50 rounded-full w-7 h-7 items-center justify-center">
                <Text className="text-white text-xs font-bold">✕</Text>
              </Pressable>
            </View>
          )}
          <Pressable onPress={() => checkoutMut.mutate()} disabled={loading}
            className="py-4 rounded-2xl kinetic-gradient items-center active:opacity-80 disabled:opacity-50">
            {checkoutMut.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold text-base">🏁 Hoàn thành</Text>}
          </Pressable>
        </Section>
        </>
      )}

      {/* ── Reject (todo / moving / arrived) ── */}
      {['todo', 'moving', 'arrived'].includes(status) && (
        <Section title="Từ chối nhiệm vụ">
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
              <Text className="text-sm font-bold text-on-error-container">✕ Từ chối nhiệm vụ</Text>
            </Pressable>
          )}
        </Section>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function StaffTaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['task', id],
    queryFn: () => tasksApi.get(id),
    select: (d) => d.data,
    refetchInterval: 5000, // keep status in sync
  });

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['task', id] });
    qc.invalidateQueries({ queryKey: ['me-tasks'] });
  }, [qc, id]);

  if (isLoading) return <LoadingScreen />;
  if (isError || !data) return <ErrorView onRetry={refetch} />;

  const task = data;

  return (
    <View className="flex-1 bg-surface">
      {/* Header */}
      <View className="glass-effect px-5 pt-14 pb-4">
        <View className="flex-row items-center gap-3 mb-4">
          <Pressable onPress={() => router.back()} className="active:opacity-60">
            <Text className="text-primary font-semibold">← Quay lại</Text>
          </Pressable>
          <Text className="text-lg font-extrabold text-on-surface tracking-tight flex-1" numberOfLines={1}>
            Chi tiết nhiệm vụ
          </Text>
          {task.priority && <PriorityBadge priority={task.priority} />}
        </View>
        <StatusFlow current={task.status} />
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {/* Title + description */}
        <View className="bg-surface-container-lowest rounded-xl p-5 mb-4">
          <Text className="text-2xl font-extrabold text-on-surface tracking-tight mb-2">{task.title}</Text>
          {task.description ? (
            <Text className="text-sm text-on-surface-variant leading-relaxed">{task.description}</Text>
          ) : null}
        </View>

        {/* Details */}
        <Section title="Thông tin">
          <InfoRow label="Địa điểm" value={task.location_name} />
          <InfoRow label="Lịch hẹn" value={task.scheduled_at ? new Date(task.scheduled_at).toLocaleString('vi-VN') : undefined} />
          <InfoRow label="Hạn chót" value={task.deadline ? new Date(task.deadline).toLocaleString('vi-VN') : undefined} />
          {task.location_lat && task.location_lng && (
            <InfoRow label="Tọa độ" value={`${task.location_lat.toFixed(6)}, ${task.location_lng.toFixed(6)}`} />
          )}
        </Section>

        {/* Actions */}
        {!['done', 'cancelled', 'rejected'].includes(task.status) && (
          <ActionPanel task={task} onSuccess={invalidate} />
        )}

        {/* Completed / rejected view */}
        {task.status === 'done' && (
          <Section title="Đã hoàn thành">
            <Text className="text-sm text-success font-semibold text-center">✅ Nhiệm vụ đã hoàn thành</Text>
          </Section>
        )}
        {(task.status === 'cancelled' || task.status === 'rejected') && (
          <Section title="Trạng thái">
            <StatusBadge status={task.status} />
          </Section>
        )}

        {/* Hỗ trợ */}
        <Section title="Cần hỗ trợ?">
          <Pressable
            onPress={() => supportMutation.mutate()}
            disabled={supportMutation.isPending}
            className="py-3 rounded-xl bg-secondary-container items-center active:opacity-70 disabled:opacity-50"
          >
            {supportMutation.isPending
              ? <ActivityIndicator color="#1E40AF" size="small" />
              : <Text className="text-sm font-bold text-on-secondary-container">🆘 Yêu cầu hỗ trợ</Text>
            }
          </Pressable>
        </Section>

        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
