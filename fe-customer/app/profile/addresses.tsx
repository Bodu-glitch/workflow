import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { api } from '../../lib/api';
import { COLORS } from '../../constants/config';

interface Address {
  id: string;
  label: string;
  address: string;
  lat?: number;
  lng?: number;
  is_default: boolean;
}

export default function AddressesScreen() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAddresses = async () => {
    try {
      const data = await api.get<Address[]>('/customer/addresses');
      setAddresses(data);
    } catch (e) {
      console.warn('Fetch addresses error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchAddresses(); }, []));

  const handleDelete = (id: string, label: string) => {
    Alert.alert('Xóa địa chỉ', `Xóa địa chỉ "${label}"?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa', style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/customer/addresses/${id}`);
            setAddresses(prev => prev.filter(a => a.id !== id));
          } catch (e: any) {
            Alert.alert('Lỗi', e.message);
          }
        },
      },
    ]);
  };

  const handleSetDefault = async (id: string) => {
    try {
      await api.patch(`/customer/addresses/${id}`, { is_default: true });
      setAddresses(prev => prev.map(a => ({ ...a, is_default: a.id === id })));
    } catch (e: any) {
      Alert.alert('Lỗi', e.message);
    }
  };

  const LABEL_ICONS: Record<string, string> = {
    'Nhà': '🏠', 'Văn phòng': '🏢', 'Khác': '📍',
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={addresses}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAddresses(); }} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📍</Text>
            <Text style={styles.emptyText}>Chưa có địa chỉ nào</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardIcon}>{LABEL_ICONS[item.label] ?? '📍'}</Text>
              <View style={styles.cardInfo}>
                <View style={styles.labelRow}>
                  <Text style={styles.cardLabel}>{item.label}</Text>
                  {item.is_default && (
                    <View style={styles.defaultBadge}>
                      <Text style={styles.defaultBadgeText}>Mặc định</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.cardAddress}>{item.address}</Text>
              </View>
            </View>
            <View style={styles.cardActions}>
              {!item.is_default && (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handleSetDefault(item.id)}
                >
                  <Text style={styles.actionBtnText}>Đặt mặc định</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => router.push({ pathname: '/profile/address-form', params: { id: item.id, label: item.label, address: item.address } })}
              >
                <Text style={styles.actionBtnText}>Sửa</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnDanger]}
                onPress={() => handleDelete(item.id, item.label)}
              >
                <Text style={[styles.actionBtnText, styles.actionBtnDangerText]}>Xóa</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => router.push('/profile/address-form')}
      >
        <Text style={styles.addBtnText}>+ Thêm địa chỉ mới</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, gap: 12, paddingBottom: 100 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 15, color: COLORS.textSecondary },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', gap: 12 },
  cardIcon: { fontSize: 24, marginTop: 2 },
  cardInfo: { flex: 1, gap: 4 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardLabel: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  defaultBadge: {
    backgroundColor: COLORS.primary + '20',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  defaultBadgeText: { fontSize: 11, color: COLORS.primary, fontWeight: '600' },
  cardAddress: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  cardActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  actionBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: COLORS.border,
  },
  actionBtnText: { fontSize: 12, color: COLORS.text, fontWeight: '500' },
  actionBtnDanger: { borderColor: COLORS.error },
  actionBtnDangerText: { color: COLORS.error },
  addBtn: {
    position: 'absolute', bottom: 24, left: 16, right: 16,
    backgroundColor: COLORS.primary, borderRadius: 14,
    padding: 16, alignItems: 'center',
    shadowColor: COLORS.primary, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
