import { useState } from 'react';
import { Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { View, Text, Pressable, ScrollView } from '@/tw';
import { technicianApi } from '@/lib/api/technician';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorView } from '@/components/ui/ErrorView';
import { ApiError } from '@/lib/api/client';

const TABS = [
  { label: 'My Jobs', key: 'my' },
  { label: 'Pool', key: 'pool' },
];

const STATUS_COLORS: Record<string, string> = {
  assigned: '#8B5CF6',
  in_progress: '#EF4444',
  pending_assignment: '#F59E0B',
  completed: '#10B981',
};

const STATUS_LABELS: Record<string, string> = {
  assigned: 'Assigned',
  in_progress: 'In Progress',
  pending_assignment: 'Available',
  completed: 'Completed',
  completed_late: 'Completed (late)',
};

export default function StaffJobsScreen() {
  const [activeTab, setActiveTab] = useState(0);
  const qc = useQueryClient();

  const { data: myJobs, isLoading: loadingJobs, isError: jobsError, refetch: refetchJobs, isRefetching: refetchingJobs } = useQuery({
    queryKey: ['technician-jobs'],
    queryFn: () => technicianApi.getJobs(),
    select: (d) => d.data,
    enabled: activeTab === 0,
  });

  const { data: poolJobs, isLoading: loadingPool, isError: poolError, refetch: refetchPool, isRefetching: refetchingPool } = useQuery({
    queryKey: ['technician-pool'],
    queryFn: () => technicianApi.getPool(),
    select: (d) => d.data,
    enabled: activeTab === 1,
  });

  const claimMutation = useMutation({
    mutationFn: (id: string) => technicianApi.claimFromPool(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['technician-jobs'] });
      qc.invalidateQueries({ queryKey: ['technician-pool'] });
      Alert.alert('Success', 'Job claimed!');
      setActiveTab(0);
    },
    onError: (e) => Alert.alert('Error', e instanceof ApiError ? e.message : 'Unable to claim job'),
  });

  const isLoading = activeTab === 0 ? loadingJobs : loadingPool;
  const isError = activeTab === 0 ? jobsError : poolError;
  const refetch = activeTab === 0 ? refetchJobs : refetchPool;
  const isRefetching = activeTab === 0 ? refetchingJobs : refetchingPool;

  if (isLoading) return <LoadingScreen />;
  if (isError) return <ErrorView onRetry={refetch} />;

  const jobs = activeTab === 0 ? (myJobs ?? []) : (poolJobs ?? []);

  return (
    <View className="flex-1 bg-surface">
      <View className="glass-effect px-5 pt-14 pb-3">
        <Text className="text-2xl font-extrabold text-on-surface tracking-tight mb-3">Service Jobs</Text>
        <View className="flex-row gap-2">
          {TABS.map((tab, i) => (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(i)}
              className={`px-4 py-2 rounded-full ${activeTab === i ? 'bg-primary' : 'bg-surface-container-high'}`}
            >
              <Text className={`text-sm font-semibold ${activeTab === i ? 'text-white' : 'text-on-surface-variant'}`}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {jobs.length === 0 ? (
          <View className="items-center justify-center py-20 gap-3">
            <Text className="text-4xl">{activeTab === 0 ? '📋' : '🔍'}</Text>
            <Text className="text-sm text-on-surface-variant">
              {activeTab === 0 ? 'No jobs' : 'Pool empty'}
            </Text>
          </View>
        ) : (
          jobs.map((job) => {
            const statusColor = STATUS_COLORS[job.status] ?? '#9CA3AF';
            const statusLabel = STATUS_LABELS[job.status] ?? job.status;
            return (
              <Pressable
                key={job.id}
                onPress={() => activeTab === 0
                  ? router.push({ pathname: '/(staff)/jobs/[id]', params: { id: job.id } })
                  : claimMutation.mutate(job.id)
                }
                className="bg-surface-container-lowest rounded-xl p-4 mb-3 active:opacity-80"
              >
                <View className="flex-row items-start justify-between mb-2">
                  <View className="flex-1 gap-1">
                    <Text className="text-xs font-bold text-primary">{job.category?.name ?? 'Service'}</Text>
                    <Text className="text-sm font-semibold text-on-surface" numberOfLines={2}>{job.description}</Text>
                  </View>
                  <View className="ml-3 items-end gap-1">
                    <View style={{ backgroundColor: statusColor + '20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: statusColor }}>{statusLabel}</Text>
                    </View>
                    {job.is_emergency && <Text className="text-xs font-bold text-error">🚨</Text>}
                  </View>
                </View>
                <View className="flex-row items-center justify-between mt-1">
                  <Text className="text-xs text-on-surface-variant">👤 {job.customer?.full_name ?? 'Customer'}</Text>
                  <Text className="text-xs text-on-surface-variant">{new Date(job.created_at).toLocaleString('en-US')}</Text>
                </View>
                {activeTab === 1 && (
                  <View className="mt-2 pt-2 border-t border-outline/20">
                    {claimMutation.isPending && claimMutation.variables === job.id
                      ? <ActivityIndicator size="small" color="#1E40AF" />
                      : <Text className="text-xs font-bold text-primary text-center">Tap to claim</Text>
                    }
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
