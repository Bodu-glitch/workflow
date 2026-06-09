import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView,
  TextInput, ActivityIndicator, Image, Platform,
} from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../lib/api';
import { COLORS } from '../../constants/config';

interface MenuItem {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  chevron?: boolean;
}

export default function ProfileScreen() {
  const { user, logout, refreshProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [address, setAddress] = useState(user?.address ?? '');
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchCurrentAddress = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Quyền bị từ chối', 'Cần cấp quyền vị trí để tự điền địa chỉ');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });

      if (Platform.OS === 'web') {
        // reverseGeocodeAsync is not reliably supported on web; fall back to OpenStreetMap Nominatim
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${loc.coords.latitude}&lon=${loc.coords.longitude}&format=json`,
            { headers: { 'Accept-Language': 'vi' } },
          );
          const json = await res.json();
          const a = json?.address ?? {};
          const strip = (s?: string) => s?.replace(/^(Thành phố|Quận|Huyện|Phường|Xã|Thị xã|Thị trấn)\s+/i, '').trim();
          const parts = [
            a.road,
            strip(a.suburb) || strip(a.quarter),
            strip(a.city ?? a.county ?? a.municipality),
          ].filter(Boolean);
          const formatted = parts.length > 0 ? parts.join(', ') : (json?.display_name ?? '');
          if (formatted) setAddress(formatted);
        } catch { /* silent — leave field empty */ }
        return;
      }

      const results = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      if (results.length > 0) {
        const a = results[0];
        const parts = [a.streetNumber, a.street, a.district, a.subregion ?? a.city].filter(Boolean);
        // Fall back to the full formatted name if individual components are missing
        const formatted = parts.length > 0 ? parts.join(', ') : (a.name ?? null);
        if (formatted) setAddress(formatted);
      }
    } catch { Alert.alert('Lỗi', 'Không thể lấy vị trí hiện tại'); }
    finally { setLocating(false); }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      if (window.confirm('Bạn có chắc muốn đăng xuất?')) logout();
      return;
    }
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
      await api.updateProfile({ full_name: fullName.trim(), phone: phone.trim(), address: address.trim() });
      await refreshProfile();
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
            <Text style={styles.editLabel}>Địa chỉ</Text>
            <View style={styles.addressRow}>
              <TextInput
                style={[styles.editInput, { flex: 1 }]}
                value={address}
                onChangeText={setAddress}
                placeholder="Số nhà, đường, quận..."
                placeholderTextColor={COLORS.textSecondary}
              />
              <TouchableOpacity style={styles.gpsBtn} onPress={fetchCurrentAddress} disabled={locating}>
                {locating
                  ? <ActivityIndicator size="small" color={COLORS.primary} />
                  : <Text style={styles.gpsBtnText}>📍</Text>
                }
              </TouchableOpacity>
            </View>
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
                  setAddress(user?.address ?? '');
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
              { icon: '📍', label: 'Địa chỉ', value: user?.address ?? 'Chưa cập nhật' },
              { icon: '✉️', label: 'Email', value: user?.email ?? '' },
            ].map((item, i) => (
              <View key={i} style={[styles.infoRow, i < 3 && styles.infoRowBorder]}>
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
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gpsBtn: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  gpsBtnText: { fontSize: 20 },
  editBtns: { flexDirection: 'row', gap: 8, marginTop: 8 },
  saveBtn: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 12, padding: 14, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  cancelBtn: { paddingHorizontal: 20, borderRadius: 12, padding: 14, alignItems: 'center', backgroundColor: COLORS.background },
  cancelBtnText: { color: COLORS.textSecondary, fontWeight: '600', fontSize: 14 },
  logoutBtn: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: COLORS.error },
  logoutText: { color: COLORS.error, fontWeight: '600', fontSize: 15 },
});
