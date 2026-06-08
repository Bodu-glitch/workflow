import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView,
  TextInput, ActivityIndicator, Image,
} from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../lib/api';
import { COLORS } from '../../constants/config';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [saving, setSaving] = useState(false);

  const handleLogout = () => {
    Alert.alert('Đăng xuất', 'Bạn muốn đăng xuất?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: logout },
    ]);
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Lỗi', 'Tên không được để trống');
      return;
    }
    setSaving(true);
    try {
      await api.updateProfile({ full_name: fullName.trim(), phone: phone.trim() });
      setEditing(false);
      Alert.alert('✅ Đã cập nhật', 'Thông tin hồ sơ đã được lưu.');
    } catch (e: any) {
      Alert.alert('Lỗi', e.message ?? 'Không thể cập nhật');
    } finally {
      setSaving(false);
    }
  };

  const initials = user?.full_name
    ? user.full_name.trim().split(/\s+/).slice(-2).map((w) => w[0]?.toUpperCase()).join('')
    : '?';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar */}
      <View style={styles.avatarSection}>
        {user?.avatar_url ? (
          <Image source={{ uri: user.avatar_url }} style={styles.avatarImg} />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        )}
        <Text style={styles.name}>{user?.full_name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>Khách hàng</Text>
        </View>
      </View>

      {/* Info / Edit */}
      <View style={styles.section}>
        {editing ? (
          <View style={styles.editForm}>
            <Text style={styles.editLabel}>Họ và tên</Text>
            <TextInput
              style={styles.editInput}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Nhập họ và tên"
              placeholderTextColor={COLORS.textSecondary}
            />
            <Text style={styles.editLabel}>Số điện thoại</Text>
            <TextInput
              style={styles.editInput}
              value={phone}
              onChangeText={setPhone}
              placeholder="+84 xxx xxx xxx"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="phone-pad"
            />
            <View style={styles.editBtns}>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSave}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.saveBtnText}>Lưu thay đổi</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setFullName(user?.full_name ?? '');
                  setPhone(user?.phone ?? '');
                  setEditing(false);
                }}
              >
                <Text style={styles.cancelBtnText}>Hủy</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            {[
              { icon: '👤', label: 'Họ và tên', value: user?.full_name ?? 'Chưa cập nhật' },
              { icon: '📞', label: 'Số điện thoại', value: user?.phone ?? 'Chưa cập nhật' },
              { icon: '✉️', label: 'Email', value: user?.email ?? '' },
            ].map((item, i) => (
              <View key={i} style={[styles.infoRow, i < 2 && styles.infoRowBorder]}>
                <Text style={styles.infoIcon}>{item.icon}</Text>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>{item.label}</Text>
                  <Text style={styles.infoValue}>{item.value}</Text>
                </View>
              </View>
            ))}
            <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
              <Text style={styles.editBtnText}>✏️ Chỉnh sửa hồ sơ</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>🚪 Đăng xuất</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, gap: 20 },
  avatarSection: { alignItems: 'center', gap: 8, paddingVertical: 20 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 80, height: 80, borderRadius: 40 },
  avatarText: { fontSize: 32, fontWeight: '700', color: '#fff' },
  name: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  email: { fontSize: 13, color: COLORS.textSecondary },
  roleBadge: { backgroundColor: COLORS.primary + '15', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  roleText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  section: { backgroundColor: COLORS.surface, borderRadius: 16, overflow: 'hidden' },
  infoRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  infoIcon: { fontSize: 20, width: 28 },
  infoContent: { flex: 1, gap: 2 },
  infoLabel: { fontSize: 11, color: COLORS.textSecondary },
  infoValue: { fontSize: 14, color: COLORS.text, fontWeight: '500' },
  editBtn: { margin: 12, padding: 12, borderRadius: 12, backgroundColor: COLORS.primary + '10', alignItems: 'center' },
  editBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  editForm: { padding: 16, gap: 8 },
  editLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginTop: 4 },
  editInput: {
    backgroundColor: COLORS.background, borderRadius: 12, padding: 12,
    fontSize: 14, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border,
  },
  editBtns: { flexDirection: 'row', gap: 8, marginTop: 8 },
  saveBtn: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 12, padding: 14, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  cancelBtn: { paddingHorizontal: 20, borderRadius: 12, padding: 14, alignItems: 'center', backgroundColor: COLORS.background },
  cancelBtnText: { color: COLORS.textSecondary, fontWeight: '600', fontSize: 14 },
  logoutBtn: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: COLORS.error },
  logoutText: { color: COLORS.error, fontWeight: '600', fontSize: 15 },
});
