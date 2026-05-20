import { FlatList, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { View, Text, Pressable } from '@/tw';
import { notificationsApi } from '@/lib/api/notifications';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorView } from '@/components/ui/ErrorView';
import { useAuth } from '@/context/auth';
import type { Notification } from '@/types/api';

// Reminder (warning) — vàng: bold "X min"
function ReminderBody({ body }: { body: string }) {
  const match = body.match(/^(.*deadline in )(\d+ min)(.*)$/);
  if (!match) return <Text className="text-sm text-on-warning-container">{body}</Text>;
  return (
    <Text className="text-sm text-on-warning-container">
      {match[1]}
      <Text className="font-bold">{match[2]}</Text>
      {match[3]}
    </Text>
  );
}

// Overdue — đỏ: bold "overdued"
function OverdueBody({ body }: { body: string }) {
  const match = body.match(/^(.*)(overdued)(.*)$/);
  if (!match) return <Text className="text-sm text-on-error-container">{body}</Text>;
  return (
    <Text className="text-sm text-on-error-container">
      {match[1]}
      <Text className="font-bold">{match[2]}</Text>
      {match[3]}
    </Text>
  );
}

function NotificationItem({
  item,
  onMarkRead,
  onNavigate,
}: {
  item: Notification;
  onMarkRead: (id: string) => void;
  onNavigate: (item: Notification) => void;
}) {
  const isReminder = item.type === 'reminder';
  const isOverdue = item.type === 'overdue';
  const isAlert = isReminder || isOverdue;

  // Màu theo loại — alert luôn giữ nền màu dù đã đọc hay chưa để dễ nhận diện
  const bgClass = isOverdue
    ? 'bg-error-container'
    : isReminder
    ? 'bg-warning-container'
    : !item.is_read ? 'bg-secondary-container' : 'bg-surface-container-lowest';

  // Unread: màu tươi; Read: màu xẩm hơn nhưng vẫn giữ theme màu
  const titleClass = isOverdue
    ? !item.is_read ? 'text-error' : 'text-on-error-container'
    : isReminder
    ? !item.is_read ? 'text-warning' : 'text-on-warning-container'
    : 'text-on-surface';

  const accentClass = isOverdue ? 'bg-error' : isReminder ? 'bg-warning' : 'bg-primary';

  const handlePress = () => {
    if (!item.is_read) onMarkRead(item.id);
    onNavigate(item);
  };

  return (
    <Pressable
      onPress={handlePress}
      className={`px-4 py-4 mb-2 mx-4 rounded-xl active:opacity-70 overflow-hidden ${bgClass}`}
    >
      {!item.is_read && (
        <View className={`absolute left-0 top-0 bottom-0 w-1 ${accentClass}`} />
      )}
      <View className="flex-row items-start">
        <View className="flex-1">
          <Text className={`text-sm font-bold mb-0.5 ${titleClass}`}>{item.title}</Text>
          {isOverdue
            ? <OverdueBody body={item.body} />
            : isReminder
            ? <ReminderBody body={item.body} />
            : <Text className="text-sm text-on-surface-variant">{item.body}</Text>
          }
          <Text className="text-xs text-outline mt-1.5">
            {new Date(item.created_at).toLocaleString('vi-VN')}
          </Text>
        </View>
        {!item.is_read && (
          <View className={`w-2 h-2 rounded-full mt-1.5 ml-3 flex-shrink-0 ${accentClass}`} />
        )}
      </View>
    </Pressable>
  );
}

function getTaskRoute(taskId: string, role: string | null) {
  if (role === 'business_owner') return `/(bo)/tasks/${taskId}` as const;
  if (role === 'operator') return `/(ot)/tasks/${taskId}` as const;
  if (role === 'staff') return `/(staff)/tasks/${taskId}` as const;
  return null;
}

export default function NotificationCenterScreen() {
  const { role } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list(),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });

  const handleNavigate = (item: Notification) => {
    if (!item.task_id) return;
    const route = getTaskRoute(item.task_id, role);
    if (route) router.push(route);
  };

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
          <NotificationItem
            item={item}
            onMarkRead={(id) => markReadMutation.mutate(id)}
            onNavigate={handleNavigate}
          />
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
