import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, Image,
} from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../lib/api';
import { COLORS } from '../../constants/config';

export default function EditProfileScreen() {
  const { user, refreshUser } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatar_url ?? null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const uploadAvatar = async (uri: string) => {
    setUploading(true);
    try {
      const formData = new FormData();
      const filename = uri.split('/').pop() ?? 'avatar.jpg';
      formData.append('file', { uri, name: filename, type: 'image/jpeg' } as any);
      await api.postForm('/customer/avatar', formData);
    } catch (e) {
      console.warn('Avatar upload failed:', e);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Upload avatar nếu đổi
      if (avatarUri && avatarUri !== user?.avatar_url) {
        await uploadAvatar(avatarUri);
      }
      // Cập nhật profile
      await api.patch('/customer/profile', { full_name: fullName, phone });
      await refreshUser?.();
      Alert.alert('Thành công', 'Hồ sơ đã được cập nhật');
      router.back();
    } catch (e: any) {
      Alert.alert('Lỗi', e.message ?? 'Không thể cập nhật hồ sơ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar */}
      <TouchableOpacity style={styles.avatarContainer} onPress={pickImage}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarText}>{fullName.charAt(0).toUpperCase() || '?'}</Text>
          </View>
        )}
        {uploading ? (
          <View style={styles.avatarOverlay}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : (
          <View style={styles.avatarOverlay}>
            <Text style={styles.cameraIcon}>📷</Text>
          </View>
        )}
      </TouchableOpacity>
      <Text style={styles.changePhotoText}>Thay đổi ảnh</Text>

      {/* Form */}
      <View style={styles.form}>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Họ và tên</Text>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Nhập họ và tên"
            placeholderTextColor={COLORS.textSecondary}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Số điện thoại</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="Nhập số điện thoại"
            placeholderTextColor={COLORS.textSecondary}
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[styles.input, styles.inputDisabled]}
            value={user?.email ?? ''}
            editable={false}
          />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveBtnText}>Lưu thay đổi</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, alignItems: 'center', gap: 16 },
  avatarContainer: { position: 'relative', marginTop: 8 },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarFallback: { backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 36, fontWeight: '700', color: '#fff' },
  avatarOverlay: {
    position: 'absolute', bottom: 0, right: 0,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  cameraIcon: { fontSize: 16 },
  changePhotoText: { fontSize: 13, color: COLORS.primary, fontWeight: '500' },
  form: { width: '100%', gap: 12 },
  fieldGroup: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inputDisabled: { backgroundColor: '#f3f4f6', color: COLORS.textSecondary },
  saveBtn: {
    width: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
