import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../hooks/useAuth';
import { useSocket } from '../../../hooks/useSocket';
import { ChatBubble } from '../../../components/ChatBubble';
import { api } from '../../../lib/api';
import { COLORS } from '../../../constants/config';
import type { ChatMessage } from '../../../types';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, token } = useAuth();
  const { joinRequestRoom, onChatMessage, sendChatMessage } = useSocket(token);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);
  const channel = 'customer_operator';

  useEffect(() => {
    if (!id) return;
    joinRequestRoom(id);

    api
      .get<ChatMessage[]>(`/requests/${id}/chat/${channel}`)
      .then((res) => {
        setMessages(Array.isArray(res) ? res : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, joinRequestRoom]);

  useEffect(() => {
    const off = onChatMessage((data) => {
      if (data.requestId !== id || data.channel !== channel) return;
      const incoming = data.message as ChatMessage;
      setMessages((prev) => {
        // Replace matching optimistic message from the same sender; otherwise append
        const optIdx = prev.findIndex(
          (m) => m.id.startsWith('opt-') && m.user_id === incoming.user_id && m.content === incoming.content,
        );
        if (optIdx !== -1) {
          const next = [...prev];
          next[optIdx] = incoming;
          return next;
        }
        return [...prev, incoming];
      });
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    });
    return off;
  }, [id, onChatMessage]);

  const handleSend = useCallback(async () => {
    const content = text.trim();
    if (!content || sending || !id || !user) return;
    setSending(true);
    const optimistic: ChatMessage = {
      id: `opt-${Date.now()}`,
      request_id: id,
      user_id: user.id,
      channel,
      content,
      media_urls: [],
      is_system: false,
      created_at: new Date().toISOString(),
      sender: { id: user.id, full_name: user.full_name, avatar_url: user.avatar_url },
    };
    setMessages((prev) => [...prev, optimistic]);
    setText('');
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);

    try {
      sendChatMessage(id, channel, content);
    } catch {
      // REST fallback
      await api.post(`/requests/${id}/chat/${channel}`, { content }).catch(() => {});
    } finally {
      setSending(false);
    }
  }, [text, sending, id, user, sendChatMessage]);

  if (!user) return null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => (
            <ChatBubble message={item} currentUserId={user.id} />
          )}
          contentContainerStyle={styles.list}
          onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Chưa có tin nhắn nào. Hãy bắt đầu trò chuyện!</Text>
            </View>
          }
        />
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Nhập tin nhắn..."
          placeholderTextColor={COLORS.textSecondary}
          multiline
          maxLength={1000}
          returnKeyType="default"
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!text.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.sendIcon}>➤</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 12, paddingBottom: 8 },
  empty: { flex: 1, alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 13, color: COLORS.textSecondary, fontStyle: 'italic' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 100,
    backgroundColor: COLORS.background,
    borderRadius: 21,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: COLORS.border },
  sendIcon: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
