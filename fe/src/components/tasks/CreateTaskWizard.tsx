import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { View, Text, Pressable, TextInput, ScrollView } from '@/tw';
import { tasksApi } from '@/lib/api/tasks';
import { ApiError } from '@/lib/api/client';
import { StaffPickerModal } from '@/components/tasks/StaffPickerModal';
import { LocationPickerModal } from '@/components/LocationPickerModal';
import type { PickedLocation } from '@/components/LocationPickerModal';
import type { StaffMember, TaskPriority } from '@/types/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3;

interface Step1 {
  title: string;
  description: string;
  priority: TaskPriority | null;
  assigneeIds: string[];
  assignees: StaffMember[];
}

interface Step2 {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerNote: string;
}

interface Step3 {
  location: PickedLocation | null;
  deadline: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITIES: { value: TaskPriority; label: string; icon: string; color: string; bg: string }[] = [
  { value: 'urgent',  label: 'Urgent',  icon: '🔴', color: '#dc2626', bg: '#fff1f2' },
  { value: 'high',    label: 'High',    icon: '🟠', color: '#ea580c', bg: '#fff7ed' },
  { value: 'medium',  label: 'Routine', icon: '📋', color: '#1E40AF', bg: '#eff6ff' },
  { value: 'low',     label: 'Deferred',icon: '🕐', color: '#64748b', bg: '#f8fafc' },
];

function FieldLabel({ children, required }: { children: string; required?: boolean }) {
  return (
    <Text className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
      {children}{required && <Text className="text-red-500"> *</Text>}
    </Text>
  );
}

function Initials({ name, size = 36 }: { name: string; size?: number }) {
  const letters = name.trim().split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#1E40AF', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.38 }}>{letters}</Text>
    </View>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepBar({ current }: { current: Step }) {
  return (
    <View className="flex-row items-center gap-2 px-5 py-3">
      {([1, 2, 3] as Step[]).map((s) => (
        <View
          key={s}
          className="flex-1 h-1 rounded-full"
          style={{ backgroundColor: s <= current ? '#1E40AF' : '#e2e8f0' }}
        />
      ))}
    </View>
  );
}

// ─── Success screen ───────────────────────────────────────────────────────────

function SuccessScreen({ task, onCreateAnother, route }: {
  task: { id: string; title: string; assignees: StaffMember[]; location: string };
  onCreateAnother: () => void;
  route: 'bo' | 'ot';
}) {
  return (
    <View className="flex-1 bg-surface items-center justify-center px-6 gap-6">
      <View className="w-20 h-20 rounded-2xl items-center justify-center" style={{ backgroundColor: '#1E40AF' }}>
        <Text style={{ fontSize: 36 }}>✓</Text>
      </View>

      <View className="items-center gap-1">
        <Text className="text-2xl font-extrabold text-on-surface text-center">Task Created Successfully!</Text>
        <Text className="text-sm text-on-surface-variant text-center">
          The new field operation has been recorded and synchronized with the dispatch center.
        </Text>
      </View>

      <View className="w-full bg-surface-container-lowest rounded-2xl p-5 gap-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-xs text-on-surface-variant uppercase tracking-wider">Task ID</Text>
          <View className="flex-row items-center gap-2">
            <Text className="text-sm font-bold text-primary">
              {task.id.slice(0, 8).toUpperCase()}
            </Text>
            <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: '#dcfce7' }}>
              <Text className="text-xs font-bold" style={{ color: '#16a34a' }}>ACTIVE</Text>
            </View>
          </View>
        </View>

        <View className="h-px bg-surface-container" />

        <View className="gap-3">
          <View className="flex-row items-center gap-3">
            <Text className="text-base">📋</Text>
            <View>
              <Text className="text-[10px] text-on-surface-variant uppercase tracking-wider">Title</Text>
              <Text className="text-sm font-semibold text-on-surface">{task.title}</Text>
            </View>
          </View>
          {task.assignees.length > 0 && (
            <View className="flex-row items-center gap-3">
              <Text className="text-base">👤</Text>
              <View>
                <Text className="text-[10px] text-on-surface-variant uppercase tracking-wider">Assignee</Text>
                <Text className="text-sm font-semibold text-on-surface">
                  {task.assignees.map((a) => a.full_name).join(', ')}
                </Text>
              </View>
            </View>
          )}
          {task.location && (
            <View className="flex-row items-center gap-3">
              <Text className="text-base">📍</Text>
              <View className="flex-1">
                <Text className="text-[10px] text-on-surface-variant uppercase tracking-wider">Location</Text>
                <Text className="text-sm font-semibold text-on-surface" numberOfLines={2}>{task.location}</Text>
              </View>
            </View>
          )}
        </View>
      </View>

      <View className="w-full gap-3">
        <Pressable
          onPress={() => router.replace({ pathname: route === 'bo' ? '/(bo)/tasks/[id]' : '/(ot)/tasks/[id]', params: { id: task.id } })}
          className="h-14 rounded-2xl items-center justify-center active:opacity-80"
          style={{ backgroundColor: '#1E40AF' }}
        >
          <Text className="text-white font-bold text-base">View Task Details</Text>
        </Pressable>

        <Pressable
          onPress={onCreateAnother}
          className="h-14 rounded-2xl items-center justify-center border active:opacity-70"
          style={{ borderColor: '#1E40AF' }}
        >
          <Text className="font-bold text-base" style={{ color: '#1E40AF' }}>Create Another Task</Text>
        </Pressable>

        <Pressable
          onPress={() => router.replace(route === 'bo' ? '/(bo)' : '/(ot)')}
          className="py-3 items-center active:opacity-60"
        >
          <Text className="text-sm text-on-surface-variant">Return to Dashboard</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

interface CreateTaskWizardProps {
  route: 'bo' | 'ot';
}

const INITIAL_STEP1: Step1 = { title: '', description: '', priority: null, assigneeIds: [], assignees: [] };
const INITIAL_STEP2: Step2 = { customerName: '', customerPhone: '', customerEmail: '', customerNote: '' };
const INITIAL_STEP3: Step3 = { location: null, deadline: '' };

export function CreateTaskWizard({ route }: CreateTaskWizardProps) {
  const qc = useQueryClient();

  const [step, setStep] = useState<Step>(1);
  const [step1, setStep1] = useState<Step1>(INITIAL_STEP1);
  const [step2, setStep2] = useState<Step2>(INITIAL_STEP2);
  const [step3, setStep3] = useState<Step3>(INITIAL_STEP3);
  const [showStaffPicker, setShowStaffPicker] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [createdTask, setCreatedTask] = useState<{ id: string; title: string; assignees: StaffMember[]; location: string } | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      tasksApi.create({
        title: step1.title.trim(),
        description: step1.description.trim() || undefined,
        priority: step1.priority ?? undefined,
        assignee_ids: step1.assigneeIds.length > 0 ? step1.assigneeIds : undefined,
        customer_name: step2.customerName.trim() || undefined,
        customer_phone: step2.customerPhone.trim() || undefined,
        customer_email: step2.customerEmail.trim() || undefined,
        customer_note: step2.customerNote.trim() || undefined,
        location_name: step3.location?.name || undefined,
        location_lat: step3.location?.lat,
        location_lng: step3.location?.lng,
        deadline: step3.deadline ? new Date(step3.deadline).toISOString() : undefined,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      setCreatedTask({
        id: res.data.id,
        title: res.data.title,
        assignees: step1.assignees,
        location: step3.location?.name ?? '',
      });
    },
    onError: (e) => Alert.alert('Error', e instanceof ApiError ? e.message : 'Failed to create task'),
  });

  function resetWizard() {
    setStep(1);
    setStep1(INITIAL_STEP1);
    setStep2(INITIAL_STEP2);
    setStep3(INITIAL_STEP3);
    setCreatedTask(null);
  }

  // ── Success ──
  if (createdTask) {
    return (
      <SuccessScreen
        task={createdTask}
        onCreateAnother={resetWizard}
        route={route}
      />
    );
  }

  // ── Step 1 ──
  const renderStep1 = () => (
    <ScrollView className="flex-1" contentContainerClassName="px-5 py-5 gap-5">
      <View>
        <Text className="text-2xl font-extrabold text-on-surface">New Task</Text>
        <Text className="text-sm text-on-surface-variant mt-1">Provide the fundamental details to get started.</Text>
      </View>

      {/* Title */}
      <View>
        <FieldLabel required>Task Title</FieldLabel>
        <TextInput
          className="w-full h-14 px-4 rounded-xl text-on-surface text-base"
          style={{ backgroundColor: '#f1f5f9' }}
          placeholder="e.g. Inspect HVAC Unit 4"
          placeholderTextColor="#94a3b8"
          value={step1.title}
          onChangeText={(v) => setStep1((s) => ({ ...s, title: v }))}
        />
      </View>

      {/* Assign Staff */}
      <View>
        <FieldLabel>Assign Staff</FieldLabel>
        {step1.assignees.length > 0 ? (
          <Pressable
            onPress={() => setShowStaffPicker(true)}
            className="flex-row items-center gap-3 px-4 py-3 rounded-xl active:opacity-70"
            style={{ backgroundColor: '#f1f5f9' }}
          >
            <View className="flex-row" style={{ gap: -8 }}>
              {step1.assignees.slice(0, 3).map((a) => (
                <Initials key={a.id} name={a.full_name} size={36} />
              ))}
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-on-surface" numberOfLines={1}>
                {step1.assignees.map((a) => a.full_name).join(', ')}
              </Text>
              <Text className="text-xs text-on-surface-variant">Tap to change</Text>
            </View>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => setShowStaffPicker(true)}
            className="flex-row items-center justify-between h-14 px-4 rounded-xl active:opacity-70"
            style={{ backgroundColor: '#f1f5f9' }}
          >
            <Text className="text-base" style={{ color: '#94a3b8' }}>Select staff members...</Text>
            <Text className="text-xl">👤+</Text>
          </Pressable>
        )}
      </View>

      {/* Description */}
      <View>
        <FieldLabel>Description</FieldLabel>
        <TextInput
          className="w-full px-4 py-3 rounded-xl text-on-surface text-base"
          style={{ backgroundColor: '#f1f5f9', height: 100 }}
          placeholder="Describe the scope of work..."
          placeholderTextColor="#94a3b8"
          value={step1.description}
          onChangeText={(v) => setStep1((s) => ({ ...s, description: v }))}
          multiline
          textAlignVertical="top"
        />
      </View>

      {/* Priority */}
      <View>
        <FieldLabel>Priority Level</FieldLabel>
        <View className="flex-row gap-2">
          {PRIORITIES.map((p) => {
            const active = step1.priority === p.value;
            return (
              <Pressable
                key={p.value}
                onPress={() => setStep1((s) => ({ ...s, priority: active ? null : p.value }))}
                className="flex-1 py-3 rounded-2xl items-center gap-1 active:opacity-80"
                style={{ backgroundColor: active ? p.color : p.bg, borderWidth: active ? 0 : 1, borderColor: '#e2e8f0' }}
              >
                <Text style={{ fontSize: 20 }}>{p.icon}</Text>
                <Text style={{ fontSize: 10, fontWeight: '700', color: active ? '#fff' : p.color, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {p.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="h-20" />
    </ScrollView>
  );

  // ── Step 2 ──
  const renderStep2 = () => (
    <ScrollView className="flex-1" contentContainerClassName="px-5 py-5 gap-5">
      <View>
        <Text className="text-2xl font-extrabold text-on-surface">Customer info</Text>
        <Text className="text-sm text-on-surface-variant mt-1">Provide the fundamental details to get started.</Text>
      </View>

      <View>
        <FieldLabel>Full Name</FieldLabel>
        <TextInput
          className="w-full h-14 px-4 rounded-xl text-on-surface text-base"
          style={{ backgroundColor: '#f1f5f9' }}
          placeholder="Customer full name"
          placeholderTextColor="#94a3b8"
          value={step2.customerName}
          onChangeText={(v) => setStep2((s) => ({ ...s, customerName: v }))}
        />
      </View>

      <View>
        <FieldLabel>Phone Number</FieldLabel>
        <TextInput
          className="w-full h-14 px-4 rounded-xl text-on-surface text-base"
          style={{ backgroundColor: '#f1f5f9' }}
          placeholder="+84 xxx xxx xxx"
          placeholderTextColor="#94a3b8"
          value={step2.customerPhone}
          onChangeText={(v) => setStep2((s) => ({ ...s, customerPhone: v }))}
          keyboardType="phone-pad"
        />
      </View>

      <View>
        <FieldLabel>Email Address</FieldLabel>
        <TextInput
          className="w-full h-14 px-4 rounded-xl text-on-surface text-base"
          style={{ backgroundColor: '#f1f5f9' }}
          placeholder="customer@email.com"
          placeholderTextColor="#94a3b8"
          value={step2.customerEmail}
          onChangeText={(v) => setStep2((s) => ({ ...s, customerEmail: v }))}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <View>
        <FieldLabel>Notice</FieldLabel>
        <TextInput
          className="w-full px-4 py-3 rounded-xl text-on-surface text-base"
          style={{ backgroundColor: '#f1f5f9', height: 100 }}
          placeholder="Additional notes for the customer..."
          placeholderTextColor="#94a3b8"
          value={step2.customerNote}
          onChangeText={(v) => setStep2((s) => ({ ...s, customerNote: v }))}
          multiline
          textAlignVertical="top"
        />
      </View>

      <View className="h-20" />
    </ScrollView>
  );

  // ── Step 3 ──
  const renderStep3 = () => (
    <ScrollView className="flex-1" contentContainerClassName="px-5 py-5 gap-5">
      <Text className="text-2xl font-extrabold text-on-surface">Select Location</Text>

      {/* Map preview / picker */}
      <Pressable
        onPress={() => setShowLocationPicker(true)}
        className="rounded-2xl overflow-hidden active:opacity-80"
        style={{ height: 180, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' }}
      >
        {step3.location ? (
          <View className="w-full h-full items-center justify-center gap-2">
            <Text style={{ fontSize: 36 }}>📍</Text>
            <Text className="text-sm font-semibold text-on-surface text-center px-4" numberOfLines={2}>
              {step3.location.name}
            </Text>
            <Text className="text-xs text-on-surface-variant">Tap to change</Text>
          </View>
        ) : (
          <View className="items-center gap-2">
            <Text style={{ fontSize: 36 }}>🗺️</Text>
            <Text className="text-sm text-on-surface-variant">Tap to pin location</Text>
          </View>
        )}
      </Pressable>

      {/* Street Address */}
      <View>
        <FieldLabel>Street Address</FieldLabel>
        <View className="flex-row items-center h-14 px-4 rounded-xl gap-2" style={{ backgroundColor: '#f1f5f9' }}>
          <TextInput
            className="flex-1 text-on-surface text-base"
            placeholder="e.g. 123 Industrial Way"
            placeholderTextColor="#94a3b8"
            value={step3.location?.name ?? ''}
            onChangeText={(v) => setStep3((s) => ({
              ...s,
              location: s.location ? { ...s.location, name: v } : { name: v, lat: 0, lng: 0 },
            }))}
          />
          <Text className="text-on-surface-variant">🔍</Text>
        </View>
      </View>

      {/* Deadline */}
      <View className="flex-row gap-3">
        <View className="flex-1">
          <FieldLabel>Deadline Date</FieldLabel>
          <View className="flex-row items-center h-14 px-4 rounded-xl gap-2" style={{ backgroundColor: '#f1f5f9' }}>
            <TextInput
              className="flex-1 text-on-surface text-base"
              placeholder="2026-05-24"
              placeholderTextColor="#94a3b8"
              value={step3.deadline.split('T')[0] ?? ''}
              onChangeText={(v) => setStep3((s) => ({
                ...s,
                deadline: v + (s.deadline.includes('T') ? 'T' + s.deadline.split('T')[1] : 'T00:00'),
              }))}
            />
            <Text className="text-on-surface-variant">📅</Text>
          </View>
        </View>
        <View className="flex-1">
          <FieldLabel>Deadline Time</FieldLabel>
          <View className="flex-row items-center h-14 px-4 rounded-xl gap-2" style={{ backgroundColor: '#f1f5f9' }}>
            <TextInput
              className="flex-1 text-on-surface text-base"
              placeholder="14:30"
              placeholderTextColor="#94a3b8"
              value={step3.deadline.includes('T') ? step3.deadline.split('T')[1] : ''}
              onChangeText={(v) => setStep3((s) => ({
                ...s,
                deadline: (s.deadline.split('T')[0] ?? '') + 'T' + v,
              }))}
            />
            <Text className="text-on-surface-variant">🕐</Text>
          </View>
        </View>
      </View>

      <View className="h-20" />
    </ScrollView>
  );

  // ── Validation ──
  function handleNext() {
    if (step === 1) {
      if (!step1.title.trim()) { Alert.alert('Required', 'Please enter a task title'); return; }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else {
      createMutation.mutate();
    }
  }

  const nextLabel = step === 3
    ? (createMutation.isPending ? '' : 'Create Task')
    : 'Next →';

  return (
    <>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View className="flex-1 bg-surface">
          {/* Header */}
          <View className="px-5 pt-14 pb-2 flex-row items-center">
            <Pressable
              onPress={() => (step === 1 ? router.back() : setStep((s) => (s - 1) as Step))}
              className="mr-3 active:opacity-60"
            >
              <Text className="text-primary font-semibold text-base">←</Text>
            </Pressable>
            <Text className="text-base font-bold text-on-surface flex-1">
              {step === 1 ? 'New Task' : step === 2 ? 'Customer Info' : 'Location & Deadline'}
            </Text>
          </View>

          <StepBar current={step} />

          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </View>
      </KeyboardAvoidingView>

      {/* Fixed bottom button */}
      <View className="absolute bottom-0 left-0 right-0 px-5 pb-10 pt-3 bg-surface border-t border-surface-container">
        <Pressable
          onPress={handleNext}
          disabled={createMutation.isPending}
          className="h-14 rounded-2xl items-center justify-center active:opacity-80 disabled:opacity-60"
          style={{ backgroundColor: '#1E40AF' }}
        >
          {createMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-bold text-base">{nextLabel}</Text>
          )}
        </Pressable>
      </View>

      {/* Modals */}
      <StaffPickerModal
        visible={showStaffPicker}
        selected={step1.assigneeIds}
        onConfirm={(ids, members) => {
          setStep1((s) => ({ ...s, assigneeIds: ids, assignees: members }));
          setShowStaffPicker(false);
        }}
        onClose={() => setShowStaffPicker(false)}
      />
      <LocationPickerModal
        visible={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onConfirm={(loc) => { setStep3((s) => ({ ...s, location: loc })); setShowLocationPicker(false); }}
        initialLat={step3.location?.lat}
        initialLng={step3.location?.lng}
        initialName={step3.location?.name}
      />
    </>
  );
}
