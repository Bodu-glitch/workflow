import { useState } from 'react';
import { Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { View, Text, Pressable, ScrollView, TextInput } from '@/tw';
import { pricingApi, type ServicePricing } from '@/lib/api/pricing';
import { workspaceApi } from '@/lib/api/workspace';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorView } from '@/components/ui/ErrorView';
import { ApiError } from '@/lib/api/client';
import type { ServiceCategory } from '@/types/api';

function fmt(n: number | null | undefined) {
  if (n == null) return null;
  return Number(n).toLocaleString('vi-VN') + '₫';
}

function PricingCard({
  item,
  onEdit,
  onDelete,
}: {
  item: ServicePricing;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const priceDisplay = item.price_fixed != null
    ? fmt(item.price_fixed)
    : item.price_min != null && item.price_max != null
      ? `${fmt(item.price_min)} – ${fmt(item.price_max)}`
      : item.price_min != null ? `Từ ${fmt(item.price_min)}` : 'Thương lượng';

  return (
    <View className="flex-row items-center justify-between py-3 border-b border-outline/10">
      <View className="flex-1">
        <Text className="text-sm font-semibold text-on-surface">{item.service_name}</Text>
        <Text className="text-xs text-primary font-bold mt-0.5">{priceDisplay}</Text>
        {item.estimated_duration_minutes && (
          <Text className="text-xs text-on-surface-variant mt-0.5">
            ⏱ ~{item.estimated_duration_minutes} phút
          </Text>
        )}
      </View>
      <View className="flex-row gap-2 ml-3">
        <Pressable onPress={onEdit} className="px-3 py-1.5 bg-primary/10 rounded-lg active:opacity-70">
          <Text className="text-xs font-bold text-primary">Sửa</Text>
        </Pressable>
        <Pressable onPress={onDelete} className="px-3 py-1.5 bg-error-container rounded-lg active:opacity-70">
          <Text className="text-xs font-bold text-on-error-container">Xóa</Text>
        </Pressable>
      </View>
    </View>
  );
}

type PricingForm = {
  service_name: string;
  price_fixed: string;
  price_min: string;
  price_max: string;
  estimated_duration_minutes: string;
  category_id: string;
  use_range: boolean;
};

const DEFAULT_FORM: PricingForm = {
  service_name: '',
  price_fixed: '',
  price_min: '',
  price_max: '',
  estimated_duration_minutes: '',
  category_id: '',
  use_range: false,
};

export default function PricingScreen() {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<PricingForm>(DEFAULT_FORM);
  const qc = useQueryClient();

  const { data: pricings, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['pricing'],
    queryFn: () => pricingApi.list(),
    select: (d) => d.data,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['workspace-categories'],
    queryFn: () => workspaceApi.getServiceCategories(),
    select: (d) => d.data,
  });

  const categories = categoriesData ?? [];

  const createMutation = useMutation({
    mutationFn: () => {
      const dto: any = {
        category_id: form.category_id || categories[0]?.id,
        service_name: form.service_name.trim(),
      };
      if (form.use_range) {
        if (form.price_min) dto.price_min = Number(form.price_min);
        if (form.price_max) dto.price_max = Number(form.price_max);
      } else {
        if (form.price_fixed) dto.price_fixed = Number(form.price_fixed);
      }
      if (form.estimated_duration_minutes) dto.estimated_duration_minutes = Number(form.estimated_duration_minutes);
      return editId ? pricingApi.update(editId, dto) : pricingApi.create(dto);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pricing'] });
      setShowForm(false);
      setEditId(null);
      setForm(DEFAULT_FORM);
    },
    onError: (e) => Alert.alert('Lỗi', e instanceof ApiError ? e.message : 'Thất bại'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => pricingApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pricing'] }),
    onError: (e) => Alert.alert('Lỗi', e instanceof ApiError ? e.message : 'Thất bại'),
  });

  const handleEdit = (item: ServicePricing) => {
    setEditId(item.id);
    setForm({
      service_name: item.service_name,
      price_fixed: item.price_fixed?.toString() ?? '',
      price_min: item.price_min?.toString() ?? '',
      price_max: item.price_max?.toString() ?? '',
      estimated_duration_minutes: item.estimated_duration_minutes?.toString() ?? '',
      category_id: item.category_id,
      use_range: item.price_fixed == null,
    });
    setShowForm(true);
  };

  const handleDelete = (item: ServicePricing) => {
    Alert.alert('Xóa dịch vụ', `Xóa "${item.service_name}"?`, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: () => deleteMutation.mutate(item.id) },
    ]);
  };

  if (isLoading) return <LoadingScreen />;
  if (isError) return <ErrorView onRetry={refetch} />;

  // Group by category
  const grouped = (pricings ?? []).reduce((acc: Record<string, ServicePricing[]>, item) => {
    const catName = item.category?.name ?? 'Khác';
    if (!acc[catName]) acc[catName] = [];
    acc[catName].push(item);
    return acc;
  }, {});

  return (
    <View className="flex-1 bg-surface">
      <View className="glass-effect px-5 pt-14 pb-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <Pressable onPress={() => router.back()} className="active:opacity-60">
              <Text className="text-primary font-semibold">← Quay lại</Text>
            </Pressable>
            <Text className="text-2xl font-extrabold text-on-surface tracking-tight">Giá dịch vụ</Text>
          </View>
          <Pressable
            onPress={() => { setShowForm(true); setEditId(null); setForm(DEFAULT_FORM); }}
            className="bg-primary px-4 py-2 rounded-xl active:opacity-70"
          >
            <Text className="text-white text-sm font-bold">+ Thêm</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {/* Form */}
        {showForm && (
          <View className="bg-surface-container-lowest rounded-xl p-5 mb-4">
            <Text className="text-base font-bold text-on-surface mb-4">
              {editId ? '✏️ Sửa dịch vụ' : '➕ Thêm dịch vụ mới'}
            </Text>

            <Text className="text-xs font-semibold text-on-surface-variant mb-1">Danh mục *</Text>
            <View className="flex-row flex-wrap gap-2 mb-3">
              {categories.map((cat: ServiceCategory) => (
                <Pressable
                  key={cat.id}
                  onPress={() => setForm(f => ({ ...f, category_id: cat.id }))}
                  className={`px-3 py-1.5 rounded-full ${form.category_id === cat.id ? 'bg-primary' : 'bg-surface-container-high'}`}
                >
                  <Text className={`text-xs font-semibold ${form.category_id === cat.id ? 'text-white' : 'text-on-surface-variant'}`}>
                    {cat.name}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text className="text-xs font-semibold text-on-surface-variant mb-1">Tên dịch vụ *</Text>
            <TextInput
              className="bg-surface-container-high rounded-xl px-4 py-3 text-sm text-on-surface mb-3"
              placeholder="Vd: Sửa điện ổ cắm"
              placeholderTextColor="#737685"
              value={form.service_name}
              onChangeText={(v) => setForm(f => ({ ...f, service_name: v }))}
            />

            <View className="flex-row items-center gap-3 mb-3">
              <Text className="text-xs font-semibold text-on-surface-variant">Loại giá:</Text>
              <Pressable
                onPress={() => setForm(f => ({ ...f, use_range: false }))}
                className={`px-3 py-1 rounded-full ${!form.use_range ? 'bg-primary' : 'bg-surface-container-high'}`}
              >
                <Text className={`text-xs font-bold ${!form.use_range ? 'text-white' : 'text-on-surface-variant'}`}>Cố định</Text>
              </Pressable>
              <Pressable
                onPress={() => setForm(f => ({ ...f, use_range: true }))}
                className={`px-3 py-1 rounded-full ${form.use_range ? 'bg-primary' : 'bg-surface-container-high'}`}
              >
                <Text className={`text-xs font-bold ${form.use_range ? 'text-white' : 'text-on-surface-variant'}`}>Khoảng giá</Text>
              </Pressable>
            </View>

            {!form.use_range ? (
              <>
                <Text className="text-xs font-semibold text-on-surface-variant mb-1">Giá (₫)</Text>
                <TextInput
                  className="bg-surface-container-high rounded-xl px-4 py-3 text-sm text-on-surface mb-3"
                  placeholder="Vd: 150000"
                  placeholderTextColor="#737685"
                  value={form.price_fixed}
                  onChangeText={(v) => setForm(f => ({ ...f, price_fixed: v }))}
                  keyboardType="numeric"
                />
              </>
            ) : (
              <View className="flex-row gap-2 mb-3">
                <View className="flex-1">
                  <Text className="text-xs font-semibold text-on-surface-variant mb-1">Giá từ (₫)</Text>
                  <TextInput
                    className="bg-surface-container-high rounded-xl px-4 py-3 text-sm text-on-surface"
                    placeholder="100000"
                    placeholderTextColor="#737685"
                    value={form.price_min}
                    onChangeText={(v) => setForm(f => ({ ...f, price_min: v }))}
                    keyboardType="numeric"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-semibold text-on-surface-variant mb-1">Giá đến (₫)</Text>
                  <TextInput
                    className="bg-surface-container-high rounded-xl px-4 py-3 text-sm text-on-surface"
                    placeholder="300000"
                    placeholderTextColor="#737685"
                    value={form.price_max}
                    onChangeText={(v) => setForm(f => ({ ...f, price_max: v }))}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            )}

            <Text className="text-xs font-semibold text-on-surface-variant mb-1">Thời gian ước tính (phút)</Text>
            <TextInput
              className="bg-surface-container-high rounded-xl px-4 py-3 text-sm text-on-surface mb-4"
              placeholder="Vd: 60"
              placeholderTextColor="#737685"
              value={form.estimated_duration_minutes}
              onChangeText={(v) => setForm(f => ({ ...f, estimated_duration_minutes: v }))}
              keyboardType="numeric"
            />

            <View className="flex-row gap-3">
              <Pressable
                onPress={() => { setShowForm(false); setEditId(null); setForm(DEFAULT_FORM); }}
                className="flex-1 bg-surface-container-high py-3 rounded-xl items-center active:opacity-70"
              >
                <Text className="text-sm font-bold text-on-surface">Hủy</Text>
              </Pressable>
              <Pressable
                onPress={() => createMutation.mutate()}
                disabled={createMutation.isPending || !form.service_name.trim()}
                className="flex-1 bg-primary py-3 rounded-xl items-center active:opacity-70 disabled:opacity-50"
              >
                {createMutation.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text className="text-white font-bold text-sm">{editId ? 'Cập nhật' : 'Thêm dịch vụ'}</Text>
                }
              </Pressable>
            </View>
          </View>
        )}

        {/* Pricing list grouped by category */}
        {Object.keys(grouped).length === 0 ? (
          <View className="items-center justify-center py-20 gap-3">
            <Text className="text-4xl">💰</Text>
            <Text className="text-sm text-on-surface-variant">Chưa có dịch vụ nào</Text>
            <Pressable
              onPress={() => setShowForm(true)}
              className="bg-primary px-6 py-3 rounded-xl active:opacity-70"
            >
              <Text className="text-white font-bold">Thêm dịch vụ đầu tiên</Text>
            </Pressable>
          </View>
        ) : (
          Object.entries(grouped).map(([catName, items]) => (
            <View key={catName} className="bg-surface-container-lowest rounded-xl overflow-hidden mb-4">
              <View className="px-4 py-3 bg-primary/5 border-b border-outline/10">
                <Text className="text-xs font-bold uppercase tracking-wider text-primary">{catName}</Text>
              </View>
              <View className="px-4">
                {items.map((item) => (
                  <PricingCard
                    key={item.id}
                    item={item}
                    onEdit={() => handleEdit(item)}
                    onDelete={() => handleDelete(item)}
                  />
                ))}
              </View>
            </View>
          ))
        )}

        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
