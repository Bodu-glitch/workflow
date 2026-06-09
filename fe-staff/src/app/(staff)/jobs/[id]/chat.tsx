/**
 * Staff → Customer chat screen (channel: customer_staff)
 * Accessed via: /(staff)/jobs/[id]/chat
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { View, Text, Pressable, TextInput } from '@/tw';
import { requestsApi, type ChatMessage } from '@/lib/api/requests';
import { useAuth } from '@/context/auth';
import { useSocket } from '@/hooks/useSocket';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorView } from '@/components/ui/ErrorView';

const CHANNEL = 'customer_staff' as const;

export default function StaffJobChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const flatListRef = useRef<FlatList>(null);
  const { joinRequestRoom, onChatMessage, sendChatMessage } = useSocket();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['request-chat', id, CHANNEL],
    queryFn: () => requestsApi.getChatHistory(id, CHANNEL),
    select: (d) => d.data,
  });

  useEffect(() => {
    if (data) setLocalMessages(data);
  }, [data]);

  useEffect(() => {
    if (!id) return;
    joinRequestRoom(id);

    const off = onChatMessage((evt) => {
      if (evt.requestId !== id || evt.channel !== CHANNEL) return;
      setLocalMessages((prev) => {
        const incoming = evt.message as ChatMessage;
        if (prev.some((m) => m.id === incoming.id)) return prev;
        return [...prev, incoming];
      });
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
    });

    return off;
  }, [id, joinRequestRoom, onChatMessage]);

  useEffect(() => {
    if (localMessages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, []);

  const handleSend = useCallback(async () => {
    const text = content.trim();
    if (!text || sending || !id || !user) return;
    setSending(true);

    const optimistic: ChatMessage = {
      id: `opt-${Date.now()}`,
      request_id: id,
      user_id: user.id,
      channel: CHANNEL,
      content: text,
      media_urls: [],
      is_system: false,
      created_at: new Date().toISOString(),
      sender: { id: user.id, full_name: user.full_name, avatar_url: (user as any).avatar_url ?? null },
    };
    setLocalMessages((prev) => [...prev, optimistic]);
    setContent('');
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);

    try {
      sendChatMessage(id, CHANNEL, text);
    } catch {
      try {
        const res = await requestsApi.sendChatMessage(id, text, CHANNEL);
        const saved = (res as any).data ?? res;
        setLocalMessages((prev) => prev.map((m) => m.id === optimistic.id ? saved : m));
      } catch {
        setLocalMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        setContent(text);
      }
    } finally {
      setSending(false);
    }
  }, [content, sending, id, user, sendChatMessage]);

  if (isLoading) return <LoadingScreen />;
  if (isError) return <ErrorView onRetry={refetch} />;

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isOwn = item.user_id === user?.id;
    const senderName = item.sender?.full_name ?? 'Unknown';

    return (
      <View className={`mb-3 max-w-[80%] ${isOwn ? 'self-end' : 'self-start'}`}>
        {!isOwn && (
          <Text className="text-xs text-on-surface-variant mb-1 ml-1">{senderName}</Text>
        )}
        <View
          className={`px-4 py-3 rounded-2xl ${
            isOwn ? 'bg-primary rounded-br-sm' : 'bg-surface-container-high rounded-bl-sm'
          }`}
        >
          <Text className={`text-sm leading-5 ${isOwn ? 'text-white' : 'text-on-surface'}`}>
            {item.content}
          </Text>
        </View>
        <Text className={`text-[10px] text-on-surface-variant mt-1 ${isOwn ? 'text-right mr-1' : 'ml-1'}`}>
          {new Date(item.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-surface"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View className="glass-effect px-5 pt-14 pb-4">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} className="active:opacity-60">
            <Text className="text-primary font-semibold">← Quay lại</Text>
          </Pressable>
          <View className="flex-1">
            <Text className="text-lg font-extrabold text-on-surface tracking-tight">
              💬 Chat với khách hàng
            </Text>
            <Text className="text-xs text-on-surface-variant">Kênh: nhân viên ↔ khách hàng</Text>
          </View>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={localMessages}
        keyExtractor={(m) => m.id}
        renderItem={renderMessage}
        contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
        ListEmptyComponent={
          <View className="items-center justify-center py-20 gap-3">
            <Text className="text-4xl">💬</Text>
            <Text className="text-sm text-on-surface-variant text-center">
              Chưa có tin nhắn nào.{'\n'}Hãy bắt đầu trò chuyện với khách hàng.
            </Text>
          </View>
        }
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />

      {/* Input */}
      <View className="px-4 py-3 bg-surface border-t border-outline/10 flex-row items-end gap-3">
        <TextInput
          className="flex-1 bg-surface-container-high rounded-2xl px-4 py-3 text-sm text-on-surface"
          placeholder="Nhập tin nhắn..."
          placeholderTextColor="#737685"
          value={content}
          onChangeText={setContent}
          multiline
          style={{ maxHeight: 100 }}
        />
        <Pressable
          onPress={handleSend}
          disabled={sending || !content.trim()}
          className="bg-primary w-11 h-11 rounded-full items-center justify-center active:opacity-70 disabled:opacity-50"
        >
          {sending
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text className="text-white font-bold text-lg">↑</Text>
          }
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
