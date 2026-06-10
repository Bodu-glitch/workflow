import { useState, useEffect } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { View, Text, TextInput, Pressable, ScrollView } from '@/tw';
import { workspaceApi } from '@/lib/api/workspace';
import { useToast } from '@/context/toast';
import { useAuth } from '@/context/auth';
import * as Location from 'expo-location';

const STATUS_LABELS: Record<string, string> = {
  active: '🟢 Đang hoạt động',
  inactive: '⚫ Tạm dừng',
  pending: '🟡 Chờ duyệt',
  suspended: '🔴 Bị đình chỉ',
};

async function getCurrentCoords() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new Error('Cần cấp quyền vị trí');
  const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { lat: loc.coords.latitude, lng: loc.coords.longitude };
}

export default function WorkspaceProfileScreen() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  const isBO = user?.role === 'business_owner';

  const { data: profile, isLoading } = useQuery({
    queryKey: ['workspace-profile'],
    queryFn: () => workspaceApi.getProfile(),
    select: (d: any) => d.data ?? d,
  });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [industry, setIndustry] = useState('');
  const [operatingArea, setOperatingArea] = useState('');
  const [benefits, setBenefits] = useState('');
  const [incomeLevel, setIncomeLevel] = useState('');
  const [policies, setPolicies] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setName(profile.name ?? '');
    setDescription(profile.description ?? '');
    setIndustry(profile.industry ?? '');
    setOperatingArea(profile.operating_area ?? '');
    setBenefits(profile.benefits ?? '');
    setIncomeLevel(profile.income_level ?? '');
    setPolicies(profile.policies ?? '');
    setLat(profile.lat != null ? String(profile.lat) : '');
    setLng(profile.lng != null ? String(profile.lng) : '');
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: () =>
      workspaceApi.updateProfile({
        name: name.trim() || undefined,
        description: description.trim() || undefined,
        industry: industry.trim() || undefined,
        operating_area: operatingArea.trim() || undefined,
        benefits: benefits.trim() || undefined,
        income_level: incomeLevel.trim() || undefined,
        policies: policies.trim() || undefined,
        lat: lat ? Number(lat) : undefined,
        lng: lng ? Number(lng) : undefined,
      } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspace-profile'] });
      showToast('Đã cập nhật profile workspace.', 'success', 'Thành công');
    },
    onError: (e: any) => showToast(e?.message ?? 'Lỗi cập nhật', 'error', 'Lỗi'),
  });

  const handleGetLocation = async () => {
    setLocating(true);
    try {
      const coords = await getCurrentCoords();
      setLat(String(coords.lat));
      setLng(String(coords.lng));
    } catch (e: any) {
      showToast(e.message ?? 'Không lấy được vị trí', 'error');
    } finally {
      setLocating(false);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator color="#1E40AF" size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View className="flex-1 bg-surface">
        {/* Header */}
        <View className="px-5 pt-14 pb-4 border-b border-surface-container flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <Pressable onPress={() => router.back()} className="active:opacity-60">
              <Text className="text-primary font-semibold">← Quay lại</Text>
            </Pressable>
            <Text className="text-xl font-extrabold text-on-surface">Profile Workspace</Text>
          </View>
          {isBO && (
            <Pressable
              onPress={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
              className="px-4 py-2 rounded-xl active:opacity-80 disabled:opacity-50"
              style={{ backgroundColor: '#1E40AF' }}
            >
              {updateMutation.isPending
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text className="text-white text-sm font-bold">Lưu</Text>
              }
            </Pressable>
          )}
        </View>

        <ScrollView className="flex-1 px-5 pt-4">
          {/* Status badge */}
          {profile?.status && (
            <View className="mb-4 px-4 py-2.5 rounded-2xl bg-surface-container-lowest flex-row items-center gap-2">
              <Text className="text-sm text-on-surface-variant">Trạng thái:</Text>
              <Text className="text-sm font-semibold text-on-surface">
                {STATUS_LABELS[profile.status] ?? profile.status}
              </Text>
            </View>
          )}

          {/* Slug (read-only) */}
          {profile?.slug && (
            <View className="mb-4 bg-surface-container-lowest rounded-2xl px-4 py-3">
              <Text className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">Slug (URL doanh nghiệp)</Text>
              <Text className="text-sm font-mono text-on-surface">{profile.slug}</Text>
            </View>
          )}

          {/* Fields */}
          {[
            { label: 'Tên doanh nghiệp *', value: name, setter: setName, placeholder: 'Tên hiển thị', multi: false, editable: isBO },
            { label: 'Ngành nghề', value: industry, setter: setIndustry, placeholder: 'VD: Điện, Nước, Điều hòa...', multi: false, editable: isBO },
            { label: 'Khu vực hoạt động', value: operatingArea, setter: setOperatingArea, placeholder: 'VD: Quận 1, 3, 5 – TP.HCM', multi: false, editable: isBO },
            { label: 'Mô tả', value: description, setter: setDescription, placeholder: 'Mô tả ngắn về doanh nghiệp...', multi: true, editable: isBO },
            { label: 'Quyền lợi nhân viên', value: benefits, setter: setBenefits, placeholder: 'VD: Bảo hiểm, thưởng KPI...', multi: true, editable: isBO },
            { label: 'Mức thu nhập', value: incomeLevel, setter: setIncomeLevel, placeholder: 'VD: 8–15 triệu/tháng', multi: false, editable: isBO },
            { label: 'Chính sách & Quy định', value: policies, setter: setPolicies, placeholder: 'Chính sách làm việc, quy tắc...', multi: true, editable: isBO },
          ].map(({ label, value, setter, placeholder, multi, editable }) => (
            <View key={label} className="mb-4">
              <Text className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">{label}</Text>
              {editable ? (
                <TextInput
                  value={value}
                  onChangeText={setter}
                  placeholder={placeholder}
                  placeholderTextColor="#9ca3af"
                  multiline={multi}
                  numberOfLines={multi ? 3 : 1}
                  className="bg-surface-container-lowest rounded-xl px-4 py-3 text-on-surface text-sm"
                  style={multi ? { textAlignVertical: 'top', minHeight: 80 } : {}}
                />
              ) : (
                <View className="bg-surface-container-lowest rounded-xl px-4 py-3">
                  <Text className="text-sm text-on-surface">{value || '—'}</Text>
                </View>
              )}
            </View>
          ))}

          {/* Location */}
          <View className="mb-4">
            <Text className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
              Vị trí GPS (dùng cho lọc theo khoảng cách)
            </Text>
            <View className="flex-row gap-2 mb-2">
              <View className="flex-1">
                <Text className="text-[10px] text-on-surface-variant mb-1">Vĩ độ (Lat)</Text>
                <TextInput
                  value={lat}
                  onChangeText={setLat}
                  placeholder="10.7769"
                  placeholderTextColor="#9ca3af"
                  keyboardType="numeric"
                  editable={isBO}
                  className="bg-surface-container-lowest rounded-xl px-4 py-3 text-on-surface text-sm"
                />
              </View>
              <View className="flex-1">
                <Text className="text-[10px] text-on-surface-variant mb-1">Kinh độ (Lng)</Text>
                <TextInput
                  value={lng}
                  onChangeText={setLng}
                  placeholder="106.7009"
                  placeholderTextColor="#9ca3af"
                  keyboardType="numeric"
                  editable={isBO}
                  className="bg-surface-container-lowest rounded-xl px-4 py-3 text-on-surface text-sm"
                />
              </View>
            </View>
            {isBO && (
              <Pressable
                onPress={handleGetLocation}
                disabled={locating}
                className="flex-row items-center justify-center gap-2 py-3 rounded-xl bg-surface-container active:opacity-70 disabled:opacity-50"
              >
                {locating
                  ? <ActivityIndicator size="small" color="#1E40AF" />
                  : <Text className="text-primary text-sm font-semibold">📍 Lấy vị trí hiện tại</Text>
                }
              </Pressable>
            )}
          </View>

          <View className="h-24" />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}
