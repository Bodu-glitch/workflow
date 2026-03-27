// OT create task — same functionality as BO
// Re-exports BO create screen logic with OT-specific navigation paths

import { useState, useEffect } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { View, Text, TextInput, Pressable, ScrollView } from '@/tw';
import { tasksApi } from '@/lib/api/tasks';
import { staffApi } from '@/lib/api/staff';
import { ApiError } from '@/lib/api/client';
import type { TaskPriority } from '@/types/api';
import { LocationPickerModal } from '@/components/LocationPickerModal';
import type { PickedLocation } from '@/components/LocationPickerModal';

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];

export default function OTTaskCreateScreen() {
  const { id: editId } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!editId;
  const qc = useQueryClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority | undefined>();
  const [pickedLocation, setPickedLocation] = useState<PickedLocation | null>(null);
  const [locationRadius, setLocationRadius] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [deadline, setDeadline] = useState('');
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const editQuery = useQuery({
    queryKey: ['task', editId],
    queryFn: () => tasksApi.get(editId!),
    enabled: isEditing,
    select: (d) => d.data,
  });

  useEffect(() => {
    const task = editQuery.data;
    if (!task) return;
    setTitle(task.title ?? '');
    setDescription(task.description ?? '');
    setPriority(task.priority);
    if (task.location_lat != null && task.location_lng != null) {
      setPickedLocation({ name: task.location_name ?? '', lat: task.location_lat, lng: task.location_lng });
    } else {
      setPickedLocation(null);
    }
    setLocationRadius(task.location_radius_m?.toString() ?? '');
    setScheduledAt(task.scheduled_at ? task.scheduled_at.slice(0, 16) : '');
    setDeadline(task.deadline ? task.deadline.slice(0, 16) : '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editQuery.data?.id]);

  const { data: staffData } = useQuery({
    queryKey: ['staff'],
    queryFn: () => staffApi.list(),
  });
  const staffList = staffData?.data ?? [];

  const createMutation = useMutation({
    mutationFn: () =>
      tasksApi.create({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        location_name: pickedLocation?.name || undefined,
        location_lat: pickedLocation?.lat,
        location_lng: pickedLocation?.lng,
        location_radius_m: locationRadius ? parseInt(locationRadius) : undefined,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        deadline: deadline ? new Date(deadline).toISOString() : undefined,
        assignee_ids: selectedStaff.length > 0 ? selectedStaff : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      router.back();
    },
    onError: (e) => Alert.alert('Error', e instanceof ApiError ? e.message : 'Failed to create task'),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      tasksApi.update(editId!, {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        location_name: pickedLocation?.name || undefined,
        location_lat: pickedLocation?.lat,
        location_lng: pickedLocation?.lng,
        location_radius_m: locationRadius ? parseInt(locationRadius) : undefined,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        deadline: deadline ? new Date(deadline).toISOString() : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['task', editId] });
      router.back();
    },
    onError: (e) => Alert.alert('Error', e instanceof ApiError ? e.message : 'Failed to update task'),
  });

  function handleSubmit() {
    if (!title.trim()) { Alert.alert('Error', 'Title is required'); return; }
    isEditing ? updateMutation.mutate() : createMutation.mutate();
  }

  const isMutating = createMutation.isPending || updateMutation.isPending;

  const PRIORITY_COLORS: Record<TaskPriority, string> = {
    low:    'bg-success-container',
    medium: 'bg-secondary-container',
    high:   'bg-warning-container',
    urgent: 'bg-error-container',
  };

  function FieldLabel({ children }: { children: React.ReactNode }) {
    return (
      <Text className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
        {children}
      </Text>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <View className="flex-1 bg-surface">
        {/* Glass Header */}
        <View className="glass-effect px-5 pt-14 pb-4 flex-row items-center">
          <Pressable onPress={() => router.back()} className="mr-3 active:opacity-60">
            <Text className="text-primary font-semibold">← Back</Text>
          </Pressable>
          <Text className="text-xl font-extrabold text-on-surface tracking-tight flex-1">
            {isEditing ? 'Edit Task' : 'Create Task'}
          </Text>
        </View>

        <ScrollView className="flex-1" contentContainerClassName="px-4 py-5 gap-5">
          <View>
            <FieldLabel>Title *</FieldLabel>
            <TextInput className="w-full h-14 px-4 bg-surface-container-high rounded-xl text-on-surface text-base" placeholder="Task title" placeholderTextColor="#737685" value={title} onChangeText={setTitle} />
          </View>
          <View>
            <FieldLabel>Description</FieldLabel>
            <TextInput className="w-full px-4 py-3 bg-surface-container-high rounded-xl text-on-surface text-base" style={{ height: 88 }} placeholder="Task description" placeholderTextColor="#737685" value={description} onChangeText={setDescription} multiline textAlignVertical="top" />
          </View>
          <View>
            <FieldLabel>Priority</FieldLabel>
            <View className="flex-row gap-2">
              {PRIORITIES.map((p) => {
                const active = priority === p;
                return (
                  <Pressable key={p} onPress={() => setPriority(active ? undefined : p)} className={`flex-1 py-2.5 rounded-xl items-center ${active ? 'kinetic-gradient' : PRIORITY_COLORS[p]}`}>
                    <Text className={`text-xs font-bold capitalize ${active ? 'text-on-primary' : 'text-on-surface'}`}>{p}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View>
            <FieldLabel>Location</FieldLabel>
            <View className="gap-2">
              {pickedLocation && (
                <View className="flex-row items-center bg-surface-container-high rounded-xl px-4 py-3">
                  <Text className="mr-2">📍</Text>
                  <Text className="flex-1 text-sm text-on-surface" numberOfLines={2}>
                    {pickedLocation.name || 'Vị trí đã chọn'}
                  </Text>
                  <Pressable onPress={() => setPickedLocation(null)} className="pl-2 active:opacity-60">
                    <Text className="text-on-surface-variant text-xs">✕</Text>
                  </Pressable>
                </View>
              )}
              <Pressable
                onPress={() => setShowLocationPicker(true)}
                className="h-12 px-4 bg-surface-container-high rounded-xl flex-row items-center active:opacity-70"
              >
                <Text className="flex-1 text-on-surface-variant">
                  {pickedLocation ? 'Thay đổi vị trí...' : 'Chọn trên bản đồ...'}
                </Text>
                <Text>🗺️</Text>
              </Pressable>
              <TextInput className="w-full h-12 px-4 bg-surface-container-high rounded-xl text-on-surface text-base" placeholder="GPS radius (meters)" placeholderTextColor="#737685" value={locationRadius} onChangeText={setLocationRadius} keyboardType="number-pad" />
            </View>
          </View>
          <LocationPickerModal
            visible={showLocationPicker}
            onClose={() => setShowLocationPicker(false)}
            onConfirm={(loc) => { setPickedLocation(loc); setShowLocationPicker(false); }}
            initialLat={pickedLocation?.lat}
            initialLng={pickedLocation?.lng}
            initialName={pickedLocation?.name}
          />
          <View>
            <FieldLabel>Scheduled At</FieldLabel>
            <TextInput className="w-full h-12 px-4 bg-surface-container-high rounded-xl text-on-surface text-base" placeholder="2026-03-20T08:00" placeholderTextColor="#737685" value={scheduledAt} onChangeText={setScheduledAt} />
          </View>
          <View>
            <FieldLabel>Deadline</FieldLabel>
            <TextInput className="w-full h-12 px-4 bg-surface-container-high rounded-xl text-on-surface text-base" placeholder="2026-03-20T17:00" placeholderTextColor="#737685" value={deadline} onChangeText={setDeadline} />
          </View>
          {!isEditing && staffList.length > 0 && (
            <View>
              <FieldLabel>Assign Staff</FieldLabel>
              <View className="gap-2">
                {staffList.map((s) => {
                  const selected = selectedStaff.includes(s.id);
                  return (
                    <Pressable key={s.id} onPress={() => setSelectedStaff((prev) => selected ? prev.filter((x) => x !== s.id) : [...prev, s.id])} className={`flex-row items-center px-4 py-3 rounded-xl ${selected ? 'bg-primary' : 'bg-surface-container-high'}`}>
                      <View className={`w-5 h-5 rounded-full mr-3 items-center justify-center ${selected ? 'bg-on-primary' : 'bg-surface-container-highest'}`}>
                        {selected && <Text className="text-primary text-xs font-bold">✓</Text>}
                      </View>
                      <View>
                        <Text className={`text-sm font-semibold ${selected ? 'text-on-primary' : 'text-on-surface'}`}>{s.full_name}</Text>
                        <Text className={`text-xs ${selected ? 'text-on-primary' : 'text-on-surface-variant'}`} style={{ opacity: 0.7 }}>{s.email}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
          <Pressable onPress={handleSubmit} disabled={isMutating} className="kinetic-gradient rounded-2xl py-4 items-center mt-2 active:opacity-80 disabled:opacity-50">
            {isMutating ? <ActivityIndicator color="#fff" /> : <Text className="text-on-primary font-bold text-base">{isEditing ? 'Save Changes' : 'Create Task'}</Text>}
          </Pressable>
          <View className="h-4" />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}
