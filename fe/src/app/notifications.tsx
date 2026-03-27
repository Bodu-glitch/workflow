import { FlatList, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { View, Text, Pressable } from '@/tw';
import { notificationsApi } from '@/lib/api/notifications';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorView } from '@/components/ui/ErrorView';
import type { Notification } from '@/types/api';

function NotificationItem({
  item,
  onMarkRead,
}: {
  item: Notification;
  onMarkRead: (id: string) => void;
}) {
  return (
    <Pressable
      onPress={() => { if (!item.is_read) onMarkRead(item.id); }}
      className={`px-4 py-4 mb-2 mx-4 rounded-xl active:opacity-70 overflow-hidden ${
        !item.is_read ? 'bg-secondary-container' : 'bg-surface-container-lowest'
      }`}
    >
      {!item.is_read && (
        <View className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
      )}
      <View className="flex-row items-start">
        <View className="flex-1">
          <Text className="text-sm font-bold text-on-surface mb-0.5">{item.title}</Text>
          <Text className="text-sm text-on-surface-variant">{item.body}</Text>
          <Text className="text-xs text-outline mt-1.5">
            {new Date(item.created_at).toLocaleString('vi-VN')}
          </Text>
        </View>
        {!item.is_read && (
          <View className="w-2 h-2 rounded-full bg-primary mt-1.5 ml-3 flex-shrink-0" />
        )}
      </View>
    </Pressable>
  );
}

export default function NotificationCenterScreen() {
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list(),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  if (isLoading) return <LoadingScreen />;
  if (isError) return <ErrorView onRetry={refetch} />;

  const notifications = data?.data ?? [];
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <View className="flex-1 bg-surface-container-low">
      {/* Glass Header */}
      <View className="glass-effect px-5 pt-14 pb-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <Pressable onPress={() => router.back()} className="active:opacity-60">
              <Text className="text-primary font-semibold">← Back</Text>
            </Pressable>
            <View>
              <Text className="text-xl font-extrabold text-on-surface tracking-tight">Notifications</Text>
              {unreadCount > 0 && (
                <Text className="text-xs text-primary font-semibold">{unreadCount} unread</Text>
              )}
            </View>
          </View>
          {unreadCount > 0 && (
            <Pressable onPress={() => markAllReadMutation.mutate()} disabled={markAllReadMutation.isPending} className="active:opacity-60">
              <Text className="text-xs font-bold text-primary">Mark all read</Text>
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NotificationItem item={item} onMarkRead={(id) => markReadMutation.mutate(id)} />
        )}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        ListEmptyComponent={
          <View className="py-16 items-center">
            <Text className="text-on-surface-variant text-sm">No notifications</Text>
          </View>
        }
      />
    </View>
  );
}
