import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView,
  TextInput, ActivityIndicator, Image, Platform,
} from 'react-native';
import * as Location from 'expo-location';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../lib/api';
import type { SavedAddress } from '../../lib/api';
import { COLORS } from '../../constants/config';

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const LABEL_SUGGESTIONS = ['Nhà', 'Văn phòng', 'Kho', 'Cơ sở 2'];

async function nominatimReverse(lat: number, lon: number): Promise<string> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
    { headers: { 'Accept-Language': 'vi' } },
  );
  const json = await res.json();
  const a = json?.address ?? {};
  const strip = (s?: string) => s?.replace(/^(Thành phố|Quận|Huyện|Phường|Xã|Thị xã|Thị trấn)\s+/i, '').trim();
  const parts = [a.road, strip(a.suburb) || strip(a.quarter), strip(a.city ?? a.county ?? a.municipality)].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : (json?.display_name ?? '');
}

export default function ProfileScreen() {
  const { user, logout, refreshProfile } = useAuth();

  // ── Basic info editing ────────────────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [saving, setSaving] = useState(false);

  // ── Addresses ─────────────────────────────────────────────────────────────
  const [addresses, setAddresses] = useState<SavedAddress[]>(
    () => user?.addresses?.length ? user.addresses : (
      user?.address ? [{ id: genId(), label: 'Nhà', address: user.address, is_default: true }] : []
    ),
  );
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [locating, setLocating] = useState(false);
  const [savingAddr, setSavingAddr] = useState(false);

  const fetchCurrentAddress = async (setter: (v: string) => void) => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Quyền bị từ chối', 'Cần cấp quyền vị trí'); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (Platform.OS === 'web') {
        const addr = await nominatimReverse(loc.coords.latitude, loc.coords.longitude);
        if (addr) setter(addr);
      } else {
        const results = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        if (results.length > 0) {
          const a = results[0];
          const parts = [a.streetNumber, a.street, a.district, a.subregion ?? a.city].filter(Boolean);
          setter(parts.length > 0 ? parts.join(', ') : (a.name ?? ''));
        }
      }
    } catch { Alert.alert('Lỗi', 'Không thể lấy vị trí hiện tại'); }
    finally { setLocating(false); }
  };

  const saveAddresses = async (list: SavedAddress[]) => {
    setSavingAddr(true);
    try {
      await api.updateProfile({ addresses: list });
      setAddresses(list);
      await refreshProfile();
    } catch (e: any) {
      Alert.alert('Lỗi', e.message ?? 'Không thể lưu địa chỉ');
    } finally { setSavingAddr(false); }
  };

  const handleAddAddress = async () => {
    if (!newAddress.trim()) { Alert.alert('Lỗi', 'Vui lòng nhập địa chỉ'); return; }
    const label = newLabel.trim() || 'Địa chỉ';
    const isFirst = addresses.length === 0;
    const newItem: SavedAddress = { id: genId(), label, address: newAddress.trim(), is_default: isFirst };
    await saveAddresses([...addresses, newItem]);
    setNewLabel('');
    setNewAddress('');
    setShowAddForm(false);
  };

  const handleSetDefault = async (id: string) => {
    await saveAddresses(addresses.map((a) => ({ ...a, is_default: a.id === id })));
  };

  const handleDeleteAddress = (id: string) => {
    const target = addresses.find((a) => a.id === id);
    Alert.alert('Xác nhận', `Xóa "${target?.label}"?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa', style: 'destructive',
        onPress: async () => {
          let updated = addresses.filter((a) => a.id !== id);
          if (updated.length > 0 && !updated.some((a) => a.is_default)) {
            updated = [{ ...updated[0], is_default: true }, ...updated.slice(1)];
          }
          await saveAddresses(updated);
        },
      },
    ]);
  };

  const handleSave = async () => {
    if (!fullName.trim()) { Alert.alert('Lỗi', 'Tên không được để trống'); return; }
    setSaving(true);
    try {
      await api.updateProfile({ full_name: fullName.trim(), phone: phone.trim() });
      await refreshProfile();
      setEditing(false);
      Alert.alert('✅ Đã cập nhật', 'Thông tin hồ sơ đã được lưu.');
    } catch (e: any) {
      Alert.alert('Lỗi', e.message ?? 'Không thể cập nhật');
    } finally { setSaving(false); }
  };

  const handleLogout = () => logout();

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
        <View style={styles.roleBadge}><Text style={styles.roleText}>Khách hàng</Text></View>
      </View>

      {/* Basic Info */}
      <View style={styles.section}>
        {editing ? (
          <View style={styles.editForm}>
            <Text style={styles.editLabel}>Họ và tên</Text>
            <TextInput style={styles.editInput} value={fullName} onChangeText={setFullName} placeholder="Nhập họ và tên" placeholderTextColor={COLORS.textSecondary} />
            <Text style={styles.editLabel}>Số điện thoại</Text>
            <TextInput style={styles.editInput} value={phone} onChangeText={setPhone} placeholder="+84 xxx xxx xxx" placeholderTextColor={COLORS.textSecondary} keyboardType="phone-pad" />
            <View style={styles.editBtns}>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Lưu thay đổi</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setFullName(user?.full_name ?? ''); setPhone(user?.phone ?? ''); setEditing(false); }}>
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

      {/* Addresses section header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>📍 Địa chỉ đã lưu</Text>
        <TouchableOpacity onPress={() => setShowAddForm((v) => !v)} style={styles.addAddrBtn}>
          <Text style={styles.addAddrBtnText}>{showAddForm ? '✕ Đóng' : '+ Thêm'}</Text>
        </TouchableOpacity>
      </View>

      {/* Add new address form */}
      {showAddForm && (
        <View style={styles.section}>
          <View style={styles.editForm}>
            <Text style={styles.editLabel}>Tên địa chỉ</Text>
            <TextInput style={styles.editInput} value={newLabel} onChangeText={setNewLabel} placeholder="Nhà, Văn phòng, Kho..." placeholderTextColor={COLORS.textSecondary} />
            <View style={styles.suggestionRow}>
              {LABEL_SUGGESTIONS.map((s) => (
                <TouchableOpacity key={s} onPress={() => setNewLabel(s)} style={[styles.suggestionChip, newLabel === s && styles.suggestionChipActive]}>
                  <Text style={[styles.suggestionChipText, newLabel === s && styles.suggestionChipTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.editLabel}>Địa chỉ</Text>
            <View style={styles.addressRow}>
              <TextInput style={[styles.editInput, { flex: 1 }]} value={newAddress} onChangeText={setNewAddress} placeholder="Số nhà, đường, quận..." placeholderTextColor={COLORS.textSecondary} />
              <TouchableOpacity style={styles.gpsBtn} onPress={() => fetchCurrentAddress(setNewAddress)} disabled={locating}>
                {locating ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Text style={styles.gpsBtnText}>📍</Text>}
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.saveBtn, savingAddr && { opacity: 0.6 }]} onPress={handleAddAddress} disabled={savingAddr}>
              {savingAddr ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Lưu địa chỉ</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Address list */}
      <View style={styles.section}>
        {addresses.length === 0 ? (
          <Text style={[styles.infoValue, { color: COLORS.textSecondary, textAlign: 'center', padding: 20 }]}>
            Chưa có địa chỉ nào. Nhấn "+ Thêm" để thêm mới.
          </Text>
        ) : (
          addresses.map((addr, i) => (
            <View key={addr.id} style={[styles.addrRow, i < addresses.length - 1 && styles.infoRowBorder]}>
              <View style={styles.addrIconWrap}>
                <Text style={{ fontSize: 18 }}>{addr.label === 'Nhà' ? '🏠' : addr.label === 'Văn phòng' ? '🏢' : '📍'}</Text>
              </View>
              <View style={styles.addrContent}>
                <View style={styles.addrLabelRow}>
                  <Text style={styles.addrLabel}>{addr.label}</Text>
                  {addr.is_default && <View style={styles.defaultBadge}><Text style={styles.defaultBadgeText}>Mặc định</Text></View>}
                </View>
                <Text style={styles.addrText} numberOfLines={2}>{addr.address}</Text>
              </View>
              <View style={styles.addrActions}>
                {!addr.is_default && (
                  <TouchableOpacity onPress={() => handleSetDefault(addr.id)} style={styles.addrActionBtn} disabled={savingAddr}>
                    <Text style={{ fontSize: 16 }}>⭐</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => handleDeleteAddress(addr.id)} style={styles.addrActionBtn} disabled={savingAddr}>
                  <Text style={{ fontSize: 16 }}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
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
  content: { padding: 20, gap: 16 },
  avatarSection: { alignItems: 'center', gap: 8, paddingVertical: 20 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 80, height: 80, borderRadius: 40 },
  avatarText: { fontSize: 32, fontWeight: '700', color: '#fff' },
  name: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  email: { fontSize: 13, color: COLORS.textSecondary },
  roleBadge: { backgroundColor: COLORS.primary + '15', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  roleText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  section: { backgroundColor: COLORS.surface, borderRadius: 16, overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  addAddrBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: COLORS.primary + '15', borderRadius: 20 },
  addAddrBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
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
  editInput: { backgroundColor: COLORS.background, borderRadius: 12, padding: 12, fontSize: 14, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gpsBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  gpsBtnText: { fontSize: 20 },
  editBtns: { flexDirection: 'row', gap: 8, marginTop: 8 },
  saveBtn: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 12, padding: 14, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  cancelBtn: { paddingHorizontal: 20, borderRadius: 12, padding: 14, alignItems: 'center', backgroundColor: COLORS.background },
  cancelBtnText: { color: COLORS.textSecondary, fontWeight: '600', fontSize: 14 },
  suggestionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 2 },
  suggestionChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.background },
  suggestionChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  suggestionChipText: { fontSize: 12, fontWeight: '600', color: COLORS.text },
  suggestionChipTextActive: { color: '#fff' },
  addrRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 10 },
  addrIconWrap: { paddingTop: 2, width: 28 },
  addrContent: { flex: 1, gap: 3 },
  addrLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addrLabel: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  defaultBadge: { backgroundColor: COLORS.primary + '15', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  defaultBadgeText: { fontSize: 10, fontWeight: '600', color: COLORS.primary },
  addrText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  addrActions: { flexDirection: 'row', gap: 2 },
  addrActionBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  logoutBtn: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: COLORS.error },
  logoutText: { color: COLORS.error, fontWeight: '600', fontSize: 15 },
});
