import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '../../lib/api';
import { useLocation } from '../../hooks/useLocation';
import { COLORS } from '../../constants/config';

const LABEL_OPTIONS = ['Nhà', 'Văn phòng', 'Công trường', 'Khác'];

export default function AddressFormScreen() {
  const params = useLocalSearchParams<{ id?: string; label?: string; address?: string }>();
  const isEdit = !!params.id;
  const { location } = useLocation();

  const [label, setLabel] = useState(params.label ?? 'Nhà');
  const [address, setAddress] = useState(params.address ?? '');
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!address.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập địa chỉ');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        label,
        address: address.trim(),
        lat: location?.latitude,
        lng: location?.longitude,
        is_default: isDefault,
      };

      if (isEdit) {
        await api.patch(`/customer/addresses/${params.id}`, payload);
      } else {
        await api.post('/customer/addresses', payload);
      }

      Alert.alert('Thành công', isEdit ? 'Địa chỉ đã được cập nhật' : 'Địa chỉ đã được thêm');
      router.back();
    } catch (e: any) {
      Alert.alert('Lỗi', e.message ?? 'Không thể lưu địa chỉ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Loại địa chỉ</Text>
      <View style={styles.labelOptions}>
        {LABEL_OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt}
            style={[styles.labelChip, label === opt && styles.labelChipActive]}
            onPress={() => setLabel(opt)}
          >
            <Text style={[styles.labelChipText, label === opt && styles.labelChipTextActive]}>
              {opt}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Địa chỉ</Text>
      <TextInput
        style={styles.input}
        value={address}
        onChangeText={setAddress}
        placeholder="Nhập địa chỉ chi tiết"
        placeholderTextColor={COLORS.textSecondary}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
      />

      {!isEdit && (
        <TouchableOpacity
          style={styles.defaultToggle}
          onPress={() => setIsDefault(!isDefault)}
        >
          <View style={[styles.checkbox, isDefault && styles.checkboxActive]}>
            {isDefault && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.defaultText}>Đặt làm địa chỉ mặc định</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveBtnText}>{isEdit ? 'Cập nhật' : 'Thêm địa chỉ'}</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, gap: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.text, textTransform: 'uppercase', letterSpacing: 0.5 },
  labelOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  labelChip: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  labelChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '15' },
  labelChipText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '500' },
  labelChipTextActive: { color: COLORS.primary, fontWeight: '700' },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 80,
  },
  defaultToggle: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  defaultText: { fontSize: 15, color: COLORS.text },
  saveBtn: {
    backgroundColor: COLORS.primary, borderRadius: 14,
    padding: 16, alignItems: 'center', marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
