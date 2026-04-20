import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FlatList,
  TextInput as RNTextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { View, Text, Pressable } from '@/tw';
import { useAuth } from '@/context/auth';
import { supabase } from '@/lib/supabase';

interface ChatMessage {
  id: string;
  user_id: string;
  full_name: string;
  content: string;
  created_at: string;
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDateLabel(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).toUpperCase();
}

function isSameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function transformRow(row: any): ChatMessage {
  return {
    id: row.id,
    user_id: row.user_id,
    content: row.content,
    created_at: row.created_at,
    full_name: row.users?.full_name ?? 'Unknown',
  };
}

export default function ChatScreen() {
  const { user } = useAuth();
  const tenantId = user?.tenant_id;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const currentTenant = user?.tenants?.find((t) => t.id === tenantId) ?? user?.tenants?.[0];
  const tenantName = currentTenant?.name ?? 'Dispatch';

  const loadMessages = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from('chat_messages')
      .select('id, user_id, content, created_at, users!chat_messages_user_id_fkey(full_name)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true })
      .limit(50);
    if (data) setMessages(data.map(transformRow));
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel(`chat:${tenantId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `tenant_id=eq.${tenantId}` },
        async (payload) => {
          const { data } = await supabase
            .from('chat_messages')
            .select('id, user_id, content, created_at, users!chat_messages_user_id_fkey(full_name)')
            .eq('id', payload.new.id)
            .single();
          if (data) {
            setMessages((prev) => {
              // Deduplicate: skip if already present (optimistic insert)
              if (prev.some((m) => m.id === (data as any).id)) return prev;
              return [...prev, transformRow(data)];
            });
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !tenantId || sending) return;
    setInput('');
    setSending(true);
    const { error } = await supabase.from('chat_messages').insert({
      tenant_id: tenantId,
      user_id: user!.id,
      content: text,
    });
    if (error) {
      setInput(text);
      console.error('[Chat] insert error:', error.message, error.code);
    }
    setSending(false);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#f1f5f9' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* Header */}
      <View
        style={{
          backgroundColor: '#1E40AF',
          paddingTop: Platform.OS === 'web' ? 16 : 52,
          paddingBottom: 14,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Pressable onPress={() => router.back()} style={{ padding: 4, marginRight: 2 }} className="active:opacity-60">
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>←</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 17 }}>{tenantName}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ade80' }} />
            <Text style={{ color: '#93c5fd', fontSize: 11, fontWeight: '600', letterSpacing: 0.8 }}>OPERATIONAL</Text>
          </View>
        </View>
      </View>

      {/* Messages */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#1E40AF" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 8, gap: 4 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 48 }}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>💬</Text>
              <Text style={{ color: '#94a3b8', fontSize: 14 }}>No messages yet. Start the conversation!</Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const isOwn = item.user_id === user?.id;
            const prev = messages[index - 1];
            const showDate = !prev || !isSameDay(prev.created_at, item.created_at);
            const showAvatar = !isOwn && (index === messages.length - 1 || messages[index + 1]?.user_id !== item.user_id);

            return (
              <View>
                {showDate && (
                  <Text
                    style={{
                      textAlign: 'center',
                      fontSize: 11,
                      color: '#94a3b8',
                      fontWeight: '600',
                      letterSpacing: 0.5,
                      marginVertical: 12,
                    }}
                  >
                    {formatDateLabel(item.created_at)}
                  </Text>
                )}
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: isOwn ? 'flex-end' : 'flex-start',
                    alignItems: 'flex-end',
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  {/* Avatar placeholder for alignment on own messages */}
                  {!isOwn && (
                    <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: showAvatar ? '#dce9ff' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                      {showAvatar && (
                        <Text style={{ fontSize: 10, fontWeight: '800', color: '#1E40AF' }}>
                          {getInitials(item.full_name)}
                        </Text>
                      )}
                    </View>
                  )}

                  <View style={{ maxWidth: '72%' }}>
                    {!isOwn && showAvatar && (
                      <Text style={{ fontSize: 11, fontWeight: '600', color: '#64748b', marginBottom: 3, marginLeft: 4 }}>
                        {item.full_name}
                      </Text>
                    )}
                    <View
                      style={{
                        backgroundColor: isOwn ? '#1E40AF' : '#fff',
                        borderRadius: 18,
                        borderBottomRightRadius: isOwn ? 4 : 18,
                        borderBottomLeftRadius: isOwn ? 18 : 4,
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        shadowColor: '#000',
                        shadowOpacity: 0.06,
                        shadowRadius: 4,
                        elevation: 2,
                      }}
                    >
                      <Text style={{ color: isOwn ? '#fff' : '#0d1c2e', fontSize: 14, lineHeight: 20 }}>
                        {item.content}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontSize: 10,
                        color: '#94a3b8',
                        marginTop: 3,
                        textAlign: isOwn ? 'right' : 'left',
                        marginHorizontal: 4,
                      }}
                    >
                      {formatTime(item.created_at)}{isOwn ? ' · Delivered' : ''}
                    </Text>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Input bar */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          paddingHorizontal: 16,
          paddingVertical: 10,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#e2e8f0',
          gap: 10,
        }}
      >
        <RNTextInput
          value={input}
          onChangeText={setInput}
          placeholder="Type a message..."
          placeholderTextColor="#94a3b8"
          multiline
          textAlignVertical="center"
          style={{
            flex: 1,
            minHeight: 42,
            maxHeight: 100,
            backgroundColor: '#f1f5f9',
            borderRadius: 21,
            paddingHorizontal: 16,
            paddingTop: 11,
            paddingBottom: 11,
            fontSize: 14,
            lineHeight: 20,
            color: '#0d1c2e',
            ...(Platform.OS === 'web' && {
              outlineStyle: 'none',
              paddingTop: 0,
              paddingBottom: 0,
              height: 42,
              lineHeight: 42,
            } as any),
          }}
        />
        <Pressable
          onPress={sendMessage}
          disabled={!input.trim() || sending}
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: input.trim() ? '#1E40AF' : '#e2e8f0',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
          className="active:opacity-70"
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={{ color: input.trim() ? '#fff' : '#94a3b8', fontSize: 16 }}>➤</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
