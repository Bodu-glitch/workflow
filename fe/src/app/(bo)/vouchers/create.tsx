import { useState } from 'react';
import { Alert, ActivityIndicator, Platform } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { View, Text, Pressable, ScrollView, TextInput } from '@/tw';
import { vouchersApi } from '@/lib/api/vouchers';
import { workspaceApi } from '@/lib/api/workspace';
import { ApiError } from '@/lib/api/client';
import type { ServiceCategory } from '@/types/api';

function Label({ children }: { children: React.ReactNode }) {
  return <Text className="text-xs font-semibold text-on-surface-variant mb-1">{children}</Text>;
}

function Input({ value, onChangeText, placeholder, keyboardType = 'default', multiline = false }: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: any;
  multiline?: boolean;
}) {
  return (
    <TextInput
      className="bg-surface-container-high rounded-xl px-4 py-3 text-sm text-on-surface mb-3"
      placeholder={placeholder}
      placeholderTextColor="#737685"
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      multiline={multiline}
      style={multiline ? { minHeight: 80, textAlignVertical: 'top' } : undefined}
    />
  );
}

export default function CreateVoucherScreen() {
  const qc = useQueryClient();
  const [code, setCode] = useState('');
  const [type, setType] = useState<'percent' | 'fixed'>('percent');
  const [value, setValue] = useState('');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [minOrder, setMinOrder] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  const { data: categoriesData } = useQuery({
    queryKey: ['workspace-categories'],
    queryFn: () => workspaceApi.getServiceCategories(),
    select: (d) => d.data,
  });
  const categories = categoriesData ?? [];

  const createMutation = useMutation({
    mutationFn: () => {
      const dto: any = {
        code: code.trim().toUpperCase(),
        type,
        value: Number(value),
        is_public: isPublic,
      };
      if (maxDiscount) dto.max_discount = Number(maxDiscount);
      if (minOrder) dto.min_order_value = Number(minOrder);
      if (usageLimit) dto.usage_limit = Number(usageLimit);
      if (startDate) dto.starts_at = new Date(startDate).toISOString();
      if (endDate) dto.ends_at = new Date(endDate).toISOString();
      if (categoryId) dto.service_category_id = categoryId;
      return vouchersApi.create(dto);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vouchers'] });
      Alert.alert('Thành công', 'Voucher đã được tạo!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (e) => Alert.alert('Lỗi', e instanceof ApiError ? e.message : 'Không thể tạo voucher'),
  });

  const canSubmit = code.trim().length >= 3 && value && Number(value) > 0;

  return (
    <View className="flex-1 bg-surface">
      <View className="glass-effect px-5 pt-14 pb-4">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} className="active:opacity-60">
            <Text className="text-primary font-semibold">← Quay lại</Text>
          </Pressable>
          <Text className="text-xl font-extrabold text-on-surface tracking-tight">Tạo Voucher</Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">
        <View className="bg-surface-container-lowest rounded-xl p-5 mb-4">
          <Text className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-4">
            Thông tin cơ bản
          </Text>

          <Label>Mã voucher *</Label>
          <Input
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase())}
            placeholder="VD: SUMMER20"
          />

          <Label>Loại giảm giá *</Label>
          <View className="flex-row gap-2 mb-3">
            <Pressable
              onPress={() => setType('percent')}
              className={`flex-1 py-3 rounded-xl items-center ${type === 'percent' ? 'bg-primary' : 'bg-surface-container-high'}`}
            >
              <Text className={`text-sm font-bold ${type === 'percent' ? 'text-white' : 'text-on-surface-variant'}`}>
                % Phần trăm
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setType('fixed')}
              className={`flex-1 py-3 rounded-xl items-center ${type === 'fixed' ? 'bg-primary' : 'bg-surface-container-high'}`}
            >
              <Text className={`text-sm font-bold ${type === 'fixed' ? 'text-white' : 'text-on-surface-variant'}`}>
                ₫ Cố định
              </Text>
            </Pressable>
          </View>

          <Label>{type === 'percent' ? 'Phần trăm giảm (%) *' : 'Số tiền giảm (₫) *'}</Label>
          <Input
            value={value}
            onChangeText={setValue}
            placeholder={type === 'percent' ? 'VD: 20' : 'VD: 50000'}
            keyboardType="numeric"
          />

          {type === 'percent' && (
            <>
              <Label>Giảm tối đa (₫)</Label>
              <Input
                value={maxDiscount}
                onChangeText={setMaxDiscount}
                placeholder="Không giới hạn nếu để trống"
                keyboardType="numeric"
              />
            </>
          )}

          <Label>Đơn tối thiểu (₫)</Label>
          <Input
            value={minOrder}
            onChangeText={setMinOrder}
            placeholder="Không giới hạn nếu để trống"
            keyboardType="numeric"
          />
        </View>

        <View className="bg-surface-container-lowest rounded-xl p-5 mb-4">
          <Text className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-4">
            Giới hạn sử dụng
          </Text>

          <Label>Số lần sử dụng tối đa</Label>
          <Input
            value={usageLimit}
            onChangeText={setUsageLimit}
            placeholder="Không giới hạn nếu để trống"
            keyboardType="numeric"
          />

          <Label>Ngày bắt đầu (YYYY-MM-DD)</Label>
          <Input
            value={startDate}
            onChangeText={setStartDate}
            placeholder="Vd: 2026-06-01"
          />

          <Label>Ngày kết thúc (YYYY-MM-DD)</Label>
          <Input
            value={endDate}
            onChangeText={setEndDate}
            placeholder="Vd: 2026-12-31"
          />
        </View>

        <View className="bg-surface-container-lowest rounded-xl p-5 mb-4">
          <Text className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-4">
            Phạm vi áp dụng
          </Text>

          <Label>Danh mục (áp dụng cho tất cả nếu để trống)</Label>
          <View className="flex-row flex-wrap gap-2 mb-3">
            <Pressable
              onPress={() => setCategoryId('')}
              className={`px-3 py-1.5 rounded-full ${!categoryId ? 'bg-primary' : 'bg-surface-container-high'}`}
            >
              <Text className={`text-xs font-semibold ${!categoryId ? 'text-white' : 'text-on-surface-variant'}`}>
                Tất cả
              </Text>
            </Pressable>
            {categories.map((cat: ServiceCategory) => (
              <Pressable
                key={cat.id}
                onPress={() => setCategoryId(cat.id)}
                className={`px-3 py-1.5 rounded-full ${categoryId === cat.id ? 'bg-primary' : 'bg-surface-container-high'}`}
              >
                <Text className={`text-xs font-semibold ${categoryId === cat.id ? 'text-white' : 'text-on-surface-variant'}`}>
                  {cat.name}
                </Text>
              </Pressable>
            ))}
          </View>

          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-sm font-semibold text-on-surface">Hiển thị công khai</Text>
              <Text className="text-xs text-on-surface-variant">Khách hàng có thể tự nhập mã</Text>
            </View>
            <Pressable
              onPress={() => setIsPublic(v => !v)}
              className={`w-12 h-6 rounded-full items-center justify-center ${isPublic ? 'bg-primary' : 'bg-surface-container-high'}`}
            >
              <View className={`w-5 h-5 rounded-full bg-white shadow ${isPublic ? 'translate-x-3' : '-translate-x-3'}`} />
            </Pressable>
          </View>
        </View>

        <Pressable
          onPress={() => createMutation.mutate()}
          disabled={createMutation.isPending || !canSubmit}
          className="bg-primary py-4 rounded-xl items-center active:opacity-80 disabled:opacity-50 mb-8"
        >
          {createMutation.isPending
            ? <ActivityIndicator color="#fff" />
            : <Text className="text-white font-bold text-base">🎟️ Tạo voucher</Text>
          }
        </Pressable>
      </ScrollView>
    </View>
  );
}
