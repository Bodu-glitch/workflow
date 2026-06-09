import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { api } from '../lib/api';
import { COLORS, STATUS_LABELS } from '../constants/config';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../hooks/useAuth';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  request_id?: string;
  created_at: string;
}

const TYPE_ICONS: Record<string, string> = {
  request_assigned: '👤',
  request_accepted: '✅',
  request_available: '🔔',
  request_completed: '🎉',
  request_cancelled: '❌',
  status_changed: '🔄',
  new_chat_message: '💬',
  reminder: '⏰',
};

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { token } = useAuth();
  const { onNotification } = useSocket(token);

  const fetch = async () => {
    try {
      const result = await api.get<{ data: Notification[] }>('/notifications?limit=50');
      setNotifications((result as any).data ?? result);
    } catch (e) {
      console.warn('Fetch notifications error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetch(); }, []));

  // Real-time: prepend new notifications from socket
  useEffect(() => {
    const off = onNotification((notif) => {
      setNotifications((prev) => {
        const exists = prev.some((n) => n.id === (notif as any).id);
        if (exists) return prev;
        return [{ ...(notif as Notification), is_read: false }, ...prev];
      });
    });
    return off;
  }, [onNotification]);

  const markAsRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
    } catch (e) {
      console.warn('Mark read error:', e);
    }
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (e) {
      console.warn('Mark all read error:', e);
    }
  };

  const handlePress = (notif: Notification) => {
    if (!notif.is_read) markAsRead(notif.id);
    if (notif.request_id) {
      router.push({ pathname: '/request/[id]', params: { id: notif.request_id } });
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Vừa xong';
    if (diffMin < 60) return `${diffMin} phút trước`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH} giờ trước`;
    return d.toLocaleDateString('vi-VN');
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
      {/* Header actions */}
      {unreadCount > 0 && (
        <View style={styles.header}>
          <Text style={styles.unreadLabel}>{unreadCount} chưa đọc</Text>
          <TouchableOpacity onPress={markAllRead}>
            <Text style={styles.markAllBtn}>Đánh dấu tất cả đã đọc</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={notifications}
        keyExtractor={item => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetch(); }}
          />
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyText}>Chưa có thông báo nào</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.item, !item.is_read && styles.itemUnread]}
            onPress={() => handlePress(item)}
            activeOpacity={0.8}
          >
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>{TYPE_ICONS[item.type] ?? '🔔'}</Text>
              {!item.is_read && <View style={styles.unreadDot} />}
            </View>
            <View style={styles.itemContent}>
              <Text style={[styles.itemTitle, !item.is_read && styles.itemTitleUnread]}>
                {item.title}
              </Text>
              <Text style={styles.itemBody} numberOfLines={2}>{item.body}</Text>
              <Text style={styles.itemTime}>{formatTime(item.created_at)}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  unreadLabel: { fontSize: 13, color: COLORS.textSecondary },
  markAllBtn: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  list: { padding: 0 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 15, color: COLORS.textSecondary },
  item: {
    flexDirection: 'row', padding: 16, gap: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  itemUnread: { backgroundColor: COLORS.primary + '08' },
  iconContainer: { position: 'relative' },
  icon: { fontSize: 28, width: 36, textAlign: 'center' },
  unreadDot: {
    position: 'absolute', top: 0, right: 0,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: COLORS.primary,
    borderWidth: 2, borderColor: COLORS.surface,
  },
  itemContent: { flex: 1, gap: 3 },
  itemTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  itemTitleUnread: { fontWeight: '800' },
  itemBody: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  itemTime: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
});
