// OT voucher create — same form as BO but navigates back to OT route on success
import { useState } from 'react';
import { Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { View, Text, Pressable, ScrollView, TextInput } from '@/tw';
import { vouchersApi } from '@/lib/api/vouchers';
import { workspaceApi } from '@/lib/api/workspace';
import { ApiError } from '@/lib/api/client';
import type { ServiceCategory } from '@/types/api';

export default function OTCreateVoucherScreen() {
  const qc = useQueryClient();
  const [code, setCode] = useState('');
  const [type, setType] = useState<'percent' | 'fixed'>('percent');
  const [value, setValue] = useState('');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [minOrder, setMinOrder] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [endDate, setEndDate] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const { data: categoriesData } = useQuery({
    queryKey: ['workspace-categories'],
    queryFn: () => workspaceApi.getServiceCategories(),
    select: (d) => d.data,
  });
  const categories = categoriesData ?? [];

  const createMutation = useMutation({
    mutationFn: () => {
      const dto: any = { code: code.trim().toUpperCase(), type, value: Number(value) };
      if (maxDiscount) dto.max_discount = Number(maxDiscount);
      if (minOrder) dto.min_order_value = Number(minOrder);
      if (usageLimit) dto.usage_limit = Number(usageLimit);
      if (endDate) dto.ends_at = new Date(endDate).toISOString();
      if (categoryId) dto.service_category_id = categoryId;
      return vouchersApi.create(dto);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vouchers'] });
      Alert.alert('Thành công', 'Voucher đã được tạo!', [{ text: 'OK', onPress: () => router.back() }]);
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
          <Text className="text-xs font-semibold text-on-surface-variant mb-1">Mã voucher *</Text>
          <TextInput
            className="bg-surface-container-high rounded-xl px-4 py-3 text-sm text-on-surface mb-3"
            placeholder="VD: SUMMER20"
            placeholderTextColor="#737685"
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase())}
          />
          <Text className="text-xs font-semibold text-on-surface-variant mb-1">Loại *</Text>
          <View className="flex-row gap-2 mb-3">
            {(['percent', 'fixed'] as const).map(t => (
              <Pressable key={t} onPress={() => setType(t)}
                className={`flex-1 py-3 rounded-xl items-center ${type === t ? 'bg-primary' : 'bg-surface-container-high'}`}>
                <Text className={`text-sm font-bold ${type === t ? 'text-white' : 'text-on-surface-variant'}`}>
                  {t === 'percent' ? '% Phần trăm' : '₫ Cố định'}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text className="text-xs font-semibold text-on-surface-variant mb-1">Giá trị *</Text>
          <TextInput
            className="bg-surface-container-high rounded-xl px-4 py-3 text-sm text-on-surface mb-3"
            placeholder={type === 'percent' ? 'VD: 20' : 'VD: 50000'}
            placeholderTextColor="#737685"
            value={value}
            onChangeText={setValue}
            keyboardType="numeric"
          />
          <Text className="text-xs font-semibold text-on-surface-variant mb-1">Đơn tối thiểu (₫)</Text>
          <TextInput
            className="bg-surface-container-high rounded-xl px-4 py-3 text-sm text-on-surface mb-3"
            placeholder="Không giới hạn"
            placeholderTextColor="#737685"
            value={minOrder}
            onChangeText={setMinOrder}
            keyboardType="numeric"
          />
          <Text className="text-xs font-semibold text-on-surface-variant mb-1">Ngày kết thúc (YYYY-MM-DD)</Text>
          <TextInput
            className="bg-surface-container-high rounded-xl px-4 py-3 text-sm text-on-surface mb-4"
            placeholder="Vd: 2026-12-31"
            placeholderTextColor="#737685"
            value={endDate}
            onChangeText={setEndDate}
          />
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
