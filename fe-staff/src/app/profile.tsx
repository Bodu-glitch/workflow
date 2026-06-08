import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable as RNPressable } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Pressable, ScrollView, Text, TextInput, View } from '@/tw';
import { useAuth } from '@/context/auth';
import { meApi, type OnlineStatus } from '@/lib/api/me';
import { Image as TwImage } from '@/tw/image';

const ONLINE_STATUS_CONFIG: Record<OnlineStatus, { label: string; color: string; bg: string; dot: string; icon: string }> = {
  online:  { label: 'Online',    color: '#15803d', bg: '#dcfce7', dot: '#16a34a', icon: '🟢' },
  working: { label: 'Đang làm', color: '#1d4ed8', bg: '#dbeafe', dot: '#2563eb', icon: '🔵' },
  offline: { label: 'Offline',   color: '#6b7280', bg: '#f3f4f6', dot: '#9ca3af', icon: '⚪' },
};

export default function ProfileScreen() {
  const { user, logout, leaveCurrentWorkspace } = useAuth();
  const qc = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [cccd, setCccd] = useState('');
  const [uploadingCert, setUploadingCert] = useState(false);
  const [certPromptVisible, setCertPromptVisible] = useState(false);
  const [leaveVisible, setLeaveVisible] = useState(false);
  const [leaveReason, setLeaveReason] = useState('');
  const [leaving, setLeaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [certPromptName, setCertPromptName] = useState('');
  const [pendingCertAsset, setPendingCertAsset] = useState<{ uri: string; name: string; type: string } | null>(null);

  const profileQuery = useQuery({
    queryKey: ['me-profile'],
    queryFn: () => meApi.getProfile(),
    select: d => d.data,
  });

  const profile = profileQuery.data;

  const currentStatus: OnlineStatus = (profile?.online_status as OnlineStatus) ?? 'offline';

  const updateMutation = useMutation({
    mutationFn: () => meApi.updateProfile({ full_name: fullName, phone, cccd }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me-profile'] });
      setEditing(false);
      Alert.alert('Thành công', 'Đã cập nhật hồ sơ.');
    },
    onError: () => Alert.alert('Lỗi', 'Không thể cập nhật hồ sơ.'),
  });

  const deleteCertMutation = useMutation({
    mutationFn: (id: string) => meApi.deleteCertificate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me-profile'] }),
    onError: () => Alert.alert('Lỗi', 'Không thể xóa chứng chỉ.'),
  });

  function startEdit() {
    setFullName(profile?.full_name ?? user?.full_name ?? '');
    setPhone(profile?.phone ?? '');
    setCccd(profile?.cccd ?? '');
    setEditing(true);
  }

  async function pickAndUploadAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setUploadingAvatar(true);
    try {
      await meApi.updateAvatar({
        uri: asset.uri,
        name: asset.fileName ?? 'avatar.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      });
      qc.invalidateQueries({ queryKey: ['me-profile'] });
    } catch {
      Alert.alert('Lỗi', 'Không thể cập nhật ảnh đại diện.');
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function confirmLeave() {
    setLeaving(true);
    try {
      await meApi.leaveWorkspace(leaveReason.trim() || undefined);
      setLeaveVisible(false);
      setLeaveReason('');
      await leaveCurrentWorkspace();
    } catch {
      Alert.alert('Lỗi', 'Không thể rời workspace. Vui lòng thử lại.');
    } finally {
      setLeaving(false);
    }
  }

  async function pickAndUploadCert() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setPendingCertAsset({ uri: asset.uri, name: asset.fileName ?? 'certificate.jpg', type: asset.mimeType ?? 'image/jpeg' });
    setCertPromptName('');
    setCertPromptVisible(true);
  }

  async function confirmUploadCert() {
    if (!pendingCertAsset || !certPromptName.trim()) return;
    setCertPromptVisible(false);
    setUploadingCert(true);
    try {
      await meApi.uploadCertificate(pendingCertAsset, certPromptName.trim());
      qc.invalidateQueries({ queryKey: ['me-profile'] });
      Alert.alert('Thành công', 'Đã tải chứng chỉ lên.');
    } catch {
      Alert.alert('Lỗi', 'Không thể tải chứng chỉ.');
    } finally {
      setUploadingCert(false);
      setPendingCertAsset(null);
    }
  }

  const initials =
    (profile?.full_name ?? user?.full_name)
      ?.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() ?? 'U';

  const currentTenant = (user as any)?.tenants?.find((t: any) => t.id === user?.tenant_id);
  const workspaceName = currentTenant?.name ?? '—';

  return (
    <>
    {/* Certificate name prompt */}
    <Modal visible={certPromptVisible} transparent animationType="fade" onRequestClose={() => setCertPromptVisible(false)}>
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <View className="bg-surface rounded-2xl p-6 mx-6 w-full max-w-sm gap-4">
          <Text className="text-base font-bold text-on-surface">Tên chứng chỉ</Text>
          <TextInput
            className="h-11 px-3 bg-surface-container rounded-xl text-on-surface text-sm"
            value={certPromptName}
            onChangeText={setCertPromptName}
            placeholder="VD: Chứng chỉ hàn"
            placeholderTextColor="#737685"
            autoFocus
          />
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => { setCertPromptVisible(false); setPendingCertAsset(null); }}
              className="flex-1 py-3 rounded-xl bg-surface-container items-center active:opacity-70"
            >
              <Text className="text-sm font-semibold text-on-surface">Hủy</Text>
            </Pressable>
            <Pressable
              onPress={confirmUploadCert}
              disabled={!certPromptName.trim()}
              className="flex-1 py-3 rounded-xl kinetic-gradient items-center active:opacity-80 disabled:opacity-50"
            >
              <Text className="text-sm font-bold text-on-primary">OK</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>

    {/* Leave workspace modal */}
    <Modal visible={leaveVisible} transparent animationType="fade" onRequestClose={() => setLeaveVisible(false)}>
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <View className="bg-surface rounded-2xl p-6 mx-6 w-full max-w-sm gap-4">
          <View>
            <Text className="text-base font-bold text-on-surface">Rời workspace</Text>
            <Text className="text-xs text-on-surface-variant mt-1">
              Bạn sẽ bị xóa khỏi "{workspaceName}". Bạn có thể ứng tuyển lại sau.
            </Text>
          </View>
          <View>
            <Text className="text-xs text-on-surface-variant mb-1">Lý do rời (tùy chọn)</Text>
            <TextInput
              className="px-3 py-3 bg-surface-container rounded-xl text-on-surface text-sm"
              value={leaveReason}
              onChangeText={setLeaveReason}
              placeholder="Nhập lý do của bạn..."
              placeholderTextColor="#737685"
              multiline
              numberOfLines={3}
              style={{ minHeight: 72, textAlignVertical: 'top' }}
            />
          </View>
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => { setLeaveVisible(false); setLeaveReason(''); }}
              disabled={leaving}
              className="flex-1 py-3 rounded-xl bg-surface-container items-center active:opacity-70"
            >
              <Text className="text-sm font-semibold text-on-surface">Hủy</Text>
            </Pressable>
            <Pressable
              onPress={confirmLeave}
              disabled={leaving}
              className="flex-1 py-3 rounded-xl bg-error-container items-center active:opacity-80 disabled:opacity-50"
            >
              {leaving
                ? <ActivityIndicator size="small" color="#b3261e" />
                : <Text className="text-sm font-bold text-error">Rời workspace</Text>
              }
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>

    <ScrollView className="flex-1 bg-surface">
      {/* Header */}
      <View className="px-5 pt-14 pb-4 flex-row items-center justify-between">
        <Pressable onPress={() => router.back()} className="w-10 h-10 items-center justify-center rounded-xl active:opacity-60">
          <Text className="text-on-surface text-xl">←</Text>
        </Pressable>
        <Text className="text-base font-bold text-on-surface">Hồ sơ</Text>
        {!editing ? (
          <Pressable onPress={startEdit} className="w-10 h-10 items-center justify-center rounded-xl active:opacity-60">
            <Text className="text-primary text-sm font-bold">Sửa</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => setEditing(false)} className="w-10 h-10 items-center justify-center active:opacity-60">
            <Text className="text-on-surface-variant text-sm">Hủy</Text>
          </Pressable>
        )}
      </View>

      <View className="px-5 gap-6 pb-12">
        {/* Avatar */}
        <View className="items-center pt-2">
          <Pressable onPress={pickAndUploadAvatar} disabled={uploadingAvatar} className="active:opacity-80">
            <View className="w-24 h-24 rounded-2xl overflow-hidden items-center justify-center" style={{ backgroundColor: '#1E40AF' }}>
              {profile?.avatar_url ? (
                <TwImage
                  source={{ uri: profile.avatar_url }}
                  className="w-24 h-24"
                  resizeMode="cover"
                />
              ) : (
                <Text className="text-white text-3xl font-extrabold">{initials}</Text>
              )}
              {uploadingAvatar && (
                <View className="absolute inset-0 items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}
            </View>
            <View className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-primary items-center justify-center border-2 border-surface">
              <Text className="text-white text-xs">✎</Text>
            </View>
          </Pressable>
          <Text className="text-xl font-extrabold text-on-surface mt-5 tracking-tight">
            {profile?.full_name ?? user?.full_name ?? '—'}
          </Text>
          <Text className="text-sm text-on-surface-variant mt-0.5">Field Staff</Text>
        </View>

        {/* Edit form */}
        {editing ? (
          <View className="bg-surface-container-lowest rounded-2xl p-5 gap-4">
            <Text className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Chỉnh sửa thông tin</Text>

            <View>
              <Text className="text-xs text-on-surface-variant mb-1">Họ và tên</Text>
              <TextInput
                className="h-11 px-3 bg-surface-container rounded-xl text-on-surface text-sm"
                value={fullName}
                onChangeText={setFullName}
                placeholder="Họ và tên"
                placeholderTextColor="#737685"
              />
            </View>

            <View>
              <Text className="text-xs text-on-surface-variant mb-1">Số điện thoại</Text>
              <TextInput
                className="h-11 px-3 bg-surface-container rounded-xl text-on-surface text-sm"
                value={phone}
                onChangeText={setPhone}
                placeholder="0xxx xxx xxx"
                placeholderTextColor="#737685"
                keyboardType="phone-pad"
              />
            </View>

            <View>
              <Text className="text-xs text-on-surface-variant mb-1">Căn cước công dân (CCCD)</Text>
              <TextInput
                className="h-11 px-3 bg-surface-container rounded-xl text-on-surface text-sm"
                value={cccd}
                onChangeText={setCccd}
                placeholder="12 chữ số"
                placeholderTextColor="#737685"
                keyboardType="numeric"
                maxLength={12}
              />
            </View>

            <Pressable
              onPress={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
              className="kinetic-gradient rounded-xl py-3 items-center active:opacity-80 disabled:opacity-50"
            >
              {updateMutation.isPending
                ? <ActivityIndicator color="#fff" />
                : <Text className="text-on-primary font-bold">Lưu thay đổi</Text>
              }
            </Pressable>
          </View>
        ) : (
          /* Contact info (read mode) */
          <View className="bg-surface-container-lowest rounded-2xl overflow-hidden">
            <View className="px-4 py-3 flex-row items-center gap-3 border-b border-surface-container">
              <View className="w-8 h-8 rounded-lg bg-surface-container items-center justify-center">
                <Text>✉️</Text>
              </View>
              <View className="flex-1">
                <Text className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Email</Text>
                <Text className="text-sm font-medium text-on-surface" numberOfLines={1}>{profile?.email ?? user?.email ?? '—'}</Text>
              </View>
            </View>

            <View className="px-4 py-3 flex-row items-center gap-3 border-b border-surface-container">
              <View className="w-8 h-8 rounded-lg bg-surface-container items-center justify-center">
                <Text>📞</Text>
              </View>
              <View className="flex-1">
                <Text className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Điện thoại</Text>
                <Text className={`text-sm font-medium ${profile?.phone ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                  {profile?.phone ?? 'Chưa cập nhật'}
                </Text>
              </View>
            </View>

            <View className="px-4 py-3 flex-row items-center gap-3">
              <View className="w-8 h-8 rounded-lg bg-surface-container items-center justify-center">
                <Text>🪪</Text>
              </View>
              <View className="flex-1">
                <Text className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">CCCD</Text>
                <Text className={`text-sm font-medium ${profile?.cccd ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                  {profile?.cccd ?? 'Chưa cập nhật'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Certificates */}
        <View>
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              Chứng chỉ ({profile?.certificates?.length ?? 0})
            </Text>
            <Pressable onPress={pickAndUploadCert} disabled={uploadingCert} className="active:opacity-60">
              {uploadingCert
                ? <ActivityIndicator size="small" color="#1E40AF" />
                : <Text className="text-sm font-bold text-primary">+ Thêm</Text>
              }
            </Pressable>
          </View>

          {(profile?.certificates ?? []).length === 0 ? (
            <View className="bg-surface-container-lowest rounded-2xl py-8 items-center">
              <Text className="text-on-surface-variant text-sm">Chưa có chứng chỉ nào</Text>
              <Text className="text-xs text-on-surface-variant mt-1">Thêm chứng chỉ để tăng cơ hội được duyệt</Text>
            </View>
          ) : (
            <View className="gap-3">
              {profile!.certificates.map(cert => (
                <View key={cert.id} className="bg-surface-container-lowest rounded-2xl overflow-hidden">
                  <RNPressable>
                    <Image
                      source={{ uri: cert.file_url }}
                      style={{ width: '100%', height: 160, backgroundColor: '#e5e7eb' }}
                      resizeMode="cover"
                    />
                  </RNPressable>
                  <View className="px-4 py-3 flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-on-surface">{cert.name}</Text>
                      <Text className="text-xs text-on-surface-variant mt-0.5">
                        {new Date(cert.uploaded_at).toLocaleDateString('vi-VN')}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => {
                        Alert.alert('Xóa chứng chỉ', `Xóa "${cert.name}"?`, [
                          { text: 'Hủy', style: 'cancel' },
                          { text: 'Xóa', style: 'destructive', onPress: () => deleteCertMutation.mutate(cert.id) },
                        ]);
                      }}
                      disabled={deleteCertMutation.isPending}
                      className="active:opacity-60 ml-3"
                    >
                      <Text className="text-xs font-semibold text-error">Xóa</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Online Status — read-only, tự động từ hệ thống */}
        <View>
          <Text className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">
            Trạng thái
          </Text>
          <View className="bg-surface-container-lowest rounded-2xl px-4 py-4 flex-row items-center gap-3">
            <View
              className="w-10 h-10 rounded-xl items-center justify-center"
              style={{ backgroundColor: ONLINE_STATUS_CONFIG[currentStatus].bg }}
            >
              <Text style={{ fontSize: 20 }}>{ONLINE_STATUS_CONFIG[currentStatus].icon}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-sm font-bold" style={{ color: ONLINE_STATUS_CONFIG[currentStatus].color }}>
                {ONLINE_STATUS_CONFIG[currentStatus].label}
              </Text>
              <Text className="text-xs text-on-surface-variant mt-0.5">
                {currentStatus === 'online'  && 'Bạn có ca làm việc hôm nay'}
                {currentStatus === 'working' && 'Đang thực hiện công việc'}
                {currentStatus === 'offline' && 'Không có ca hôm nay hoặc đang nghỉ phép'}
              </Text>
            </View>
            <View
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: ONLINE_STATUS_CONFIG[currentStatus].dot }}
            />
          </View>
        </View>

        {/* Workspace */}
        <View>
          <Text className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">Workspace</Text>
          <View className="bg-surface-container-lowest rounded-2xl overflow-hidden">
            <View className="px-4 py-3 flex-row items-center gap-3 border-b border-surface-container">
              <View className="w-8 h-8 rounded-lg bg-surface-container items-center justify-center">
                <Text>🏢</Text>
              </View>
              <View className="flex-1">
                <Text className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Workspace hiện tại</Text>
                <Text className="text-sm font-medium text-on-surface" numberOfLines={1}>{workspaceName}</Text>
              </View>
            </View>
            <Pressable
              onPress={() => setLeaveVisible(true)}
              className="px-4 py-4 flex-row items-center gap-3 active:opacity-60"
            >
              <View className="w-8 h-8 rounded-lg bg-error-container items-center justify-center">
                <Text>🚶</Text>
              </View>
              <Text className="text-base font-semibold text-error flex-1">Rời workspace</Text>
              <Text className="text-on-surface-variant">›</Text>
            </Pressable>
          </View>
        </View>

        {/* Logout */}
        <View className="bg-surface-container-lowest rounded-2xl overflow-hidden">
          <Pressable
            onPress={async () => { await logout(); router.replace('/(auth)/login'); }}
            className="px-4 py-4 flex-row items-center gap-3 active:opacity-60"
          >
            <View className="w-8 h-8 rounded-lg bg-error-container items-center justify-center">
              <Text>🚪</Text>
            </View>
            <Text className="text-base font-semibold text-error flex-1">Đăng xuất</Text>
            <Text className="text-on-surface-variant">›</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
    </>
  );
}
