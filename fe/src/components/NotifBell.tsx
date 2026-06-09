import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { View, Text, Pressable } from '@/tw';
import { notificationsApi } from '@/lib/api/notifications';
import { useSocketContext } from '@/context/socket';

export function NotifBell({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const socket = useSocketContext();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['unread-count'],
    queryFn: () => notificationsApi.unreadCount(),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!socket) return;

    const handler = () => {
      qc.invalidateQueries({ queryKey: ['unread-count'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    };

    socket.on('notification:new', handler);
    return () => { socket.off('notification:new', handler); };
  }, [socket, qc]);

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
