import { useState, useEffect } from 'react';
import { Alert, Platform, ActivityIndicator, Modal, RefreshControl, Switch } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { View, Text, Pressable, ScrollView, TextInput } from '@/tw';
import { vouchersApi, Voucher, CreateVoucherInput } from '@/lib/api/vouchers';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorView } from '@/components/ui/ErrorView';

interface VoucherForm {
  code: string;
  name: string;
  type: 'percentage' | 'fixed';
  value: string;
  min_order_amount: string;
  max_discount: string;
  usage_limit: string;
  start_date: string;
  end_date: string;
}

const EMPTY_FORM: VoucherForm = {
  code: '',
  name: '',
  type: 'fixed',
  value: '',
  min_order_amount: '',
  max_discount: '',
  usage_limit: '',
  start_date: '',
  end_date: '',
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('vi-VN');
}

function DatePickerButton({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const dateValue = value ? new Date(value) : new Date();

  if (Platform.OS === 'web') {
    return (
      <View className="flex-1">
        <Text className="text-sm font-semibold text-on-surface-variant mb-2">{label}</Text>
        <View className="bg-surface-container-highest rounded-xl px-4" style={{ height: 48, justifyContent: 'center' }}>
          <input
            type="date"
            value={value}
            onChange={e => onChange(e.target.value)}
            style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: value ? '#0d1c2e' : '#9CA3AF', width: '100%', cursor: 'pointer' }}
          />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <Text className="text-sm font-semibold text-on-surface-variant mb-2">{label}</Text>
      <Pressable
        onPress={() => setShowPicker(true)}
        className="bg-surface-container-highest rounded-xl px-4 active:opacity-70"
        style={{ height: 48, justifyContent: 'center' }}
      >
        <Text className={value ? 'text-on-surface' : 'text-on-surface-variant'}>
          {value ? formatDate(value) : 'Chọn ngày...'}
        </Text>
      </Pressable>
      {showPicker && (
        <DateTimePicker
          value={dateValue}
          mode="date"
          display="default"
          onChange={(_, d) => {
            setShowPicker(false);
            if (d) {
              const y = d.getFullYear();
              const m = String(d.getMonth() + 1).padStart(2, '0');
              const day = String(d.getDate()).padStart(2, '0');
              onChange(`${y}-${m}-${day}`);
            }
          }}
        />
      )}
    </View>
  );
}

function VoucherFormModal({
  visible,
  editing,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  visible: boolean;
  editing: Voucher | null;
  onClose: () => void;
  onSubmit: (form: VoucherForm) => void;
  isSubmitting: boolean;
}) {
  const [form, setForm] = useState<VoucherForm>(EMPTY_FORM);

  useEffect(() => {
    if (!visible) return;
    if (!editing) {
      setForm(EMPTY_FORM);
    } else {
      setForm({
        code: editing.code,
        name: editing.name,
        type: editing.type,
        value: String(editing.value),
        min_order_amount: editing.min_order_amount != null ? String(editing.min_order_amount) : '',
        max_discount: editing.max_discount != null ? String(editing.max_discount) : '',
        usage_limit: editing.usage_limit != null ? String(editing.usage_limit) : '',
        start_date: editing.start_date ? editing.start_date.split('T')[0] : '',
        end_date: editing.end_date ? editing.end_date.split('T')[0] : '',
      });
    }
  }, [editing, visible]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-surface">
        <View className="flex-row items-center justify-between px-5 pt-14 pb-4 border-b border-outline/20">
          <Pressable onPress={onClose} className="p-2 -ml-2">
            <Text className="text-base text-on-surface-variant">Cancel</Text>
          </Pressable>
          <Text className="text-base font-bold text-on-surface">
            {editing ? 'Edit Voucher' : 'Create Voucher'}
          </Text>
          <Pressable onPress={() => onSubmit(form)} disabled={isSubmitting} className="p-2 -mr-2">
            {isSubmitting
              ? <ActivityIndicator size="small" color="#1E40AF" />
              : <Text className="text-base font-bold text-primary">Save</Text>
            }
          </Pressable>
        </View>

        <ScrollView className="flex-1 px-5 pt-6" keyboardShouldPersistTaps="handled">
          {/* Code */}
          <Text className="text-sm font-semibold text-on-surface-variant mb-2">Voucher Code *</Text>
          <TextInput
            className="bg-surface-container-highest rounded-xl px-4 py-3 text-on-surface mb-4 font-mono"
            value={form.code}
            onChangeText={v => setForm(f => ({ ...f, code: v.toUpperCase().replace(/\s/g, '') }))}
            placeholder="e.g. SUMMER20"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="characters"
            editable={!editing}
          />

          {/* Name */}
          <Text className="text-sm font-semibold text-on-surface-variant mb-2">Name *</Text>
          <TextInput
            className="bg-surface-container-highest rounded-xl px-4 py-3 text-on-surface mb-4"
            value={form.name}
            onChangeText={v => setForm(f => ({ ...f, name: v }))}
            placeholder="e.g. Summer Discount 20%"
            placeholderTextColor="#9CA3AF"
          />

          {/* Discount type */}
          <Text className="text-sm font-semibold text-on-surface-variant mb-2">Discount Type</Text>
          <View className="flex-row gap-3 mb-4">
            {(['fixed', 'percentage'] as const).map(type => (
              <Pressable
                key={type}
                onPress={() => setForm(f => ({ ...f, type }))}
                className={`flex-1 py-2.5 rounded-xl items-center ${form.type === type ? 'bg-primary' : 'bg-surface-container-highest'}`}
              >
                <Text className={`text-sm font-semibold ${form.type === type ? 'text-white' : 'text-on-surface'}`}>
                  {type === 'fixed' ? 'Fixed (₫)' : 'Percentage (%)'}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Value */}
          <Text className="text-sm font-semibold text-on-surface-variant mb-2">
            Discount {form.type === 'percentage' ? 'Percent (%)' : 'Amount (₫)'} *
          </Text>
          <TextInput
            className="bg-surface-container-highest rounded-xl px-4 py-3 text-on-surface mb-4"
            value={form.value}
            onChangeText={v => setForm(f => ({ ...f, value: v.replace(/[^0-9]/g, '') }))}
            placeholder={form.type === 'percentage' ? 'e.g. 20' : 'e.g. 50000'}
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
          />

          {/* Min order */}
          <Text className="text-sm font-semibold text-on-surface-variant mb-2">Min Order Amount (₫)</Text>
          <TextInput
            className="bg-surface-container-highest rounded-xl px-4 py-3 text-on-surface mb-4"
            value={form.min_order_amount}
            onChangeText={v => setForm(f => ({ ...f, min_order_amount: v.replace(/[^0-9]/g, '') }))}
            placeholder="Optional"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
          />

          {/* Max discount (for percentage type) */}
          {form.type === 'percentage' && (
            <>
              <Text className="text-sm font-semibold text-on-surface-variant mb-2">Max Discount (₫)</Text>
              <TextInput
                className="bg-surface-container-highest rounded-xl px-4 py-3 text-on-surface mb-4"
                value={form.max_discount}
                onChangeText={v => setForm(f => ({ ...f, max_discount: v.replace(/[^0-9]/g, '') }))}
                placeholder="Optional cap"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
              />
            </>
          )}

          {/* Usage limit */}
          <Text className="text-sm font-semibold text-on-surface-variant mb-2">Usage Limit</Text>
          <TextInput
            className="bg-surface-container-highest rounded-xl px-4 py-3 text-on-surface mb-4"
            value={form.usage_limit}
            onChangeText={v => setForm(f => ({ ...f, usage_limit: v.replace(/[^0-9]/g, '') }))}
            placeholder="Unlimited if empty"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
          />

          {/* Date range */}
          <View className="flex-row gap-3 mb-6">
            <DatePickerButton
              label="Ngày bắt đầu"
              value={form.start_date}
              onChange={v => setForm(f => ({ ...f, start_date: v }))}
            />
            <DatePickerButton
              label="Ngày kết thúc"
              value={form.end_date}
              onChange={v => setForm(f => ({ ...f, end_date: v }))}
            />
          </View>

          <View className="h-8" />
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function VouchersScreen() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Voucher | null>(null);

  const { data: vouchers, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['vouchers'],
    queryFn: () => vouchersApi.list(),
    select: d => d.data,
  });

  const createMutation = useMutation({
    mutationFn: (form: VoucherForm) => vouchersApi.create({
      code: form.code,
      name: form.name,
      type: form.type,
      value: Number(form.value),
      ...(form.min_order_amount ? { min_order_amount: Number(form.min_order_amount) } : {}),
      ...(form.max_discount ? { max_discount: Number(form.max_discount) } : {}),
      ...(form.usage_limit ? { usage_limit: Number(form.usage_limit) } : {}),
      ...(form.start_date ? { start_date: form.start_date } : {}),
      ...(form.end_date ? { end_date: form.end_date } : {}),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vouchers'] }); setShowModal(false); setEditing(null); },
    onError: (e: any) => Alert.alert('Error', e?.message ?? 'Failed to create voucher'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, form }: { id: string; form: VoucherForm }) => vouchersApi.update(id, {
      name: form.name,
      type: form.type,
      value: Number(form.value),
      min_order_amount: form.min_order_amount ? Number(form.min_order_amount) : undefined,
      max_discount: form.max_discount ? Number(form.max_discount) : undefined,
      usage_limit: form.usage_limit ? Number(form.usage_limit) : undefined,
      start_date: form.start_date || undefined,
      end_date: form.end_date || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vouchers'] }); setShowModal(false); setEditing(null); },
    onError: (e: any) => Alert.alert('Error', e?.message ?? 'Failed to update voucher'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      vouchersApi.update(id, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vouchers'] }),
    onError: (e: any) => Alert.alert('Error', e?.message ?? 'Failed to update voucher'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => vouchersApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vouchers'] }),
    onError: (e: any) => Alert.alert('Error', e?.message ?? 'Failed to delete voucher'),
  });

  const handleSubmit = (form: VoucherForm) => {
    if (!form.code) return Alert.alert('Validation', 'Voucher code is required');
    if (!form.name) return Alert.alert('Validation', 'Name is required');
    if (!form.value) return Alert.alert('Validation', 'Discount value is required');
    if (form.type === 'percentage' && Number(form.value) > 100) {
      return Alert.alert('Validation', 'Percentage cannot exceed 100%');
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleDelete = (v: Voucher) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`Xóa voucher "${v.code}"?`)) deleteMutation.mutate(v.id);
      return;
    }
    Alert.alert('Delete Voucher', `Deactivate "${v.code}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(v.id) },
    ]);
  };

  if (isLoading) return <LoadingScreen />;
  if (isError) return <ErrorView onRetry={refetch} />;

  const items = vouchers ?? [];

  return (
    <View className="flex-1 bg-surface">
      <View className="glass-effect px-5 pt-14 pb-4 border-b border-outline/20">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-extrabold text-on-surface tracking-tight">Vouchers</Text>
          <Pressable
            onPress={() => { setEditing(null); setShowModal(true); }}
            className="bg-primary rounded-xl px-4 py-2"
          >
            <Text className="text-sm font-bold text-white">+ Create</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {items.length === 0 ? (
          <View className="items-center justify-center py-20 gap-3">
            <Text className="text-4xl">🎟️</Text>
            <Text className="text-sm text-on-surface-variant">No vouchers yet</Text>
            <Pressable onPress={() => { setEditing(null); setShowModal(true); }} className="bg-primary rounded-xl px-5 py-2.5 mt-2">
              <Text className="text-sm font-bold text-white">Create first voucher</Text>
            </Pressable>
          </View>
        ) : (
          items.map(v => (
            <View key={v.id} className="bg-surface-container-lowest rounded-xl p-4 mb-3">
              <View className="flex-row items-start justify-between mb-2">
                <View className="flex-1">
                  <View className="flex-row items-center gap-2 mb-1">
                    <View className="bg-primary/10 rounded-lg px-3 py-1">
                      <Text className="text-sm font-bold text-primary font-mono">{v.code}</Text>
                    </View>
                    {!v.is_active && (
                      <View className="bg-error/10 rounded-lg px-2 py-1">
                        <Text className="text-xs font-semibold text-error">Inactive</Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-sm text-on-surface">{v.name}</Text>
                </View>
                <View className="items-end gap-1">
                  <Text className="text-base font-extrabold text-primary">
                    {v.type === 'percentage' ? `${v.value}%` : `${v.value.toLocaleString('vi-VN')}₫`}
                  </Text>
                  <Text className="text-xs text-on-surface-variant">
                    {v.used_count}{v.usage_limit != null ? `/${v.usage_limit}` : ''} used
                  </Text>
                </View>
              </View>

              <View className="flex-row flex-wrap gap-3 mt-2">
                {v.min_order_amount != null && (
                  <Text className="text-xs text-on-surface-variant">
                    Min: {v.min_order_amount.toLocaleString('vi-VN')}₫
                  </Text>
                )}
                {v.max_discount != null && v.type === 'percentage' && (
                  <Text className="text-xs text-on-surface-variant">
                    Max: {v.max_discount.toLocaleString('vi-VN')}₫
                  </Text>
                )}
                {v.start_date && <Text className="text-xs text-on-surface-variant">From {formatDate(v.start_date)}</Text>}
                {v.end_date && <Text className="text-xs text-on-surface-variant">To {formatDate(v.end_date)}</Text>}
              </View>

              <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-outline/10">
                <View className="flex-row items-center gap-2">
                  <Text className="text-xs text-on-surface-variant">Active</Text>
                  <Switch
                    value={v.is_active}
                    onValueChange={val => toggleMutation.mutate({ id: v.id, is_active: val })}
                    trackColor={{ false: '#d1d5db', true: '#1E40AF' }}
                    thumbColor="#ffffff"
                  />
                </View>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => { setEditing(v); setShowModal(true); }}
                    className="bg-surface-container-high rounded-lg px-3 py-1.5"
                  >
                    <Text className="text-xs font-semibold text-on-surface">Edit</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleDelete(v)}
                    className="bg-error/10 rounded-lg px-3 py-1.5"
                  >
                    <Text className="text-xs font-semibold text-error">Del</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ))
        )}
        <View className="h-8" />
      </ScrollView>

      <VoucherFormModal
        visible={showModal}
        editing={editing}
        onClose={() => { setShowModal(false); setEditing(null); }}
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />
    </View>
  );
}
