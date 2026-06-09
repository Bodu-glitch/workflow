import { useState } from 'react';
import { FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { View, Text, Pressable } from '@/tw';
import { supportApi, type SupportTicket, type TicketReply } from '@/lib/api/support';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorView } from '@/components/ui/ErrorView';

const STATUS_LABEL: Record<string, string> = {
  open: 'Chờ hỗ trợ',
  in_progress: 'Đang xử lý',
  resolved: 'Đã giải quyết',
};

const STATUS_COLOR: Record<string, string> = {
  open: 'bg-warning-container',
  in_progress: 'bg-secondary-container',
  resolved: 'bg-success-container',
};

const STATUS_TEXT: Record<string, string> = {
  open: 'text-on-warning-container',
  in_progress: 'text-on-secondary-container',
  resolved: 'text-on-success-container',
};

function RepliesPanel({ ticketId }: { ticketId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['ticket-replies', ticketId],
    queryFn: () => supportApi.ticketReplies(ticketId),
    select: (d) => d.data,
  });

  if (isLoading) return <ActivityIndicator size="small" className="my-2" />;

  const replies = data ?? [];
  if (replies.length === 0) {
    return <Text className="text-xs text-outline italic mt-2">Chưa có phản hồi</Text>;
  }

  return (
    <View className="mt-3 gap-2">
      {replies.map((reply: TicketReply) => (
        <View key={reply.id} className="bg-surface-container px-3 py-2.5 rounded-xl">
          <Text className="text-xs font-bold text-primary mb-1">
            {reply.users?.full_name ?? 'Hỗ trợ viên'}
          </Text>
          <Text className="text-sm text-on-surface">{reply.content}</Text>
          <Text className="text-xs text-outline mt-1">
            {new Date(reply.created_at).toLocaleString('vi-VN')}
          </Text>
        </View>
      ))}
    </View>
  );
}

function TicketItem({ ticket }: { ticket: SupportTicket }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Pressable
      onPress={() => setExpanded((v) => !v)}
      className="bg-surface-container-lowest rounded-xl p-4 mb-3 mx-4 active:opacity-80"
    >
      <View className="flex-row items-start justify-between mb-2">
        <Text className="text-sm font-bold text-on-surface flex-1 mr-2" numberOfLines={2}>
          {ticket.tasks?.title ?? 'Nhiệm vụ không xác định'}
        </Text>
        <View className={`px-2.5 py-1 rounded-full ${STATUS_COLOR[ticket.status]}`}>
          <Text className={`text-[10px] font-bold ${STATUS_TEXT[ticket.status]}`}>
            {STATUS_LABEL[ticket.status]}
          </Text>
        </View>
      </View>

      {ticket.tasks?.location_name && (
        <Text className="text-xs text-outline mb-1">📍 {ticket.tasks.location_name}</Text>
      )}
      <Text className="text-xs text-outline">
        {new Date(ticket.created_at).toLocaleString('vi-VN')}
      </Text>

      {expanded && <RepliesPanel ticketId={ticket.id} />}

      <Text className="text-xs text-primary mt-2 text-right">
        {expanded ? '▲ Thu gọn' : '▼ Xem phản hồi'}
      </Text>
    </Pressable>
  );
}

export default function SupportTicketsScreen() {
  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['my-tickets'],
    queryFn: () => supportApi.myTickets(),
    select: (d) => d.data,
  });

  if (isLoading) return <LoadingScreen />;
  if (isError) return <ErrorView onRetry={refetch} />;

  const tickets = data ?? [];

  return (
    <View className="flex-1 bg-surface-container-low">
      <View className="glass-effect px-5 pt-14 pb-4">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} className="active:opacity-60">
            <Text className="text-primary font-semibold">← Back</Text>
          </Pressable>
          <View>
            <Text className="text-xl font-extrabold text-on-surface tracking-tight">Yêu cầu hỗ trợ</Text>
            <Text className="text-xs text-on-surface-variant">{tickets.length} ticket</Text>
          </View>
        </View>
      </View>

      <FlatList
        data={tickets}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <TicketItem ticket={item} />}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        ListEmptyComponent={
          <View className="py-20 items-center">
            <Text className="text-4xl mb-3">🎉</Text>
            <Text className="text-on-surface-variant text-sm">Không có ticket nào</Text>
          </View>
        }
      />
    </View>
  );
}
