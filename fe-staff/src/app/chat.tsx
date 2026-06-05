import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FlatList,
  TextInput as RNTextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { View, Text, Pressable } from '@/tw';
import { useAuth } from '@/context/auth';
import { supabase } from '@/lib/supabase';
import { supportApi } from '@/lib/api/support';
import { markChatAsRead } from '@/components/ChatBell';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ChatMessage {
  id: string;
  user_id: string;
  full_name: string;
  content: string;
  created_at: string;
  type: 'text' | 'task_card';
  task_id?: string | null;
  ticket_id?: string | null;
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
    type: row.type ?? 'text',
    task_id: row.task_id ?? null,
    ticket_id: row.ticket_id ?? null,
  };
}

function TaskCard({ msg }: { msg: ChatMessage }) {
  const [taskDetails, setTaskDetails] = useState<{ title?: string; service_type?: string; location_name?: string; deadline?: string } | null>(null);

  useEffect(() => {
    if (!msg.task_id) return;
    supabase
      .from('tasks')
      .select('title, service_type, location_name, deadline')
      .eq('id', msg.task_id)
      .single()
      .then(({ data }) => { if (data) setTaskDetails(data); });
  }, [msg.task_id]);

  return (
    <Pressable
      onPress={() => msg.task_id && router.push(`/(staff)/tasks/${msg.task_id}` as any)}
      style={{
        backgroundColor: '#EFF6FF',
        borderRadius: 14,
        borderLeftWidth: 4,
        borderLeftColor: '#1E40AF',
        padding: 12,
        maxWidth: 280,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
      }}
      className="active:opacity-70"
    >
      <Text style={{ fontSize: 10, fontWeight: '700', color: '#1E40AF', letterSpacing: 0.5, marginBottom: 4 }}>
        🆘 YÊU CẦU HỖ TRỢ
      </Text>
      <Text style={{ fontSize: 14, fontWeight: '700', color: '#0d1c2e', marginBottom: 6 }} numberOfLines={2}>
        {taskDetails?.title ?? msg.content}
      </Text>
      {taskDetails?.service_type && (
        <Text style={{ fontSize: 12, color: '#374151', marginBottom: 3 }} numberOfLines={1}>
          🔧 {taskDetails.service_type}
        </Text>
      )}
      {taskDetails?.location_name && (
        <Text style={{ fontSize: 12, color: '#374151', marginBottom: 3 }} numberOfLines={1}>
          📍 {taskDetails.location_name}
        </Text>
      )}
      {taskDetails?.deadline && (
        <Text style={{ fontSize: 12, color: '#dc2626', marginBottom: 6, fontWeight: '600' }} numberOfLines={1}>
          ⏰ {new Date(taskDetails.deadline).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </Text>
      )}
      {msg.content && (
        <View style={{ borderTopWidth: 1, borderTopColor: '#bfdbfe', marginTop: 6, paddingTop: 6 }}>
          <Text style={{ fontSize: 13, color: '#1e3a5f', lineHeight: 18 }}>{msg.content}</Text>
        </View>
      )}
      <Text style={{ fontSize: 11, color: '#1E40AF', fontWeight: '600', marginTop: 6 }}>
        Nhấn để xem nhiệm vụ →
      </Text>
    </Pressable>
  );
}

function ReplyBubble({ msg, isOwn }: { msg: ChatMessage; isOwn: boolean }) {
  const [taskTitle, setTaskTitle] = useState<string | null>(null);

  useEffect(() => {
    if (!msg.ticket_id) return;
    supabase
      .from('support_tickets')
      .select('tasks(title)')
      .eq('id', msg.ticket_id)
      .single()
      .then(({ data }) => {
        if (data) setTaskTitle((data as any).tasks?.title ?? null);
      });
  }, [msg.ticket_id]);

  const quoteColor = isOwn ? 'rgba(255,255,255,0.15)' : '#EFF6FF';
  const quoteBorderColor = isOwn ? 'rgba(255,255,255,0.5)' : '#1E40AF';
  const labelColor = isOwn ? 'rgba(255,255,255,0.7)' : '#1E40AF';
  const titleColor = isOwn ? 'rgba(255,255,255,0.85)' : '#374151';

  return (
    <View
      style={{
        backgroundColor: isOwn ? '#1E40AF' : '#fff',
        borderRadius: 18,
        borderBottomRightRadius: isOwn ? 4 : 18,
        borderBottomLeftRadius: isOwn ? 18 : 4,
        overflow: 'hidden',
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 4,
      }}
    >
      <View
        style={{
          borderLeftWidth: 3,
          borderLeftColor: quoteBorderColor,
          backgroundColor: quoteColor,
          paddingHorizontal: 10,
          paddingVertical: 6,
          margin: 8,
          marginBottom: 4,
          borderRadius: 6,
        }}
      >
        <Text style={{ fontSize: 10, fontWeight: '700', color: labelColor, marginBottom: 2, letterSpacing: 0.3 }}>
          ↩ Phản hồi yêu cầu hỗ trợ
        </Text>
        {taskTitle && (
          <Text style={{ fontSize: 12, color: titleColor, fontWeight: '500' }} numberOfLines={1}>
            {taskTitle}
          </Text>
        )}
      </View>
      <View style={{ paddingHorizontal: 14, paddingBottom: 10, paddingTop: 2 }}>
        <Text style={{ color: isOwn ? '#fff' : '#0d1c2e', fontSize: 14, lineHeight: 20 }}>
          {msg.content}
        </Text>
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const { user } = useAuth();
  const tenantId = user?.tenant_id;
  const { pendingTaskId, pendingTaskTitle } = useLocalSearchParams<{ pendingTaskId?: string; pendingTaskTitle?: string }>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingTask, setPendingTask] = useState<{ id: string; title: string; service_type?: string; location_name?: string; deadline?: string } | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const isAtBottom = useRef(true);
  const hasLoaded = useRef(false);
  const firstUnreadIndex = useRef<number | null>(null);
  const isScrollingToBottom = useRef(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!pendingTaskId || !pendingTaskTitle) return;
    const title = decodeURIComponent(pendingTaskTitle);
    setPendingTask({ id: pendingTaskId, title });
    supabase
      .from('tasks')
      .select('service_type, location_name, deadline')
      .eq('id', pendingTaskId)
      .single()
      .then(({ data }) => {
        if (data) setPendingTask({ id: pendingTaskId, title, ...data });
      });
  }, [pendingTaskId, pendingTaskTitle]);

  const currentTenant = user?.tenants?.find((t) => t.id === tenantId) ?? user?.tenants?.[0];
  const tenantName = currentTenant?.name ?? 'Dispatch';

  const loadMessages = useCallback(async () => {
    if (!tenantId) return;
    const lastRead = await AsyncStorage.getItem('chat_last_read_at');
    const { data } = await supabase
      .from('chat_messages')
      .select('id, user_id, content, type, task_id, ticket_id, created_at, users!chat_messages_user_id_fkey(full_name)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true })
      .limit(50);
    if (data) {
      const rows = data.map(transformRow);
      setMessages(rows);
      if (lastRead) {
        const idx = rows.findIndex(m => m.created_at > lastRead && m.user_id !== user?.id);
        firstUnreadIndex.current = idx >= 0 ? idx : null;
      }
    }
    setLoading(false);
  }, [tenantId, user?.id]);

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
            .select('id, user_id, content, type, task_id, ticket_id, created_at, users!chat_messages_user_id_fkey(full_name)')
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
    try {
      if (pendingTask) {
        // Tạo ticket → description được lưu trong content của task_card
        await supportApi.createTicket(pendingTask.id, text);
        setPendingTask(null);
      } else {
        const { error } = await supabase.from('chat_messages').insert({
          tenant_id: tenantId,
          user_id: user!.id,
          content: text,
        });
        if (error) throw error;
      }
    } catch (e: any) {
      setInput(text);
      console.error('[Chat] send error:', e?.message ?? e);
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
          onContentSizeChange={() => {
            if (!hasLoaded.current) {
              hasLoaded.current = true;
              const idx = firstUnreadIndex.current;
              if (idx !== null && idx > 0) {
                flatListRef.current?.scrollToIndex({ index: Math.max(0, idx - 1), animated: false, viewPosition: 0 });
              } else {
                flatListRef.current?.scrollToEnd({ animated: false });
              }
              markChatAsRead();
            } else if (isAtBottom.current) {
              flatListRef.current?.scrollToEnd({ animated: true });
            }
          }}
          onScrollToIndexFailed={() => flatListRef.current?.scrollToEnd({ animated: false })}
          onScroll={(e) => {
            if (isScrollingToBottom.current) return;
            const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
            const dist = contentSize.height - layoutMeasurement.height - contentOffset.y;
            isAtBottom.current = dist <= 120;
            if (hasLoaded.current) setShowScrollBtn(dist > 120);
          }}
          onMomentumScrollEnd={(e) => {
            isScrollingToBottom.current = false;
            const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
            const dist = contentSize.height - layoutMeasurement.height - contentOffset.y;
            isAtBottom.current = dist <= 120;
            setShowScrollBtn(dist > 120);
          }}
          scrollEventThrottle={100}
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
                    {item.type === 'task_card' ? (
                      <TaskCard msg={item} />
                    ) : item.ticket_id ? (
                      <ReplyBubble msg={item} isOwn={isOwn} />
                    ) : (
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
                    )}
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

      {/* Scroll to bottom button */}
      {showScrollBtn && (
        <Pressable
          onPress={() => {
            isScrollingToBottom.current = true;
            setShowScrollBtn(false);
            flatListRef.current?.scrollToEnd({ animated: true });
          }}
          style={{
            position: 'absolute',
            bottom: 80,
            alignSelf: 'center',
            backgroundColor: '#1E40AF',
            borderRadius: 20,
            paddingHorizontal: 14,
            paddingVertical: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            shadowColor: '#000',
            shadowOpacity: 0.2,
            shadowRadius: 6,
            elevation: 4,
          }}
          className="active:opacity-70"
        >
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Tin mới nhất ↓</Text>
        </Pressable>
      )}

      {/* Input bar */}
      <View
        style={{
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#e2e8f0',
        }}
      >
        {/* Pending task attachment preview */}
        {pendingTask && (
          <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
            <View
              style={{
                backgroundColor: '#EFF6FF',
                borderRadius: 14,
                borderLeftWidth: 4,
                borderLeftColor: '#1E40AF',
                padding: 12,
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#1E40AF', letterSpacing: 0.5, marginBottom: 4 }}>
                  🆘 YÊU CẦU HỖ TRỢ
                </Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#0d1c2e', marginBottom: 6 }} numberOfLines={2}>
                  {pendingTask.title}
                </Text>
                {pendingTask.service_type && (
                  <Text style={{ fontSize: 12, color: '#374151', marginBottom: 3 }} numberOfLines={1}>
                    🔧 {pendingTask.service_type}
                  </Text>
                )}
                {pendingTask.location_name && (
                  <Text style={{ fontSize: 12, color: '#374151', marginBottom: 3 }} numberOfLines={1}>
                    📍 {pendingTask.location_name}
                  </Text>
                )}
                {pendingTask.deadline && (
                  <Text style={{ fontSize: 12, color: '#dc2626', fontWeight: '600' }} numberOfLines={1}>
                    ⏰ {new Date(pendingTask.deadline).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                )}
              </View>
              <Pressable onPress={() => setPendingTask(null)} className="active:opacity-60" style={{ padding: 2 }}>
                <Text style={{ fontSize: 16, color: '#94a3b8', fontWeight: '600' }}>✕</Text>
              </Pressable>
            </View>
          </View>
        )}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            paddingHorizontal: 16,
            paddingVertical: 10,
            paddingBottom: Platform.OS === 'ios' ? 28 : 10,
            gap: 10,
          }}
        >
        <RNTextInput
          value={input}
          onChangeText={setInput}
          placeholder={pendingTask ? 'Mô tả tình huống cần hỗ trợ...' : 'Type a message...'}
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
      </View>
    </KeyboardAvoidingView>
  );
}
