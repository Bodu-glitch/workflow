import { useState } from 'react';
import { Alert, ActivityIndicator, RefreshControl, Image as RNImage } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { View, Text, Pressable, ScrollView, TextInput } from '@/tw';
import { tasksApi } from '@/lib/api/tasks';
import { StatusBadge, PriorityBadge } from '@/components/ui/StatusBadge';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorView } from '@/components/ui/ErrorView';
import { ApiError } from '@/lib/api/client';

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

async function buildCheckinForm(notes: string, photoUri: string | null): Promise<FormData> {
  const form = new FormData();

  // Get GPS
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status === 'granted') {
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    // @ts-expect-error - FormData accepts string/number
    form.append('gps_lat', loc.coords.latitude);
    // @ts-expect-error
    form.append('gps_lng', loc.coords.longitude);
  }

  if (notes.trim()) form.append('notes', notes.trim());

  if (photoUri) {
    const filename = photoUri.split('/').pop() ?? 'photo.jpg';
    const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpg';
    const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
    // @ts-expect-error - React Native FormData accepts this object
    form.append('photo', { uri: photoUri, name: filename, type: mimeType });
  }

  return form;
}

export default function StaffTaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();

  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['task', id],
    queryFn: () => tasksApi.get(id),
    select: (d) => d.data,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['task', id] });
    qc.invalidateQueries({ queryKey: ['me-tasks'] });
  };

  const checkinMutation = useMutation({
    mutationFn: async () => {
      const form = await buildCheckinForm(notes, photoUri);
      return tasksApi.checkin(id, form);
    },
    onSuccess: () => {
      invalidate();
      setNotes('');
      setPhotoUri(null);
      Alert.alert('Success', 'Checked in successfully!');
    },
    onError: (e) => {
      const msg =
        e instanceof ApiError && e.code === 'GPS_OUT_OF_RANGE'
          ? 'You are too far from the task location. Please move closer.'
          : e instanceof ApiError && e.code === 'TASK_ALREADY_STARTED'
            ? 'Task has already been started.'
            : e instanceof ApiError
              ? e.message
              : 'Check-in failed. Please try again.';
      Alert.alert('Check-in Failed', msg);
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const form = await buildCheckinForm(notes, photoUri);
      return tasksApi.checkout(id, form);
    },
    onSuccess: () => {
      invalidate();
      setNotes('');
      setPhotoUri(null);
      Alert.alert('Success', 'Checked out successfully! Task completed.');
    },
    onError: (e) => {
      const msg =
        e instanceof ApiError && e.code === 'GPS_OUT_OF_RANGE'
          ? 'You are too far from the task location.'
          : e instanceof ApiError
            ? e.message
            : 'Check-out failed.';
      Alert.alert('Check-out Failed', msg);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => tasksApi.reject(id, rejectReason),
    onSuccess: () => {
      invalidate();
      setShowRejectInput(false);
      setRejectReason('');
    },
    onError: (e) => Alert.alert('Error', e instanceof ApiError ? e.message : 'Failed to reject task'),
  });

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  if (isLoading) return <LoadingScreen />;
  if (isError || !data) return <ErrorView onRetry={refetch} />;

  const task = data;
  const canCheckin = task.status === 'todo';
  const canCheckout = task.status === 'in_progress';
  const canReject = task.status === 'todo' || task.status === 'in_progress';
  const isMutating = checkinMutation.isPending || checkoutMutation.isPending;

  return (
    <View className="flex-1 bg-surface">
      {/* Glass Header */}
      <View className="glass-effect px-5 pt-14 pb-4">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} className="active:opacity-60">
            <Text className="text-primary font-semibold">← Back</Text>
          </Pressable>
          <Text className="text-lg font-extrabold text-on-surface tracking-tight flex-1" numberOfLines={1}>
            Task Details
          </Text>
          <View className="flex-row gap-2">
            <StatusBadge status={task.status} />
            {task.priority && <PriorityBadge priority={task.priority} />}
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-5"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {/* Overview */}
        <View className="bg-surface-container-lowest rounded-xl p-5 mb-4">
          <Text className="text-2xl font-extrabold text-on-surface tracking-tight mb-3">{task.title}</Text>
          {task.description ? (
            <Text className="text-sm text-on-surface-variant leading-relaxed">{task.description}</Text>
          ) : null}
          {task.reject_reason && (
            <View className="bg-error-container px-4 py-3 rounded-xl mt-3">
              <Text className="text-xs text-on-error-container font-semibold">Rejected: {task.reject_reason}</Text>
            </View>
          )}
        </View>

        {/* Details */}
        <Section title="Details">
          <InfoRow label="Location" value={task.location_name} />
          {task.location_lat && task.location_lng && (
            <InfoRow label="GPS" value={`${task.location_lat}, ${task.location_lng}${task.location_radius_m ? ` (±${task.location_radius_m}m)` : ''}`} />
          )}
          <InfoRow label="Scheduled" value={task.scheduled_at ? new Date(task.scheduled_at).toLocaleString('vi-VN') : undefined} />
          <InfoRow label="Deadline" value={task.deadline ? new Date(task.deadline).toLocaleString('vi-VN') : undefined} />
        </Section>

        {/* Existing check-in info */}
        {task.checkin && (
          <Section title="Check-in Info">
            <InfoRow label="Time" value={task.checkin.checked_in_at ? new Date(task.checkin.checked_in_at).toLocaleString('vi-VN') : undefined} />
            <InfoRow label="Notes" value={task.checkin.notes} />
            {task.checkin.gps_lat && (
              <InfoRow label="GPS" value={`${task.checkin.gps_lat}, ${task.checkin.gps_lng}`} />
            )}
            {task.checkin.photo_url && (
              <View className="mt-2">
                <Text className="text-xs text-on-surface-variant mb-2">Check-in photo:</Text>
                <RNImage source={{ uri: task.checkin.photo_url }} style={{ width: '100%', height: 160, borderRadius: 12 }} resizeMode="cover" />
              </View>
            )}
          </Section>
        )}

        {/* Check-in / Check-out form */}
        {(canCheckin || canCheckout) && (
          <Section title={canCheckin ? 'Check In' : 'Check Out'}>
            <TextInput
              className="bg-surface-container-high rounded-xl px-4 py-3 text-base text-on-surface mb-3"
              placeholder="Add notes (optional)"
              placeholderTextColor="#737685"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />

            <View className="flex-row gap-2 mb-3">
              <Pressable onPress={takePhoto} className="flex-1 py-2.5 rounded-xl bg-surface-container-high items-center active:opacity-70">
                <Text className="text-sm text-on-surface font-semibold">📷 Camera</Text>
              </Pressable>
              <Pressable onPress={pickPhoto} className="flex-1 py-2.5 rounded-xl bg-surface-container-high items-center active:opacity-70">
                <Text className="text-sm text-on-surface font-semibold">🖼 Gallery</Text>
              </Pressable>
            </View>

            {photoUri && (
              <View className="mb-3">
                <RNImage source={{ uri: photoUri }} style={{ width: '100%', height: 160, borderRadius: 12 }} resizeMode="cover" />
                <Pressable onPress={() => setPhotoUri(null)} className="absolute top-2 right-2 bg-black/50 rounded-full w-7 h-7 items-center justify-center">
                  <Text className="text-white text-xs font-bold">✕</Text>
                </Pressable>
              </View>
            )}

            {task.location_radius_m && (
              <View className="bg-secondary-container rounded-xl px-3 py-2 mb-3">
                <Text className="text-xs text-on-secondary-container">
                  📍 GPS required — within {task.location_radius_m}m of task location
                </Text>
              </View>
            )}

            <Pressable
              onPress={() => canCheckin ? checkinMutation.mutate() : checkoutMutation.mutate()}
              disabled={isMutating}
              className={`py-4 rounded-2xl items-center active:opacity-80 disabled:opacity-50 ${canCheckin ? 'bg-success' : 'kinetic-gradient'}`}
            >
              {isMutating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold text-base">
                  {canCheckin ? '✅ Check In' : '🏁 Check Out'}
                </Text>
              )}
            </Pressable>
          </Section>
        )}

        {/* Reject */}
        {canReject && (
          <Section title="Reject Task">
            {showRejectInput ? (
              <View className="gap-3">
                <TextInput
                  className="bg-surface-container-high rounded-xl px-4 py-3 text-base text-on-surface"
                  placeholder="Reason for rejection"
                  placeholderTextColor="#737685"
                  value={rejectReason}
                  onChangeText={setRejectReason}
                  multiline
                  numberOfLines={2}
                  textAlignVertical="top"
                />
                <View className="flex-row gap-2">
                  <Pressable onPress={() => rejectMutation.mutate()} disabled={rejectMutation.isPending} className="flex-1 bg-error rounded-xl py-3 items-center active:opacity-70 disabled:opacity-50">
                    {rejectMutation.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text className="text-on-error font-bold">Confirm Reject</Text>}
                  </Pressable>
                  <Pressable onPress={() => { setShowRejectInput(false); setRejectReason(''); }} className="px-4 py-3 rounded-xl bg-surface-container items-center active:opacity-70">
                    <Text className="text-sm text-on-surface-variant">Cancel</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable onPress={() => setShowRejectInput(true)} className="py-3 rounded-xl bg-error-container items-center active:opacity-70">
                <Text className="text-sm font-bold text-on-error-container">✕ Reject This Task</Text>
              </Pressable>
            )}
          </Section>
        )}

        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
