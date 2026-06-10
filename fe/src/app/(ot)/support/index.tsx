/**
 * OT — Support Ticket List (mirrors BO version)
 */
import { RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { View, Text, Pressable, ScrollView } from '@/tw';
import { supportApi, type SupportTicket } from '@/lib/api/support';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorView } from '@/components/ui/ErrorView';

const STATUS_LABELS: Record<string, string> = {
  open: 'Mới',
  in_progress: 'Đang xử lý',
  resolved: 'Đã giải quyết',
  closed: 'Đã đóng',
};

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-warning/10',
  in_progress: 'bg-primary/10',
  resolved: 'bg-success/10',
  closed: 'bg-surface-container',
};

const STATUS_TEXT_COLORS: Record<string, string> = {
  open: 'text-warning',
  in_progress: 'text-primary',
  resolved: 'text-success',
  closed: 'text-on-surface-variant',
};

function TicketCard({ ticket }: { ticket: SupportTicket }) {
  const statusLabel = STATUS_LABELS[ticket.status] ?? ticket.status;
  const statusBg = STATUS_COLORS[ticket.status] ?? 'bg-surface-container';
  const statusText = STATUS_TEXT_COLORS[ticket.status] ?? 'text-on-surface-variant';

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/(ot)/support/[id]', params: { id: ticket.id } })}
      className="bg-surface-container-lowest rounded-xl p-4 mb-3 active:opacity-70"
    >
      <View className="flex-row items-start justify-between mb-2">
        <Text className="text-sm font-bold text-on-surface flex-1 mr-3" numberOfLines={2}>
          {ticket.subject}
        </Text>
        <View className={`px-2 py-0.5 rounded-full ${statusBg}`}>
          <Text className={`text-xs font-bold ${statusText}`}>{statusLabel}</Text>
        </View>
      </View>

      <View className="flex-row items-center gap-3">
        <View className="w-7 h-7 rounded-full bg-primary/15 items-center justify-center">
          <Text className="text-xs font-bold text-primary">
            {ticket.staff?.full_name?.charAt(0) ?? '?'}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="text-xs font-semibold text-on-surface">{ticket.staff?.full_name ?? 'Staff'}</Text>
          {ticket.request && (
            <Text className="text-[10px] text-on-surface-variant" numberOfLines={1}>
              Job: {ticket.request.description}
            </Text>
          )}
        </View>
        <Text className="text-[10px] text-on-surface-variant">
          {new Date(ticket.created_at).toLocaleDateString('vi-VN')}
        </Text>
      </View>
    </Pressable>
  );
}

export default function OTSupportScreen() {
  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['support-tickets-pending'],
    queryFn: () => supportApi.listPending(),
    select: (d) => d.data,
  });

  if (isLoading) return <LoadingScreen />;
  if (isError) return <ErrorView onRetry={refetch} />;

  const tickets = data ?? [];

  return (
    <View className="flex-1 bg-surface">
      <View className="glass-effect px-5 pt-14 pb-4">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} className="active:opacity-60">
            <Text className="text-primary font-semibold">← Back</Text>
          </Pressable>
          <Text className="text-lg font-extrabold text-on-surface flex-1">🎫 Hỗ trợ nhân viên</Text>
          {tickets.length > 0 && (
            <View className="bg-warning/10 px-2 py-0.5 rounded-full">
              <Text className="text-xs font-bold text-warning">{tickets.length}</Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {tickets.length === 0 ? (
          <View className="items-center justify-center py-24 gap-3">
            <Text className="text-5xl">🎉</Text>
            <Text className="text-base font-bold text-on-surface">Không có ticket nào!</Text>
            <Text className="text-sm text-on-surface-variant text-center">
              Tất cả yêu cầu hỗ trợ đã được xử lý.
            </Text>
          </View>
        ) : (
          tickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))
        )}
        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
