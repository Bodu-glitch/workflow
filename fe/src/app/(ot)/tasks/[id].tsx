// OT Task Detail — same as BO but navigates within (ot) routes
import { useState, useEffect } from 'react';
import { Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { View, Text, Pressable, ScrollView, TextInput } from '@/tw';
import { tasksApi } from '@/lib/api/tasks';
import { auditApi } from '@/lib/api/audit';
import { StatusBadge, PriorityBadge } from '@/components/ui/StatusBadge';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorView } from '@/components/ui/ErrorView';
import { ApiError } from '@/lib/api/client';
import { StaffPickerModal } from '@/components/tasks/StaffPickerModal';

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

export default function OTTaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const navigation = useNavigation();
  const [reason, setReason] = useState('');

  // Khi user switch sang tab khác → tự back về task list
  // Dùng flag `backing` để tránh state listener fire 2 lần gây lỗi GO_BACK
  useEffect(() => {
    const parent = navigation.getParent();
    if (!parent) return;
    let backing = false;
    const unsubscribe = parent.addListener('state', () => {
      if (backing) return;
      const state = parent.getState();
      const activeRouteName = state?.routes[state.index]?.name;
      if (activeRouteName !== 'tasks') {
        backing = true;
        router.back();
      }
    });
    return unsubscribe;
  }, [navigation]);
  const [showCancelInput, setShowCancelInput] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [showStaffPicker, setShowStaffPicker] = useState(false);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['task', id],
    queryFn: () => tasksApi.get(id),
    select: (d) => d.data,
  });

  const { data: auditData } = useQuery({
    queryKey: ['audit-task', id],
    queryFn: () => auditApi.byTask(id),
    select: (d) => d.data,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['task', id] });
    qc.invalidateQueries({ queryKey: ['tasks'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const cancelMutation = useMutation({
    mutationFn: () => tasksApi.cancel(id, reason),
    onSuccess: () => { invalidate(); setShowCancelInput(false); setReason(''); },
    onError: (e) => Alert.alert('Error', e instanceof ApiError ? e.message : 'Failed to cancel'),
  });

  const rejectMutation = useMutation({
    mutationFn: () => tasksApi.reject(id, reason),
    onSuccess: () => { invalidate(); setShowRejectInput(false); setReason(''); },
    onError: (e) => Alert.alert('Error', e instanceof ApiError ? e.message : 'Failed to reject'),
  });

  const unassignMutation = useMutation({
    mutationFn: (staffId: string) => tasksApi.unassign(id, staffId),
    onSuccess: invalidate,
    onError: (e) => Alert.alert('Error', e instanceof ApiError ? e.message : 'Failed to unassign'),
  });

  async function handleStaffPickerConfirm(selectedIds: string[]) {
    try {
      const currentIds = new Set((data?.assignees ?? []).map((a: any) => a.id));
      const toAdd = selectedIds.filter((sid) => !currentIds.has(sid));
      const toRemove = [...currentIds].filter((cid) => !selectedIds.includes(cid as string));
      if (toAdd.length > 0) await tasksApi.assign(id, toAdd);
      for (const sid of toRemove) await tasksApi.unassign(id, sid as string);
      invalidate();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to update assignees');
    } finally {
      setShowStaffPicker(false);
    }
  }

  if (isLoading) return <LoadingScreen />;
  if (isError || !data) return <ErrorView onRetry={refetch} />;

  const task = data;
  const assignedIds = (task.assignees ?? []).map((a: any) => a.id);
  const canModify = task.status !== 'cancelled' && task.status !== 'rejected' && task.status !== 'done';

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
          {canModify && (
            <Pressable onPress={() => router.push({ pathname: '/(ot)/tasks/create', params: { id: task.id } })} className="active:opacity-60">
              <Text className="text-primary font-semibold text-sm">Edit</Text>
            </Pressable>
          )}
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
            <Text className="text-sm text-on-surface-variant leading-relaxed mb-4">{task.description}</Text>
          ) : null}
          {(task.cancel_reason || task.reject_reason) && (
            <View className="bg-error-container px-4 py-3 rounded-xl mt-2">
              <Text className="text-xs text-on-error-container font-semibold">
                {task.cancel_reason ? `Cancel reason: ${task.cancel_reason}` : `Reject reason: ${task.reject_reason}`}
              </Text>
            </View>
          )}
        </View>

        <Section title="Details">
          <InfoRow label="Location" value={task.location_name} />
          {task.location_lat && task.location_lng && (
            <InfoRow label="GPS" value={`${task.location_lat}, ${task.location_lng}${task.location_radius_m ? ` (±${task.location_radius_m}m)` : ''}`} />
          )}
          <InfoRow label="Scheduled" value={task.scheduled_at ? new Date(task.scheduled_at).toLocaleString('vi-VN') : undefined} />
          <InfoRow label="Deadline" value={task.deadline ? new Date(task.deadline).toLocaleString('vi-VN') : undefined} />
          <InfoRow label="Created" value={new Date(task.created_at).toLocaleString('vi-VN')} />
        </Section>

        {(task.checkin || task.checkout) && (
          <Section title="Check-in / Check-out">
            {task.checkin && (
              <View className="mb-4">
                <View className="flex-row items-center gap-2 mb-3">
                  <View className="w-2 h-2 rounded-full bg-success" />
                  <Text className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Check-in</Text>
                </View>
                <InfoRow label="Time" value={task.checkin.checked_in_at ? new Date(task.checkin.checked_in_at).toLocaleString('vi-VN') : undefined} />
                <InfoRow label="Notes" value={task.checkin.notes} />
                {task.checkin.gps_lat && <InfoRow label="GPS" value={`${task.checkin.gps_lat}, ${task.checkin.gps_lng}`} />}
                {task.checkin.photo_url && <Text className="text-xs text-primary mt-1">📷 Photo attached</Text>}
              </View>
            )}
            {task.checkout && (
              <View>
                <View className="flex-row items-center gap-2 mb-3">
                  <View className="w-2 h-2 rounded-full bg-primary" />
                  <Text className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Check-out</Text>
                </View>
                <InfoRow label="Time" value={task.checkout.checked_out_at ? new Date(task.checkout.checked_out_at).toLocaleString('vi-VN') : undefined} />
                <InfoRow label="Notes" value={task.checkout.notes} />
              </View>
            )}
          </Section>
        )}

        {/* Assignees */}
        <Section title="Assigned Staff">
          {(task.assignees?.length ?? 0) === 0 ? (
            <Text className="text-sm text-on-surface-variant mb-3">No assignees</Text>
          ) : (
            task.assignees!.map((a: any) => (
              <View key={a.id} className="flex-row items-center justify-between py-2.5">
                <View className="flex-row items-center gap-3">
                  <View className="w-8 h-8 rounded-full bg-surface-container-high items-center justify-center">
                    <Text className="text-xs font-bold text-primary">{a.full_name.charAt(0)}</Text>
                  </View>
                  <Text className="text-sm font-semibold text-on-surface">{a.full_name}</Text>
                </View>
                {canModify && (
                  <Pressable onPress={() => unassignMutation.mutate(a.id)} className="active:opacity-60">
                    <Text className="text-xs font-semibold text-error">Remove</Text>
                  </Pressable>
                )}
              </View>
            ))
          )}
          {canModify && (
            <Pressable
              onPress={() => setShowStaffPicker(true)}
              className="mt-2 h-11 rounded-xl flex-row items-center justify-center gap-2 active:opacity-80"
              style={{ backgroundColor: '#1E40AF' }}
            >
              <Text className="text-white font-bold text-sm">+ Assign Staff</Text>
            </Pressable>
          )}
        </Section>

        {canModify && (
          <Section title="Actions">
            {showCancelInput ? (
              <View className="gap-3 mb-3">
                <TextInput className="bg-surface-container-high rounded-xl px-4 py-3 text-sm text-on-surface" placeholder="Cancel reason (optional)" placeholderTextColor="#737685" value={reason} onChangeText={setReason} />
                <View className="flex-row gap-3">
                  <Pressable onPress={() => cancelMutation.mutate()} disabled={cancelMutation.isPending} className="flex-1 bg-surface-container-high rounded-xl py-3 items-center active:opacity-70">
                    {cancelMutation.isPending ? <ActivityIndicator size="small" /> : <Text className="text-sm font-bold text-on-surface">Confirm Cancel</Text>}
                  </Pressable>
                  <Pressable onPress={() => { setShowCancelInput(false); setReason(''); }} className="px-4 py-3 rounded-xl bg-surface-container items-center active:opacity-70">
                    <Text className="text-sm text-on-surface-variant">Dismiss</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable onPress={() => { setShowCancelInput(true); setShowRejectInput(false); setReason(''); }} className="py-3 rounded-xl bg-surface-container-high items-center mb-3 active:opacity-70">
                <Text className="text-sm font-bold text-on-surface">Cancel Task</Text>
              </Pressable>
            )}

            {showRejectInput ? (
              <View className="gap-3">
                <TextInput className="bg-surface-container-high rounded-xl px-4 py-3 text-sm text-on-surface" placeholder="Reject reason (optional)" placeholderTextColor="#737685" value={reason} onChangeText={setReason} />
                <View className="flex-row gap-3">
                  <Pressable onPress={() => rejectMutation.mutate()} disabled={rejectMutation.isPending} className="flex-1 bg-error rounded-xl py-3 items-center active:opacity-70">
                    {rejectMutation.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text className="text-sm font-bold text-on-error">Confirm Reject</Text>}
                  </Pressable>
                  <Pressable onPress={() => { setShowRejectInput(false); setReason(''); }} className="px-4 py-3 rounded-xl bg-surface-container items-center active:opacity-70">
                    <Text className="text-sm text-on-surface-variant">Dismiss</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable onPress={() => { setShowRejectInput(true); setShowCancelInput(false); setReason(''); }} className="py-3 rounded-xl bg-error-container items-center active:opacity-70">
                <Text className="text-sm font-bold text-on-error-container">Reject Task</Text>
              </Pressable>
            )}
          </Section>
        )}

        {auditData && auditData.length > 0 && (
          <Section title="Activity Log">
            {auditData.map((log) => (
              <View key={log.id} className="flex-row mb-4">
                <View className="w-2 h-2 rounded-full bg-primary mt-1.5 mr-3" />
                <View className="flex-1">
                  <Text className="text-xs font-bold text-on-surface">{log.actor_name}</Text>
                  <Text className="text-xs text-on-surface-variant capitalize mt-0.5">{log.action.replace(/_/g, ' ')}</Text>
                  <Text className="text-xs text-outline mt-0.5">{new Date(log.created_at).toLocaleString('vi-VN')}</Text>
                </View>
              </View>
            ))}
          </Section>
        )}

        <View className="h-8" />
      </ScrollView>

      <StaffPickerModal
        visible={showStaffPicker}
        selected={assignedIds}
        onConfirm={(ids) => handleStaffPickerConfirm(ids)}
        onClose={() => setShowStaffPicker(false)}
      />
    </View>
  );
}
