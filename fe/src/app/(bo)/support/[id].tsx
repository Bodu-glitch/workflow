/**
 * BO — Support Ticket Detail + Chat
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { View, Text, Pressable, TextInput } from '@/tw';
import { supportApi, type SupportMessage } from '@/lib/api/support';
import { useAuth } from '@/context/auth';
import { useSocket } from '@/hooks/useSocket';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorView } from '@/components/ui/ErrorView';

export default function BOSupportDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [content, setContent] = useState('');
  const [localMessages, setLocalMessages] = useState<SupportMessage[]>([]);
  const flatListRef = useRef<FlatList>(null);
  const { joinTicketRoom, onSupportMessage } = useSocket();

  // Load ticket info from the pending list cache
  const { data: ticketData } = useQuery({
    queryKey: ['support-tickets-pending'],
    queryFn: () => supportApi.listPending(),
    select: (d) => d.data?.find((t) => t.id === id),
    staleTime: 30_000,
  });

  const { data: messages, isLoading, isError, refetch } = useQuery({
    queryKey: ['support-messages', id],
    queryFn: () => supportApi.getMessages(id),
  });

  useEffect(() => {
    if (messages) setLocalMessages(Array.isArray(messages) ? messages : (messages as any).data ?? []);
  }, [messages]);

  useEffect(() => {
    if (!id) return;
    joinTicketRoom(id);

    const off = onSupportMessage((evt) => {
      if (evt.ticketId !== id) return;
      setLocalMessages((prev) => {
        const incoming = evt.message as SupportMessage;
        if (prev.some((m) => m.id === incoming.id)) return prev;
        return [...prev, incoming];
      });
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
    });

    return off;
  }, [id, joinTicketRoom, onSupportMessage]);

  useEffect(() => {
    if (localMessages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, []);

  const sendMutation = useMutation({
    mutationFn: () => supportApi.sendMessage(id, content.trim()),
    onSuccess: (saved) => {
      const msg = (saved as any)?.data ?? saved;
      setLocalMessages((prev) => [...prev, msg as SupportMessage]);
      setContent('');
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
    },
    onError: () => Alert.alert('Lỗi', 'Không thể gửi tin nhắn'),
  });

  const closeMutation = useMutation({
    mutationFn: () => supportApi.updateStatus(id, 'resolved'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support-tickets-pending'] });
      Alert.alert('Đã đánh dấu giải quyết', '', [{ text: 'OK', onPress: () => router.back() }]);
    },
    onError: () => Alert.alert('Lỗi', 'Không thể cập nhật trạng thái'),
  });

  const handleSend = useCallback(() => {
    if (!content.trim() || sendMutation.isPending) return;
    sendMutation.mutate();
  }, [content, sendMutation]);

  if (isLoading) return <LoadingScreen />;
  if (isError) return <ErrorView onRetry={refetch} />;

  const isResolvable = ticketData && ['open', 'in_progress'].includes(ticketData.status);

  const renderMessage = ({ item }: { item: SupportMessage }) => {
    const isOwn = item.sender_id === user?.id;
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
            <Text className="text-primary font-semibold">← Back</Text>
          </Pressable>
          <View className="flex-1">
            <Text className="text-base font-extrabold text-on-surface tracking-tight" numberOfLines={1}>
              🎫 {ticketData?.subject ?? 'Support Ticket'}
            </Text>
            {ticketData?.staff && (
              <Text className="text-xs text-on-surface-variant">
                👤 {ticketData.staff.full_name}
                {ticketData.request ? ` · Job: ${ticketData.request.status}` : ''}
              </Text>
            )}
          </View>
          {isResolvable && (
            <Pressable
              onPress={() => closeMutation.mutate()}
              disabled={closeMutation.isPending}
              className="bg-success/10 px-3 py-1.5 rounded-xl active:opacity-70 disabled:opacity-50"
            >
              {closeMutation.isPending
                ? <ActivityIndicator size="small" />
                : <Text className="text-xs font-bold text-success">✓ Đã xong</Text>
              }
            </Pressable>
          )}
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
            <Text className="text-4xl">🎫</Text>
            <Text className="text-sm text-on-surface-variant text-center">
              Chưa có tin nhắn nào.{'\n'}Hãy phản hồi nhân viên.
            </Text>
          </View>
        }
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />

      {/* Input — only when ticket is not resolved/closed */}
      {ticketData?.status !== 'resolved' && ticketData?.status !== 'closed' ? (
        <View className="px-4 py-3 bg-surface border-t border-outline/10 flex-row items-end gap-3">
          <TextInput
            className="flex-1 bg-surface-container-high rounded-2xl px-4 py-3 text-sm text-on-surface"
            placeholder="Nhập phản hồi..."
            placeholderTextColor="#737685"
            value={content}
            onChangeText={setContent}
            multiline
            style={{ maxHeight: 100 }}
          />
          <Pressable
            onPress={handleSend}
            disabled={sendMutation.isPending || !content.trim()}
            className="bg-primary w-11 h-11 rounded-full items-center justify-center active:opacity-70 disabled:opacity-50"
          >
            {sendMutation.isPending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text className="text-white font-bold text-lg">↑</Text>
            }
          </Pressable>
        </View>
      ) : (
        <View className="px-4 py-3 bg-surface-container border-t border-outline/10 items-center">
          <Text className="text-sm text-on-surface-variant">Ticket đã được giải quyết</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
