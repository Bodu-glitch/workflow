import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Linking } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useRequests } from '../../hooks/useRequest';
import { StatusBadge } from '../../components/StatusBadge';
import { COLORS, CATEGORY_ICONS } from '../../constants/config';
import { API_BASE_URL } from '../../constants/config';
import { supabase } from '../../lib/supabase';
import type { ServiceRequest } from '../../types';

const HISTORY_STATUSES = ['completed', 'completed_late', 'cancelled'];

export default function HistoryScreen() {
  const { requests, loading, refresh } = useRequests();
  const router = useRouter();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const history = requests.filter((r) => HISTORY_STATUSES.includes(r.status));

  const handleDownloadInvoice = async (requestId: string) => {
    setDownloadingId(requestId);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Chưa đăng nhập');

      // Open in browser for download
      const url = `${API_BASE_URL}/requests/${requestId}/invoice`;
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url + '?token=' + token);
      } else {
        Alert.alert('Lỗi', 'Không thể mở trình duyệt để tải hóa đơn');
      }
    } catch (e: any) {
      Alert.alert('Lỗi', e.message ?? 'Không thể tải hóa đơn');
    } finally {
      setDownloadingId(null);
    }
  };

  const renderItem = ({ item }: { item: ServiceRequest }) => {
    const isCompleted = item.status === 'completed' || item.status === 'completed_late';
    const isDownloading = downloadingId === item.id;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/request/${item.id}`)}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.emoji}>
            {CATEGORY_ICONS[item.category?.slug ?? ''] ?? '🔧'}
          </Text>
          <View style={styles.cardInfo}>
            <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
            <Text style={styles.date}>
              {new Date(item.created_at).toLocaleDateString('vi-VN', {
                day: '2-digit', month: '2-digit', year: 'numeric',
              })}
            </Text>
          </View>
          <StatusBadge status={item.status} />
        </View>

        {/* Price + Actions row */}
        <View style={styles.cardFooter}>
          {(item as any).final_amount || item.agreed_price ? (
            <View>
              <Text style={styles.price}>
                {((item as any).final_amount ?? item.agreed_price)?.toLocaleString('vi-VN')}₫
              </Text>
              {(item as any).discount_amount > 0 && (
                <Text style={styles.discount}>
                  Đã giảm {(item as any).discount_amount?.toLocaleString('vi-VN')}₫
                </Text>
              )}
            </View>
          ) : <View />}

          {isCompleted && (
            <TouchableOpacity
              style={[styles.invoiceBtn, isDownloading && styles.invoiceBtnDisabled]}
              onPress={() => handleDownloadInvoice(item.id)}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Text style={styles.invoiceBtnText}>📄 Hóa đơn</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return <ActivityIndicator style={{ flex: 1 }} color={COLORS.primary} />;
  }

  return (
    <FlatList
      data={history}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      contentContainerStyle={styles.list}
      onRefresh={refresh}
      refreshing={loading}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>Chưa có yêu cầu nào</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  emoji: { fontSize: 28, width: 36 },
  cardInfo: { flex: 1, gap: 4 },
  description: { fontSize: 14, color: COLORS.text, fontWeight: '500' },
  date: { fontSize: 12, color: COLORS.textSecondary },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  price: { fontSize: 15, fontWeight: '700', color: COLORS.primary },
  discount: { fontSize: 12, color: COLORS.success },
  invoiceBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderColor: COLORS.primary,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6,
  },
  invoiceBtnDisabled: { opacity: 0.6 },
  invoiceBtnText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 15, color: COLORS.textSecondary },
});
