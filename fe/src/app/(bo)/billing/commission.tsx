import { useState } from 'react';
import { Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { View, Text, Pressable, ScrollView, TextInput } from '@/tw';
import { workspaceApi } from '@/lib/api/workspace';
import { ApiError } from '@/lib/api/client';
import * as ImagePicker from 'expo-image-picker';
import { Image as RNImage } from 'react-native';

export default function CommissionScreen() {
  const qc = useQueryClient();
  const [platformPct, setPlatformPct] = useState('');
  const [staffPct, setStaffPct] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['workspace-payment-info'],
    queryFn: () => workspaceApi.getPaymentInfo(),
    select: (d) => d.data,
  });

  // Initialize form with existing data once
  if (data && !initialized) {
    setPlatformPct(String(data.commission_platform_percent ?? 10));
    setStaffPct(String(data.commission_staff_percent ?? 70));
    setBankName(data.bank_name ?? '');
    setBankAccount(data.bank_account ?? '');
    setBankAccountName(data.bank_account_name ?? '');
    setQrUrl(data.qr_payment_url);
    setInitialized(true);
  }

  const p = Number(platformPct) || 0;
  const s = Number(staffPct) || 0;
  const tenantPct = 100 - p - s;
  const isValid = p + s <= 100 && p >= 0 && s >= 0;

  const saveMutation = useMutation({
    mutationFn: () => workspaceApi.updatePaymentInfo({
      bank_name: bankName.trim() || undefined,
      bank_account: bankAccount.trim() || undefined,
      bank_account_name: bankAccountName.trim() || undefined,
      commission_platform_percent: p,
      commission_staff_percent: s,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspace-payment-info'] });
      Alert.alert('Đã lưu', 'Cấu hình hoa hồng và ngân hàng đã được cập nhật.');
    },
    onError: (e) => Alert.alert('Lỗi', e instanceof ApiError ? e.message : 'Thất bại'),
  });

  const uploadQrMutation = useMutation({
    mutationFn: async () => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.9,
      });
      if (result.canceled || !result.assets[0]) return null;
      const asset = result.assets[0];
      const ext = asset.uri.split('.').pop() ?? 'jpg';
      const file = { uri: asset.uri, name: `qr.${ext}`, type: `image/${ext}` };
      return workspaceApi.uploadPaymentQr(file);
    },
    onSuccess: (res) => {
      if (!res) return;
      const url = (res as any).data?.qr_payment_url;
      if (url) setQrUrl(url);
      qc.invalidateQueries({ queryKey: ['workspace-payment-info'] });
      Alert.alert('Thành công', 'QR thanh toán đã được cập nhật!');
    },
    onError: (e) => Alert.alert('Lỗi', e instanceof ApiError ? e.message : 'Upload thất bại'),
  });

  return (
    <View className="flex-1 bg-surface">
      <View className="glass-effect px-5 pt-14 pb-4">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} className="active:opacity-60">
            <Text className="text-primary font-semibold">← Quay lại</Text>
          </Pressable>
          <Text className="text-xl font-extrabold text-on-surface tracking-tight">Hoa hồng & Thanh toán</Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-4 pt-5" keyboardShouldPersistTaps="handled">
        {/* Commission config */}
        <View className="bg-surface-container-lowest rounded-xl p-5 mb-4">
          <Text className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-4">
            Tỷ lệ hoa hồng (tổng phải = 100%)
          </Text>

          <View className="flex-row gap-3 mb-4">
            <View className="flex-1">
              <Text className="text-xs font-semibold text-on-surface-variant mb-1">Platform (%)</Text>
              <TextInput
                className="bg-surface-container-high rounded-xl px-4 py-3 text-sm text-on-surface"
                placeholder="10"
                placeholderTextColor="#737685"
                value={platformPct}
                onChangeText={setPlatformPct}
                keyboardType="numeric"
              />
            </View>
            <View className="flex-1">
              <Text className="text-xs font-semibold text-on-surface-variant mb-1">Nhân viên (%)</Text>
              <TextInput
                className="bg-surface-container-high rounded-xl px-4 py-3 text-sm text-on-surface"
                placeholder="70"
                placeholderTextColor="#737685"
                value={staffPct}
                onChangeText={setStaffPct}
                keyboardType="numeric"
              />
            </View>
            <View className="flex-1">
              <Text className="text-xs font-semibold text-on-surface-variant mb-1">Tenant (%)</Text>
              <View className={`rounded-xl px-4 py-3 ${isValid ? 'bg-success/10' : 'bg-error-container'}`}>
                <Text className={`text-sm font-bold ${isValid ? 'text-success' : 'text-on-error-container'}`}>
                  {tenantPct}%
                </Text>
              </View>
            </View>
          </View>

          {/* Visual */}
          {isValid && (
            <View className="h-3 rounded-full overflow-hidden flex-row mb-2">
              <View className="bg-error" style={{ flex: p }} />
              <View className="bg-primary" style={{ flex: tenantPct }} />
              <View className="bg-success" style={{ flex: s }} />
            </View>
          )}
          {!isValid && (
            <View className="bg-error-container rounded-xl px-3 py-2">
              <Text className="text-xs text-on-error-container">⚠ Tổng hoa hồng phải ≤ 100%</Text>
            </View>
          )}
        </View>

        {/* Bank info */}
        <View className="bg-surface-container-lowest rounded-xl p-5 mb-4">
          <Text className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-4">
            Thông tin ngân hàng
          </Text>

          <Text className="text-xs font-semibold text-on-surface-variant mb-1">Tên ngân hàng</Text>
          <TextInput
            className="bg-surface-container-high rounded-xl px-4 py-3 text-sm text-on-surface mb-3"
            placeholder="Vd: Vietcombank"
            placeholderTextColor="#737685"
            value={bankName}
            onChangeText={setBankName}
          />

          <Text className="text-xs font-semibold text-on-surface-variant mb-1">Số tài khoản</Text>
          <TextInput
            className="bg-surface-container-high rounded-xl px-4 py-3 text-sm text-on-surface mb-3"
            placeholder="Vd: 1234567890"
            placeholderTextColor="#737685"
            value={bankAccount}
            onChangeText={setBankAccount}
            keyboardType="numeric"
          />

          <Text className="text-xs font-semibold text-on-surface-variant mb-1">Tên chủ tài khoản</Text>
          <TextInput
            className="bg-surface-container-high rounded-xl px-4 py-3 text-sm text-on-surface mb-4"
            placeholder="Vd: NGUYEN VAN A"
            placeholderTextColor="#737685"
            value={bankAccountName}
            onChangeText={setBankAccountName}
            autoCapitalize="characters"
          />

          {/* QR upload */}
          <Text className="text-xs font-semibold text-on-surface-variant mb-2">QR Thanh toán</Text>
          {qrUrl && (
            <View className="items-center mb-3">
              <RNImage
                source={{ uri: qrUrl }}
                style={{ width: 150, height: 150, borderRadius: 8 }}
                resizeMode="contain"
              />
            </View>
          )}
          <Pressable
            onPress={() => uploadQrMutation.mutate()}
            disabled={uploadQrMutation.isPending}
            className="bg-surface-container-high py-3 rounded-xl items-center active:opacity-70 disabled:opacity-50 mb-1"
          >
            {uploadQrMutation.isPending
              ? <ActivityIndicator size="small" />
              : <Text className="text-sm font-bold text-on-surface">
                  {qrUrl ? '🔄 Cập nhật QR' : '📷 Upload QR thanh toán'}
                </Text>
            }
          </Pressable>
          <Text className="text-xs text-on-surface-variant text-center">
            Upload ảnh QR tĩnh của ngân hàng để hiển thị cho khách hàng
          </Text>
        </View>

        <Pressable
          onPress={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !isValid}
          className="bg-primary py-4 rounded-xl items-center active:opacity-80 disabled:opacity-50 mb-8"
        >
          {saveMutation.isPending
            ? <ActivityIndicator color="#fff" />
            : <Text className="text-white font-bold text-base">💾 Lưu cấu hình</Text>
          }
        </Pressable>
      </ScrollView>
    </View>
  );
}
