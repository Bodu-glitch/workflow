import { RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { View, Text, Pressable, ScrollView } from '@/tw';
import { supportApi, type SupportTicket } from '@/lib/api/support';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorView } from '@/components/ui/ErrorView';

const STATUS_COLORS: Record<string, string> = {
  open: '#F59E0B',
  in_progress: '#3B82F6',
  resolved: '#10B981',
  closed: '#9CA3AF',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Đang mở',
  in_progress: 'Đang xử lý',
  resolved: 'Đã giải quyết',
  closed: 'Đã đóng',
};

export default function SupportListScreen() {
  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['support-tickets'],
    queryFn: () => supportApi.myTickets(),
    select: (d) => d.data,
  });

  if (isLoading) return <LoadingScreen />;
  if (isError) return <ErrorView onRetry={refetch} />;

  const tickets = data ?? [];

  return (
    <View className="flex-1 bg-surface">
      <View className="glass-effect px-5 pt-14 pb-4">
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center gap-3">
            <Pressable onPress={() => router.back()} className="active:opacity-60">
              <Text className="text-primary font-semibold">← Quay lại</Text>
            </Pressable>
            <Text className="text-2xl font-extrabold text-on-surface tracking-tight">Hỗ trợ</Text>
          </View>
          <Pressable
            onPress={() => router.push('/(staff)/support/new')}
            className="bg-primary px-4 py-2 rounded-xl active:opacity-70"
          >
            <Text className="text-white text-sm font-bold">+ Tạo ticket</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {tickets.length === 0 ? (
          <View className="items-center justify-center py-20 gap-3">
            <Text className="text-4xl">🎫</Text>
            <Text className="text-sm text-on-surface-variant">Chưa có yêu cầu hỗ trợ nào</Text>
            <Pressable
              onPress={() => router.push('/(staff)/support/new')}
              className="bg-primary px-6 py-3 rounded-xl active:opacity-70 mt-2"
            >
              <Text className="text-white font-bold">Tạo yêu cầu hỗ trợ</Text>
            </Pressable>
          </View>
        ) : (
          tickets.map((ticket) => {
            const color = STATUS_COLORS[ticket.status] ?? '#9CA3AF';
            return (
              <Pressable
                key={ticket.id}
                onPress={() => router.push({ pathname: '/(staff)/support/[id]', params: { id: ticket.id } })}
                className="bg-surface-container-lowest rounded-xl p-4 mb-3 active:opacity-80"
              >
                <View className="flex-row items-start justify-between mb-2">
                  <Text className="text-sm font-semibold text-on-surface flex-1" numberOfLines={2}>
                    {ticket.subject}
                  </Text>
                  <View
                    className="ml-3 px-2 py-1 rounded-lg"
                    style={{ backgroundColor: color + '20' }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color }} >
                      {STATUS_LABELS[ticket.status] ?? ticket.status}
                    </Text>
                  </View>
                </View>
                {ticket.request && (
                  <Text className="text-xs text-on-surface-variant mb-1" numberOfLines={1}>
                    📋 {ticket.request.description}
                  </Text>
                )}
                {ticket.last_message && (
                  <Text className="text-xs text-on-surface-variant italic" numberOfLines={1}>
                    💬 {ticket.last_message}
                  </Text>
                )}
                <Text className="text-xs text-on-surface-variant mt-2">
                  {new Date(ticket.updated_at).toLocaleString('vi-VN')}
                </Text>
              </Pressable>
            );
          })
        )}
        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
