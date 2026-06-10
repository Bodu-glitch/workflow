import { useState } from 'react';
import { Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { View, Text, Pressable, ScrollView } from '@/tw';
import { requestsApi } from '@/lib/api/requests';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorView } from '@/components/ui/ErrorView';

const STATUS_TABS = [
  { label: 'Scheduled', status: 'unavailable' },
  { label: 'Pending', status: 'available' },
  { label: 'Pending Assignment', status: 'pending_assignment' },
  { label: 'Assigned', status: 'assigned,in_progress' },
  { label: 'Completed', status: 'completed,completed_late' },
];

const STATUS_COLORS: Record<string, string> = {
  unavailable: '#6B7280',
  available: '#3B82F6',
  negotiating: '#8B5CF6',
  pending_assignment: '#F59E0B',
  assigned: '#8B5CF6',
  in_progress: '#EF4444',
  completed: '#10B981',
  completed_late: '#F59E0B',
  cancelled: '#9CA3AF',
};

const STATUS_LABELS: Record<string, string> = {
  unavailable: 'Scheduled',
  available: 'Pending',
  negotiating: 'Negotiating',
  pending_assignment: 'Pending Assignment',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  completed: 'Completed',
  completed_late: 'Completed (late)',
  cancelled: 'Cancelled',
};

export default function BORequestsScreen() {
  const [activeTab, setActiveTab] = useState(0);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['service-requests', STATUS_TABS[activeTab].status],
    queryFn: () => requestsApi.list({ status: STATUS_TABS[activeTab].status, limit: 50 }),
    select: (d) => d.data,
  });

  if (isLoading) return <LoadingScreen />;
  if (isError) return <ErrorView onRetry={refetch} />;

  const requests = data ?? [];

  return (
    <View className="flex-1 bg-surface">
      <View className="glass-effect px-5 pt-14 pb-3">
        <Text className="text-2xl font-extrabold text-on-surface tracking-tight mb-3">Service Requests</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
          {STATUS_TABS.map((tab, i) => (
            <Pressable
              key={tab.label}
              onPress={() => setActiveTab(i)}
              className={`px-4 py-2 rounded-full ${activeTab === i ? 'bg-primary' : 'bg-surface-container-high'}`}
            >
              <Text className={`text-sm font-semibold ${activeTab === i ? 'text-white' : 'text-on-surface-variant'}`}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {requests.length === 0 ? (
          <View className="items-center justify-center py-20 gap-3">
            <Text className="text-4xl">📭</Text>
            <Text className="text-sm text-on-surface-variant">No requests</Text>
          </View>
        ) : (
          requests.map((req) => {
            const statusColor = STATUS_COLORS[req.status] ?? '#9CA3AF';
            const statusLabel = STATUS_LABELS[req.status] ?? req.status;
            return (
              <Pressable
                key={req.id}
                onPress={() => router.push({ pathname: '/(bo)/requests/[id]', params: { id: req.id } })}
                className="bg-surface-container-lowest rounded-xl p-4 mb-3 active:opacity-80"
              >
                <View className="flex-row items-start justify-between mb-2">
                  <View className="flex-1 gap-1">
                    <Text className="text-xs font-bold text-primary">{req.category?.name ?? 'Service'}</Text>
                    <Text className="text-sm font-semibold text-on-surface" numberOfLines={2}>
                      {req.description}
                    </Text>
                  </View>
                  <View className="ml-3 items-end gap-1">
                    <View style={{ backgroundColor: statusColor + '20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: statusColor }}>{statusLabel}</Text>
                    </View>
                    {req.is_emergency && (
                      <Text className="text-xs font-bold text-error">🚨 Urgent</Text>
                    )}
                  </View>
                </View>

                <View className="flex-row items-center justify-between mt-1">
                  <Text className="text-xs text-on-surface-variant">
                    👤 {req.customer?.full_name ?? 'Customer'}
                  </Text>
                  <Text className="text-xs text-on-surface-variant">
                    {new Date(req.created_at).toLocaleString('en-US')}
                  </Text>
                </View>

                {req.agreed_price != null && (
                  <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-outline/20">
                    <Text className="text-xs text-on-surface-variant">Agreed Price</Text>
                    <Text className="text-sm font-bold text-primary">
                      {req.agreed_price.toLocaleString('en-US')}₫
                    </Text>
                  </View>
                )}

                {req.collected_amount != null && (
                  <View className="flex-row items-center justify-between mt-1">
                    <Text className="text-xs text-on-surface-variant">Collected</Text>
                    <Text className="text-sm font-bold text-success">
                      💰 {req.collected_amount.toLocaleString('en-US')}₫
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })
        )}
        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
