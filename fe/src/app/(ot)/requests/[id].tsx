// OT request detail — same as BO but within (ot) routes
import { useState } from 'react';
import { Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { View, Text, Pressable, ScrollView } from '@/tw';
import { requestsApi } from '@/lib/api/requests';
import { staffApi } from '@/lib/api/staff';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorView } from '@/components/ui/ErrorView';
import { ApiError } from '@/lib/api/client';

const STATUS_LABELS: Record<string, string> = {
  available: 'Pending',
  negotiating: 'Negotiating',
  pending_assignment: 'Pending Assignment',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  completed: 'Completed',
  completed_late: 'Completed (late)',
  cancelled: 'Cancelled',
};

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View className="flex-row items-start mb-3">
      <Text className="text-xs font-semibold text-on-surface-variant w-28">{label}</Text>
      <Text className="text-sm text-on-surface flex-1">{value}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="bg-surface-container-lowest rounded-xl p-5 mb-4">
      <Text className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-4">{title}</Text>
      {children}
    </View>
  );
}

export default function OTRequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [showStaffList, setShowStaffList] = useState(false);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['service-request-ot', id],
    queryFn: () => requestsApi.getById(id),
    select: (d) => d.data,
  });

  const { data: staffData } = useQuery({
    queryKey: ['staff-list'],
    queryFn: () => staffApi.list(),
    enabled: showStaffList,
    select: (d: any) => d?.data ?? [],
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['service-request-ot', id] });
    qc.invalidateQueries({ queryKey: ['service-requests-ot'] });
  };

  const pushToPoolMutation = useMutation({
    mutationFn: () => requestsApi.pushToPool(id),
    onSuccess: invalidate,
    onError: (e) => Alert.alert('Error', e instanceof ApiError ? e.message : 'Failed'),
  });

  const assignMutation = useMutation({
    mutationFn: (staffId: string) => requestsApi.assign(id, staffId),
    onSuccess: () => { invalidate(); setShowStaffList(false); setSelectedStaffId(null); },
    onError: (e) => Alert.alert('Error', e instanceof ApiError ? e.message : 'Assignment failed'),
  });

  if (isLoading) return <LoadingScreen />;
  if (isError || !data) return <ErrorView onRetry={refetch} />;

  const req = data;
  const statusLabel = STATUS_LABELS[req.status] ?? req.status;
  const canAssign = ['negotiating', 'pending_assignment'].includes(req.status);
  const canPushToPool = req.status === 'negotiating';

  return (
    <View className="flex-1 bg-surface">
      <View className="glass-effect px-5 pt-14 pb-4">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} className="active:opacity-60">
            <Text className="text-primary font-semibold">← Back</Text>
          </Pressable>
          <Text className="text-lg font-extrabold text-on-surface flex-1" numberOfLines={1}>Request Details</Text>
          <View className="bg-primary/10 px-3 py-1 rounded-full">
            <Text className="text-xs font-bold text-primary">{statusLabel}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        <Section title="Request Info">
          <InfoRow label="Service" value={req.category?.name} />
          <InfoRow label="Description" value={req.description} />
          <InfoRow label="Priority" value={req.is_emergency ? '🚨 Urgent' : 'Normal'} />
          <InfoRow label="Date" value={new Date(req.created_at).toLocaleString('en-US')} />
        </Section>

        <Section title="Customer">
          <InfoRow label="Full Name" value={req.customer?.full_name} />
          <InfoRow label="Phone" value={req.customer?.phone} />
        </Section>

        <Section title="Financials">
          <InfoRow label="Agreed Price" value={req.agreed_price != null ? `${req.agreed_price.toLocaleString('en-US')}₫` : undefined} />
          {req.collected_amount != null && (
            <View className="bg-success/10 rounded-xl px-3 py-2">
              <Text className="text-sm font-bold text-success">
                💰 Collected: {req.collected_amount.toLocaleString('en-US')}₫
              </Text>
            </View>
          )}
        </Section>

        <Section title="Actions">
          {canPushToPool && (
            <Pressable
              onPress={() => pushToPoolMutation.mutate()}
              disabled={pushToPoolMutation.isPending}
              className="py-3 rounded-xl bg-secondary/10 items-center mb-3 active:opacity-70 disabled:opacity-50"
            >
              {pushToPoolMutation.isPending
                ? <ActivityIndicator size="small" />
                : <Text className="text-sm font-bold text-on-surface">📤 Push to Staff Pool</Text>
              }
            </Pressable>
          )}

          {canAssign && (
            <Pressable
              onPress={() => setShowStaffList((v) => !v)}
              className="py-3 rounded-xl items-center mb-3 active:opacity-70"
              style={{ backgroundColor: '#1E40AF' }}
            >
              <Text className="text-sm font-bold text-white">👤 Assign Staff</Text>
            </Pressable>
          )}

          {showStaffList && (
            <View className="bg-surface-container-high rounded-xl p-3 mb-3 gap-2">
              {!staffData ? (
                <ActivityIndicator size="small" />
              ) : staffData.length === 0 ? (
                <Text className="text-sm text-on-surface-variant text-center">No staff available</Text>
              ) : (
                staffData.map((s: any) => (
                  <Pressable
                    key={s.id}
                    onPress={() => setSelectedStaffId(s.id)}
                    className={`flex-row items-center gap-3 px-3 py-2.5 rounded-xl ${selectedStaffId === s.id ? 'bg-primary/15' : 'active:bg-surface-container'}`}
                  >
                    <View className="w-8 h-8 rounded-full bg-primary/20 items-center justify-center">
                      <Text className="text-xs font-bold text-primary">{s.full_name?.charAt(0)}</Text>
                    </View>
                    <Text className="text-sm text-on-surface font-semibold flex-1">{s.full_name}</Text>
                    {selectedStaffId === s.id && <Text className="text-primary font-bold">✓</Text>}
                  </Pressable>
                ))
              )}
              {selectedStaffId && (
                <Pressable
                  onPress={() => assignMutation.mutate(selectedStaffId)}
                  disabled={assignMutation.isPending}
                  className="py-3 rounded-xl items-center active:opacity-70 disabled:opacity-50 bg-primary mt-1"
                >
                  {assignMutation.isPending
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text className="text-sm font-bold text-white">Confirm Assignment</Text>
                  }
                </Pressable>
              )}
            </View>
          )}
        </Section>

        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
