import { useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useRequests } from '../../hooks/useRequest';
import { StatusBadge } from '../../components/StatusBadge';
import { COLORS, CATEGORY_ICONS } from '../../constants/config';
import type { ServiceRequest } from '../../types';

const HISTORY_STATUSES = ['completed', 'completed_late', 'cancelled'];

export default function HistoryScreen() {
  const { requests, loading, refresh } = useRequests();
  const router = useRouter();

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const history = requests.filter((r) => HISTORY_STATUSES.includes(r.status));

  const renderItem = ({ item }: { item: ServiceRequest }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/request/${item.id}`)}
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
      <View style={styles.cardFooter}>
        {item.agreed_price ? (
          <Text style={styles.price}>
            {item.agreed_price.toLocaleString('vi-VN')}₫
          </Text>
        ) : <View />}
        {(item.status === 'completed' || item.status === 'completed_late') && (
          <TouchableOpacity
            onPress={() => router.push(`/request/${item.id}/bill` as any)}
            hitSlop={8}
          >
            <Text style={styles.billLink}>🧾 Hóa đơn</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

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
    borderRadius: 12,
    padding: 14,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  emoji: { fontSize: 28, width: 36 },
  cardInfo: { flex: 1, gap: 4 },
  description: { fontSize: 14, color: COLORS.text, fontWeight: '500' },
  date: { fontSize: 12, color: COLORS.textSecondary },
  price: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  billLink: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 15, color: COLORS.textSecondary },
});
