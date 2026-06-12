import { useState, useRef, useEffect, useCallback } from 'react';
import { Alert, ActivityIndicator, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { View, Text, Pressable, TextInput } from '@/tw';
import { supportApi, type SupportMessage } from '@/lib/api/support';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorView } from '@/components/ui/ErrorView';
import { ApiError } from '@/lib/api/client';
import { useSocket } from '@/hooks/useSocket';
import { useAuth } from '@/context/auth';

const STATUS_LABELS: Record<string, string> = {
  open: '🔴 Đang mở',
  in_progress: '🔵 Đang xử lý',
  resolved: '🟢 Đã giải quyết',
  closed: '⚫ Đã đóng',
};

export default function SupportChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const qc = useQueryClient();
  const { joinTicketRoom, onSupportMessage } = useSocket();

  // Load initial messages via REST
  const { data: messages, isLoading, isError, refetch } = useQuery({
    queryKey: ['support-messages', id],
    queryFn: () => supportApi.getMessages(id),
    select: (d) => d.data,
    // No refetchInterval — realtime via socket
  });

  // Local messages state for optimistic socket updates
  const [localMessages, setLocalMessages] = useState<SupportMessage[]>([]);

  // Sync query data into localMessages
  useEffect(() => {
    if (messages) {
      setLocalMessages(messages);
    }
  }, [messages]);

  // Join ticket room and listen for new messages via socket
  useEffect(() => {
    if (!id) return;

    joinTicketRoom(id);

    const off = onSupportMessage((data) => {
      if (data.ticketId !== id) return;
      setLocalMessages((prev) => {
        // Avoid duplicates
        const exists = prev.some((m) => m.id === (data.message as any).id);
        if (exists) return prev;
        return [...prev, data.message as SupportMessage];
      });
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });

    return off;
  }, [id, joinTicketRoom, onSupportMessage]);

  // Scroll to bottom when messages load
  useEffect(() => {
    if (localMessages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, []);

  const sendMutation = useMutation({
    mutationFn: () => supportApi.sendMessage(id, content.trim()),
    onSuccess: (res) => {
      setContent('');
      // The socket event will add the message to localMessages
      // But also add optimistically in case socket is slow
      const newMsg = (res as any).data ?? res;
      setLocalMessages((prev) => {
        const exists = prev.some((m) => m.id === newMsg.id);
        if (exists) return prev;
        return [...prev, newMsg as SupportMessage];
      });
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      qc.invalidateQueries({ queryKey: ['support-tickets'] });
    },
    onError: (e) => Alert.alert('Lỗi', e instanceof ApiError ? e.message : 'Không thể gửi tin nhắn'),
  });

  if (isLoading) return <LoadingScreen />;
  if (isError) return <ErrorView onRetry={refetch} />;

  const renderMessage = useCallback(({ item }: { item: SupportMessage }) => {
    const isMyMessage = item.user_id === user?.id;
    const senderName = item.users?.full_name ?? (isMyMessage ? 'Bạn' : 'Hỗ trợ');

    return (
      <View className={`mb-3 max-w-[80%] ${isMyMessage ? 'self-end' : 'self-start'}`}>
        {!isMyMessage && (
          <Text className="text-xs text-on-surface-variant mb-1 ml-1">
            {senderName}
          </Text>
        )}
        <View
          className={`px-4 py-3 rounded-2xl ${
            isMyMessage
              ? 'bg-primary rounded-br-sm'
              : 'bg-surface-container-high rounded-bl-sm'
          }`}
        >
          <Text className={`text-sm leading-5 ${isMyMessage ? 'text-white' : 'text-on-surface'}`}>
            {item.content}
          </Text>
        </View>
        <Text className={`text-[10px] text-on-surface-variant mt-1 ${isMyMessage ? 'text-right mr-1' : 'ml-1'}`}>
          {new Date(item.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  }, [user?.id]);

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-surface"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View className="glass-effect px-5 pt-14 pb-4">
        <View className="flex-row items-center gap-3 mb-1">
          <Pressable onPress={() => router.back()} className="active:opacity-60">
            <Text className="text-primary font-semibold">← Quay lại</Text>
          </Pressable>
          <View className="flex-1">
            <Text className="text-lg font-extrabold text-on-surface tracking-tight" numberOfLines={1}>
              Hỗ trợ kỹ thuật
            </Text>
            <Text className="text-xs text-on-surface-variant">Phản hồi trong vòng 2 giờ</Text>
          </View>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={localMessages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
        ListEmptyComponent={
          <View className="items-center justify-center py-20 gap-3">
            <Text className="text-4xl">💬</Text>
            <Text className="text-sm text-on-surface-variant">Bắt đầu cuộc trò chuyện với bộ phận hỗ trợ</Text>
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
          onPress={() => { if (content.trim()) sendMutation.mutate(); }}
          disabled={sendMutation.isPending || !content.trim()}
          className="bg-primary w-11 h-11 rounded-full items-center justify-center active:opacity-70 disabled:opacity-50"
        >
          {sendMutation.isPending
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text className="text-white font-bold text-lg">↑</Text>
          }
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
