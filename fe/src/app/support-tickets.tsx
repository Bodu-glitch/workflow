import { useState } from 'react';
import { FlatList, RefreshControl, ActivityIndicator, Modal, Platform } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { View, Text, Pressable, TextInput } from '@/tw';
import { supportApi, type SupportTicket, type TicketReply } from '@/lib/api/support';
import { useAuth } from '@/context/auth';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorView } from '@/components/ui/ErrorView';

const STATUS_LABEL: Record<string, string> = {
  open: 'Chờ hỗ trợ',
  in_progress: 'Đang xử lý',
  resolved: 'Đã giải quyết',
};

const STATUS_COLOR: Record<string, string> = {
  open: '#f59e0b',
  in_progress: '#3b82f6',
  resolved: '#10b981',
};

const TABS = ['Tất cả', 'Chờ hỗ trợ', 'Đang xử lý', 'Đã giải quyết'];
const TAB_STATUS = ['', 'open', 'in_progress', 'resolved'];

function RepliesPanel({ ticketId }: { ticketId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['ticket-replies', ticketId],
    queryFn: () => supportApi.ticketReplies(ticketId),
    select: (d) => d.data,
  });

  if (isLoading) return <ActivityIndicator size="small" color="#3b82f6" style={{ marginTop: 8 }} />;
  const replies = data ?? [];

  return (
    <View style={{ marginTop: 10, gap: 8 }}>
      {replies.length === 0 ? (
        <Text style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>Chưa có phản hồi nào</Text>
      ) : (
        replies.map((r: TicketReply) => (
          <View key={r.id} style={{ backgroundColor: '#f1f5f9', borderRadius: 10, padding: 10 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#1E40AF', marginBottom: 2 }}>
              {r.users?.full_name ?? 'Hỗ trợ viên'}
            </Text>
            <Text style={{ fontSize: 13, color: '#0d1c2e' }}>{r.content}</Text>
            <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>
              {new Date(r.created_at).toLocaleString('vi-VN')}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

function TicketCard({ ticket }: { ticket: SupportTicket }) {
  const [expanded, setExpanded] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const qc = useQueryClient();

  const statusColor = STATUS_COLOR[ticket.status] ?? '#94a3b8';

  const updateMutation = useMutation({
    mutationFn: (status: string) => supportApi.updateStatus(ticket.id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['all-tickets'] }),
  });

  const replyMutation = useMutation({
    mutationFn: () => supportApi.reply(ticket.id, replyText.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket-replies', ticket.id] });
      qc.invalidateQueries({ queryKey: ['all-tickets'] });
      setReplyText('');
      setShowReply(false);
    },
  });

  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 14, marginHorizontal: 16, marginBottom: 10, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4 }}>
      {/* Status bar */}
      <View style={{ height: 3, backgroundColor: statusColor }} />

      <View style={{ padding: 14 }}>
        {/* Header row */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#0d1c2e' }} numberOfLines={2}>
              {ticket.tasks?.title ?? 'Nhiệm vụ không xác định'}
            </Text>
            <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              👤 {(ticket as any).users?.full_name ?? 'Nhân viên'}
            </Text>
          </View>
          <View style={{ backgroundColor: statusColor + '20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: statusColor }}>
              {STATUS_LABEL[ticket.status]}
            </Text>
          </View>
        </View>

        {/* Meta */}
        {ticket.tasks?.location_name && (
          <Text style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }} numberOfLines={1}>
            📍 {ticket.tasks.location_name}
          </Text>
        )}
        <Text style={{ fontSize: 11, color: '#94a3b8' }}>
          🕐 {new Date(ticket.created_at).toLocaleString('vi-VN')}
        </Text>

        {/* Expand replies */}
        <Pressable onPress={() => setExpanded(v => !v)} style={{ marginTop: 8 }}>
          <Text style={{ fontSize: 11, color: '#1E40AF', fontWeight: '600' }}>
            {expanded ? '▲ Ẩn phản hồi' : '▼ Xem phản hồi'}
          </Text>
        </Pressable>
        {expanded && <RepliesPanel ticketId={ticket.id} />}

        {/* Actions */}
        {ticket.status !== 'resolved' && (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Pressable
              onPress={() => setShowReply(true)}
              style={{ flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: '#EFF6FF', alignItems: 'center' }}
              className="active:opacity-70"
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#1E40AF' }}>↩ Trả lời</Text>
            </Pressable>
            <Pressable
              onPress={() => updateMutation.mutate('resolved')}
              disabled={updateMutation.isPending}
              style={{ flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: '#d1fae5', alignItems: 'center' }}
              className="active:opacity-70"
            >
              {updateMutation.isPending
                ? <ActivityIndicator size="small" color="#10b981" />
                : <Text style={{ fontSize: 12, fontWeight: '700', color: '#065f46' }}>✓ Đóng ticket</Text>
              }
            </Pressable>
          </View>
        )}
      </View>

      {/* Reply modal */}
      <Modal visible={showReply} transparent animationType="fade" onRequestClose={() => setShowReply(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 20 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#0d1c2e', marginBottom: 2 }}>Phản hồi ticket</Text>
            <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }} numberOfLines={1}>
              {ticket.tasks?.title}
            </Text>
            <TextInput
              value={replyText}
              onChangeText={setReplyText}
              placeholder="Nhập nội dung phản hồi..."
              placeholderTextColor="#94a3b8"
              multiline
              autoFocus
              style={{ backgroundColor: '#f1f5f9', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#0d1c2e', minHeight: 80, marginBottom: 12 } as any}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={() => { setShowReply(false); setReplyText(''); }}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#f1f5f9', alignItems: 'center' }}
              >
                <Text style={{ color: '#64748b', fontWeight: '600' }}>Huỷ</Text>
              </Pressable>
              <Pressable
                onPress={() => replyMutation.mutate()}
                disabled={!replyText.trim() || replyMutation.isPending}
                style={{ flex: 2, paddingVertical: 12, borderRadius: 12, backgroundColor: replyText.trim() ? '#1E40AF' : '#e2e8f0', alignItems: 'center' }}
              >
                {replyMutation.isPending
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={{ color: replyText.trim() ? '#fff' : '#94a3b8', fontWeight: '700' }}>Gửi phản hồi</Text>
                }
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default function SupportTicketsScreen() {
  const { role } = useAuth();
  const [tab, setTab] = useState(0);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['all-tickets'],
    queryFn: () => supportApi.allTickets(),
    select: (d) => d.data,
  });

  if (isLoading) return <LoadingScreen />;
  if (isError) return <ErrorView onRetry={refetch} />;

  const all = data ?? [];
  const filtered = tab === 0 ? all : all.filter(t => t.status === TAB_STATUS[tab]);

  const counts = {
    open: all.filter(t => t.status === 'open').length,
    in_progress: all.filter(t => t.status === 'in_progress').length,
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f1f5f9' }}>
      {/* Header */}
      <View style={{ backgroundColor: '#fff', paddingTop: Platform.OS === 'web' ? 16 : 56, paddingBottom: 0, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <Pressable onPress={() => router.back()} className="active:opacity-60">
            <Text style={{ fontSize: 20, color: '#1E40AF', fontWeight: '700' }}>←</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#0d1c2e' }}>Ticket hỗ trợ</Text>
            {counts.open > 0 && (
              <Text style={{ fontSize: 11, color: '#f59e0b', fontWeight: '600' }}>
                {counts.open} đang chờ xử lý
              </Text>
            )}
          </View>
        </View>

        {/* Filter tabs */}
        <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 12 }}>
          {TABS.map((label, i) => (
            <Pressable
              key={i}
              onPress={() => setTab(i)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 20,
                backgroundColor: tab === i ? '#1E40AF' : '#f1f5f9',
              }}
              className="active:opacity-70"
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: tab === i ? '#fff' : '#64748b' }}>
                {label}{i > 0 && all.filter(t => t.status === TAB_STATUS[i]).length > 0 ? ` (${all.filter(t => t.status === TAB_STATUS[i]).length})` : ''}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={t => t.id}
        renderItem={({ item }) => <TicketCard ticket={item} />}
        contentContainerStyle={{ paddingTop: 14, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 64 }}>
            <Text style={{ fontSize: 36, marginBottom: 8 }}>🎉</Text>
            <Text style={{ color: '#94a3b8', fontSize: 14 }}>Không có ticket nào</Text>
          </View>
        }
      />
    </View>
  );
}
