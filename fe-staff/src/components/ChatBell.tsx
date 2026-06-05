import { useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { View, Text, Pressable } from '@/tw';
import { useAuth } from '@/context/auth';
import { supabase } from '@/lib/supabase';

const STORAGE_KEY = 'chat_last_read_at';

export async function markChatAsRead() {
  await AsyncStorage.setItem(STORAGE_KEY, new Date().toISOString());
}

export function ChatBell() {
  const { user } = useAuth();
  const tenantId = user?.tenant_id;
  const userId = user?.id;
  const [unread, setUnread] = useState(0);

  const fetchUnread = useCallback(async () => {
    if (!tenantId || !userId) return;
    const lastRead = await AsyncStorage.getItem(STORAGE_KEY);
    let query = supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .neq('user_id', userId);
    if (lastRead) query = query.gt('created_at', lastRead);
    const { count } = await query;
    setUnread(count ?? 0);
  }, [tenantId, userId]);

  useEffect(() => {
    fetchUnread();
  }, [fetchUnread]);

  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel(`chat-bell:${tenantId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `tenant_id=eq.${tenantId}` },
        () => fetchUnread(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId, fetchUnread]);

  return (
    <Pressable
      onPress={() => { setUnread(0); markChatAsRead(); router.push('/chat'); }}
      className="w-10 h-10 items-center justify-center active:opacity-60"
    >
      <Text className="text-xl">💬</Text>
      {unread > 0 && (
        <View
          className="absolute top-1 right-1 w-4 h-4 rounded-full items-center justify-center"
          style={{ backgroundColor: '#ba1a1a' }}
        >
          <Text className="text-white font-bold" style={{ fontSize: 9 }}>
            {unread > 9 ? '9+' : unread}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
