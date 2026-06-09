import { useState, useEffect } from 'react';
import { Alert, Platform, ActivityIndicator, Modal, RefreshControl, TextInput as RNTextInput } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { View, Text, Pressable, ScrollView, TextInput } from '@/tw';
import { useAuth } from '@/context/auth';
import { pricingApi, categoriesApi, ServicePricing } from '@/lib/api/pricing';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorView } from '@/components/ui/ErrorView';
import type { ServiceCategory } from '@/types/api';

interface PricingForm {
  category_id: string;
  service_name: string;
  price_type: 'fixed' | 'range';
  price_fixed: string;
  price_min: string;
  price_max: string;
  estimated_duration_minutes: string;
}

const EMPTY_FORM: PricingForm = {
  category_id: '',
  service_name: '',
  price_type: 'fixed',
  price_fixed: '',
  price_min: '',
  price_max: '',
  estimated_duration_minutes: '',
};

function formatPrice(n: number | null | undefined): string {
  if (n == null) return '';
  return n.toLocaleString('vi-VN') + '₫';
}

function PricingFormModal({
  visible,
  editing,
  categories,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  visible: boolean;
  editing: ServicePricing | null;
  categories: ServiceCategory[];
  onClose: () => void;
  onSubmit: (form: PricingForm) => void;
  isSubmitting: boolean;
}) {
  const [form, setForm] = useState<PricingForm>(EMPTY_FORM);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (!editing) {
      setForm(EMPTY_FORM);
    } else {
      setForm({
        category_id: editing.category_id,
        service_name: editing.service_name,
        price_type: editing.price_fixed != null ? 'fixed' : 'range',
        price_fixed: editing.price_fixed != null ? String(editing.price_fixed) : '',
        price_min: editing.price_min != null ? String(editing.price_min) : '',
        price_max: editing.price_max != null ? String(editing.price_max) : '',
        estimated_duration_minutes: editing.estimated_duration_minutes != null ? String(editing.estimated_duration_minutes) : '',
      });
    }
    setShowCategoryPicker(false);
  }, [editing, visible]);

  const selectedCategory = categories.find(c => c.id === form.category_id);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-surface">
        <View className="flex-row items-center justify-between px-5 pt-14 pb-4 border-b border-outline/20">
          <Pressable onPress={onClose} className="p-2 -ml-2">
            <Text className="text-base text-on-surface-variant">Cancel</Text>
          </Pressable>
          <Text className="text-base font-bold text-on-surface">
            {editing ? 'Edit Pricing' : 'Add Pricing'}
          </Text>
          <Pressable onPress={() => onSubmit(form)} disabled={isSubmitting} className="p-2 -mr-2">
            {isSubmitting
              ? <ActivityIndicator size="small" color="#1E40AF" />
              : <Text className="text-base font-bold text-primary">Save</Text>
            }
          </Pressable>
        </View>

        <ScrollView className="flex-1 px-5 pt-6" keyboardShouldPersistTaps="handled">
          {/* Category */}
          <Text className="text-sm font-semibold text-on-surface-variant mb-2">Category *</Text>
          <Pressable
            onPress={() => setShowCategoryPicker(!showCategoryPicker)}
            className="bg-surface-container-highest rounded-xl px-4 py-3 mb-4"
          >
            <Text className={selectedCategory ? 'text-on-surface' : 'text-on-surface-variant'}>
              {selectedCategory?.name ?? 'Select category...'}
            </Text>
          </Pressable>
          {showCategoryPicker && (
            <View className="bg-surface-container-highest rounded-xl mb-4 overflow-hidden border border-outline/20">
              {categories.map(cat => (
                <Pressable
                  key={cat.id}
                  onPress={() => { setForm(f => ({ ...f, category_id: cat.id })); setShowCategoryPicker(false); }}
                  className={`px-4 py-3 border-b border-outline/10 active:bg-surface-container ${form.category_id === cat.id ? 'bg-primary/10' : ''}`}
                >
                  <Text className={`text-sm ${form.category_id === cat.id ? 'font-bold text-primary' : 'text-on-surface'}`}>{cat.name}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Service Name */}
          <Text className="text-sm font-semibold text-on-surface-variant mb-2">Service Name *</Text>
          <TextInput
            className="bg-surface-container-highest rounded-xl px-4 py-3 text-on-surface mb-4"
            value={form.service_name}
            onChangeText={v => setForm(f => ({ ...f, service_name: v }))}
            placeholder="e.g. AC Installation"
            placeholderTextColor="#9CA3AF"
          />

          {/* Price Type */}
          <Text className="text-sm font-semibold text-on-surface-variant mb-2">Price Type</Text>
          <View className="flex-row gap-3 mb-4">
            {(['fixed', 'range'] as const).map(type => (
              <Pressable
                key={type}
                onPress={() => setForm(f => ({ ...f, price_type: type }))}
                className={`flex-1 py-2.5 rounded-xl items-center ${form.price_type === type ? 'bg-primary' : 'bg-surface-container-highest'}`}
              >
                <Text className={`text-sm font-semibold ${form.price_type === type ? 'text-white' : 'text-on-surface'}`}>
                  {type === 'fixed' ? 'Fixed Price' : 'Price Range'}
                </Text>
              </Pressable>
            ))}
          </View>

          {form.price_type === 'fixed' ? (
            <>
              <Text className="text-sm font-semibold text-on-surface-variant mb-2">Fixed Price (₫)</Text>
              <TextInput
                className="bg-surface-container-highest rounded-xl px-4 py-3 text-on-surface mb-4"
                value={form.price_fixed}
                onChangeText={v => setForm(f => ({ ...f, price_fixed: v.replace(/[^0-9]/g, '') }))}
                placeholder="e.g. 500000"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
              />
            </>
          ) : (
            <View className="flex-row gap-3 mb-4">
              <View className="flex-1">
                <Text className="text-sm font-semibold text-on-surface-variant mb-2">Min Price (₫)</Text>
                <TextInput
                  className="bg-surface-container-highest rounded-xl px-4 py-3 text-on-surface"
                  value={form.price_min}
                  onChangeText={v => setForm(f => ({ ...f, price_min: v.replace(/[^0-9]/g, '') }))}
                  placeholder="e.g. 200000"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-on-surface-variant mb-2">Max Price (₫)</Text>
                <TextInput
                  className="bg-surface-container-highest rounded-xl px-4 py-3 text-on-surface"
                  value={form.price_max}
                  onChangeText={v => setForm(f => ({ ...f, price_max: v.replace(/[^0-9]/g, '') }))}
                  placeholder="e.g. 800000"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                />
              </View>
            </View>
          )}

          {/* Duration */}
          <Text className="text-sm font-semibold text-on-surface-variant mb-2">Est. Duration (minutes)</Text>
          <TextInput
            className="bg-surface-container-highest rounded-xl px-4 py-3 text-on-surface mb-6"
            value={form.estimated_duration_minutes}
            onChangeText={v => setForm(f => ({ ...f, estimated_duration_minutes: v.replace(/[^0-9]/g, '') }))}
            placeholder="e.g. 60"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
          />

          <View className="h-8" />
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function PricingScreen() {
  const { user } = useAuth();
  const tenantId = user?.tenant_id ?? '';
  const qc = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ServicePricing | null>(null);
  const [filterCategoryId, setFilterCategoryId] = useState<string>('');

  const { data: pricings, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['pricings', tenantId, filterCategoryId],
    queryFn: () => pricingApi.list(tenantId, filterCategoryId || undefined),
    select: d => d.data,
    enabled: !!tenantId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['service-categories-all'],
    queryFn: () => categoriesApi.listAll().then(r => r.data),
    enabled: !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: (form: PricingForm) => pricingApi.create({
      category_id: form.category_id,
      service_name: form.service_name.trim(),
      ...(form.price_type === 'fixed' && form.price_fixed ? { price_fixed: Number(form.price_fixed) } : {}),
      ...(form.price_type === 'range' && form.price_min ? { price_min: Number(form.price_min) } : {}),
      ...(form.price_type === 'range' && form.price_max ? { price_max: Number(form.price_max) } : {}),
      ...(form.estimated_duration_minutes ? { estimated_duration_minutes: Number(form.estimated_duration_minutes) } : {}),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pricings'] }); setShowModal(false); setEditing(null); },
    onError: (e: any) => Alert.alert('Error', e?.message ?? 'Failed to create pricing'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, form }: { id: string; form: PricingForm }) => pricingApi.update(id, {
      category_id: form.category_id,
      service_name: form.service_name.trim(),
      price_fixed: form.price_type === 'fixed' && form.price_fixed ? Number(form.price_fixed) : undefined,
      price_min: form.price_type === 'range' && form.price_min ? Number(form.price_min) : undefined,
      price_max: form.price_type === 'range' && form.price_max ? Number(form.price_max) : undefined,
      estimated_duration_minutes: form.estimated_duration_minutes ? Number(form.estimated_duration_minutes) : undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pricings'] }); setShowModal(false); setEditing(null); },
    onError: (e: any) => Alert.alert('Error', e?.message ?? 'Failed to update pricing'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => pricingApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pricings'] }),
    onError: (e: any) => Alert.alert('Error', e?.message ?? 'Failed to delete pricing'),
  });

  const handleSubmit = (form: PricingForm) => {
    if (!form.category_id) return Alert.alert('Validation', 'Please select a category');
    if (!form.service_name.trim()) return Alert.alert('Validation', 'Service name is required');
    if (editing) {
      updateMutation.mutate({ id: editing.id, form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleDelete = (item: ServicePricing) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`Xóa "${item.service_name}"?`)) deleteMutation.mutate(item.id);
      return;
    }
    Alert.alert('Delete Pricing', `Remove "${item.service_name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(item.id) },
    ]);
  };

  if (isLoading) return <LoadingScreen />;
  if (isError) return <ErrorView onRetry={refetch} />;

  const items = pricings ?? [];

  // Group by category
  const grouped: Record<string, { category: ServicePricing['category']; items: ServicePricing[] }> = {};
  for (const item of items) {
    const key = item.category_id;
    if (!grouped[key]) grouped[key] = { category: item.category, items: [] };
    grouped[key].items.push(item);
  }

  return (
    <View className="flex-1 bg-surface">
      <View className="glass-effect px-5 pt-14 pb-3">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-2xl font-extrabold text-on-surface tracking-tight">Pricing</Text>
          <Pressable
            onPress={() => { setEditing(null); setShowModal(true); }}
            className="bg-primary rounded-xl px-4 py-2"
          >
            <Text className="text-sm font-bold text-white">+ Add</Text>
          </Pressable>
        </View>

        {/* Category filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
          <Pressable
            onPress={() => setFilterCategoryId('')}
            className={`px-4 py-2 rounded-full ${!filterCategoryId ? 'bg-primary' : 'bg-surface-container-high'}`}
          >
            <Text className={`text-sm font-semibold ${!filterCategoryId ? 'text-white' : 'text-on-surface-variant'}`}>
              All
            </Text>
          </Pressable>
          {categories.map(cat => (
            <Pressable
              key={cat.id}
              onPress={() => setFilterCategoryId(cat.id === filterCategoryId ? '' : cat.id)}
              className={`px-4 py-2 rounded-full ${filterCategoryId === cat.id ? 'bg-primary' : 'bg-surface-container-high'}`}
            >
              <Text className={`text-sm font-semibold ${filterCategoryId === cat.id ? 'text-white' : 'text-on-surface-variant'}`}>
                {cat.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {items.length === 0 ? (
          <View className="items-center justify-center py-20 gap-3">
            <Text className="text-4xl">💰</Text>
            <Text className="text-sm text-on-surface-variant">No pricing entries yet</Text>
            <Pressable onPress={() => { setEditing(null); setShowModal(true); }} className="bg-primary rounded-xl px-5 py-2.5 mt-2">
              <Text className="text-sm font-bold text-white">Add first pricing</Text>
            </Pressable>
          </View>
        ) : (
          Object.entries(grouped).map(([, group]) => (
            <View key={group.category?.id ?? 'unknown'} className="mb-6">
              <View className="flex-row items-center gap-2 mb-3">
                <View className="w-1 h-5 bg-primary rounded-full" />
                <Text className="text-sm font-bold text-primary uppercase tracking-wide">
                  {group.category?.name ?? 'Unknown Category'}
                </Text>
              </View>
              {group.items.map(item => (
                <View key={item.id} className="bg-surface-container-lowest rounded-xl p-4 mb-2 flex-row items-center">
                  <View className="flex-1 gap-1">
                    <Text className="text-sm font-semibold text-on-surface">{item.service_name}</Text>
                    <Text className="text-xs font-bold text-primary">
                      {item.price_fixed != null
                        ? formatPrice(item.price_fixed)
                        : item.price_min != null || item.price_max != null
                          ? `${formatPrice(item.price_min)} – ${formatPrice(item.price_max)}`
                          : 'Price TBD'}
                    </Text>
                    {item.estimated_duration_minutes != null && (
                      <Text className="text-xs text-on-surface-variant">
                        ⏱ {item.estimated_duration_minutes} min
                      </Text>
                    )}
                  </View>
                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={() => { setEditing(item); setShowModal(true); }}
                      className="bg-surface-container-high rounded-lg px-3 py-1.5"
                    >
                      <Text className="text-xs font-semibold text-on-surface">Edit</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleDelete(item)}
                      className="bg-error/10 rounded-lg px-3 py-1.5"
                    >
                      <Text className="text-xs font-semibold text-error">Del</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          ))
        )}
        <View className="h-8" />
      </ScrollView>

      <PricingFormModal
        visible={showModal}
        editing={editing}
        categories={categories}
        onClose={() => { setShowModal(false); setEditing(null); }}
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />
    </View>
  );
}
