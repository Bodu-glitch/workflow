import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { View, Text, Pressable } from '@/tw';
import { notificationsApi } from '@/lib/api/notifications';
import { useAuth } from '@/context/auth';
import { supabase } from '@/lib/supabase';

export function NotifBell({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['unread-count'],
    queryFn: () => notificationsApi.unreadCount(),
    refetchInterval: 60_000, // fallback poll mỗi 60s nếu Realtime mất kết nối
  });

  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;

    const channel = supabase
      .channel(`notif-bell:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ['unread-count'] });
          qc.invalidateQueries({ queryKey: ['notifications'] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, qc]);

  const count = data?.data?.count ?? 0;
  const iconSize = size === 'sm' ? 'text-xl' : 'text-2xl';

  return (
    <Pressable
      onPress={() => router.push('/notifications')}
      className="w-10 h-10 items-center justify-center active:opacity-60"
    >
      <Text className={iconSize}>🔔</Text>
      {count > 0 && (
        <View
          className="absolute top-1 right-1 w-4 h-4 rounded-full items-center justify-center"
          style={{ backgroundColor: '#ba1a1a' }}
        >
          <Text className="text-white font-bold" style={{ fontSize: 9 }}>
            {count > 9 ? '9+' : count}
          </Text>
        </View>
      )}
    </Pressable>
  );
}