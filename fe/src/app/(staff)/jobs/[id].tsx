import { useState } from 'react';
import { Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { View, Text, Pressable, ScrollView, TextInput } from '@/tw';
import { technicianApi } from '@/lib/api/technician';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorView } from '@/components/ui/ErrorView';
import { ApiError } from '@/lib/api/client';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="bg-surface-container-lowest rounded-xl p-5 mb-4">
      <Text className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-4">{title}</Text>
      {children}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View className="flex-row items-start mb-3">
      <Text className="text-xs font-semibold text-on-surface-variant w-24">{label}</Text>
      <Text className="text-sm text-on-surface flex-1">{value}</Text>
    </View>
  );
}

export default function StaffJobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const [collectedAmount, setCollectedAmount] = useState('');
  const [showRequote, setShowRequote] = useState(false);
  const [requotePrice, setRequotePrice] = useState('');
  const [requoteReason, setRequoteReason] = useState('');

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['technician-job', id],
    queryFn: () => technicianApi.getJob(id),
    select: (d: any) => d.data ?? d,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['technician-job', id] });
    qc.invalidateQueries({ queryKey: ['technician-jobs'] });
  };

  const acceptMutation = useMutation({
    mutationFn: () => technicianApi.acceptJob(id),
    onSuccess: () => { invalidate(); Alert.alert('Confirmed', 'You have accepted the job.'); },
    onError: (e) => Alert.alert('Error', e instanceof ApiError ? e.message : 'Failed'),
  });

  const declineMutation = useMutation({
    mutationFn: () => technicianApi.declineJob(id),
    onSuccess: () => { router.back(); },
    onError: (e) => Alert.alert('Error', e instanceof ApiError ? e.message : 'Failed'),
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let lat = 0, lng = 0;
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      }
      return technicianApi.startJob(id, lat, lng);
    },
    onSuccess: invalidate,
    onError: (e) => Alert.alert('Error', e instanceof ApiError ? e.message : 'Failed'),
  });

  const completeMutation = useMutation({
    mutationFn: () => {
      const amount = collectedAmount.trim() ? Number(collectedAmount) : undefined;
      return technicianApi.completeJob(id, amount);
    },
    onSuccess: () => {
      invalidate();
      Alert.alert('Done!', 'Job completed successfully.');
      router.replace('/(staff)/jobs');
    },
    onError: (e) => Alert.alert('Error', e instanceof ApiError ? e.message : 'Failed'),
  });

  const reqouteMutation = useMutation({
    mutationFn: () => technicianApi.requote(id, Number(requotePrice), requoteReason),
    onSuccess: () => {
      invalidate();
      setShowRequote(false);
      Alert.alert('Sent', 'Re-quote request sent to customer.');
    },
    onError: (e) => Alert.alert('Error', e instanceof ApiError ? e.message : 'Failed'),
  });

  if (isLoading) return <LoadingScreen />;
  if (isError || !data) return <ErrorView onRetry={refetch} />;

  const job = data;
  const isAssigned = job.status === 'assigned';
  const isInProgress = job.status === 'in_progress';

  return (
    <View className="flex-1 bg-surface">
      <View className="glass-effect px-5 pt-14 pb-4">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} className="active:opacity-60">
            <Text className="text-primary font-semibold">← Back</Text>
          </Pressable>
          <Text className="text-lg font-extrabold text-on-surface tracking-tight flex-1" numberOfLines={1}>
            Job Details
          </Text>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-5"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        <Section title="Request Info">
          <InfoRow label="Service" value={job.category?.name} />
          <InfoRow label="Description" value={job.description} />
          <InfoRow label="Customer" value={job.customer?.full_name} />
          <InfoRow label="Phone" value={job.customer?.phone} />
          <InfoRow label="Priority" value={job.is_emergency ? '🚨 Urgent' : 'Normal'} />
          {job.agreed_price != null && (
            <InfoRow label="Agreed Price" value={`${Number(job.agreed_price).toLocaleString('en-US')}₫`} />
          )}
        </Section>

        {isAssigned && (
          <Section title="Accept Job">
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => acceptMutation.mutate()}
                disabled={acceptMutation.isPending}
                className="flex-1 bg-primary py-3 rounded-xl items-center active:opacity-70 disabled:opacity-50"
              >
                {acceptMutation.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text className="text-white font-bold text-sm">✅ Accept</Text>
                }
              </Pressable>
              <Pressable
                onPress={() => declineMutation.mutate()}
                disabled={declineMutation.isPending}
                className="flex-1 bg-error-container py-3 rounded-xl items-center active:opacity-70 disabled:opacity-50"
              >
                {declineMutation.isPending
                  ? <ActivityIndicator size="small" />
                  : <Text className="text-on-error-container font-bold text-sm">✕ Decline</Text>
                }
              </Pressable>
            </View>
            <Pressable
              onPress={() => startMutation.mutate()}
              disabled={startMutation.isPending}
              className="mt-3 bg-success py-3 rounded-xl items-center active:opacity-70 disabled:opacity-50"
            >
              {startMutation.isPending
                ? <ActivityIndicator color="#fff" />
                : <Text className="text-white font-bold">🚗 Start Driving</Text>
              }
            </Pressable>
          </Section>
        )}

        {isInProgress && (
          <Section title="Complete Job">
            <TextInput
              className="bg-surface-container-high rounded-xl px-4 py-3 text-base text-on-surface mb-3"
              placeholder="Collected amount (VND)"
              placeholderTextColor="#737685"
              value={collectedAmount}
              onChangeText={setCollectedAmount}
              keyboardType="numeric"
            />

            <Pressable
              onPress={() => completeMutation.mutate()}
              disabled={completeMutation.isPending}
              className="bg-success py-4 rounded-xl items-center active:opacity-80 disabled:opacity-50 mb-3"
            >
              {completeMutation.isPending
                ? <ActivityIndicator color="#fff" />
                : <Text className="text-white font-bold text-base">🏁 Complete Job</Text>
              }
            </Pressable>

            <Pressable
              onPress={() => setShowRequote((v) => !v)}
              className="py-3 rounded-xl bg-surface-container-high items-center active:opacity-70"
            >
              <Text className="text-sm font-bold text-on-surface">💬 Re-quote</Text>
            </Pressable>

            {showRequote && (
              <View className="mt-3 gap-3">
                <TextInput
                  className="bg-surface-container-high rounded-xl px-4 py-3 text-base text-on-surface"
                  placeholder="New price (VND)"
                  placeholderTextColor="#737685"
                  value={requotePrice}
                  onChangeText={setRequotePrice}
                  keyboardType="numeric"
                />
                <TextInput
                  className="bg-surface-container-high rounded-xl px-4 py-3 text-base text-on-surface"
                  placeholder="Re-quote reason"
                  placeholderTextColor="#737685"
                  value={requoteReason}
                  onChangeText={setRequoteReason}
                  multiline
                />
                <Pressable
                  onPress={() => reqouteMutation.mutate()}
                  disabled={reqouteMutation.isPending || !requotePrice || !requoteReason}
                  className="bg-primary py-3 rounded-xl items-center active:opacity-70 disabled:opacity-50"
                >
                  {reqouteMutation.isPending
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text className="text-white font-bold text-sm">Send Re-quote</Text>
                  }
                </Pressable>
              </View>
            )}
          </Section>
        )}

        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
