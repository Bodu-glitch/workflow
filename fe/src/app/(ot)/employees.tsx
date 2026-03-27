import { useState } from 'react';
import { Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { View, Text, TextInput, Pressable, ScrollView } from '@/tw';
import { staffApi } from '@/lib/api/staff';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorView } from '@/components/ui/ErrorView';
import { ApiError } from '@/lib/api/client';

export default function OTEmployeeManagementScreen() {
  const qc = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState('');
  const [showInviteForm, setShowInviteForm] = useState(false);

  const staffQuery = useQuery({
    queryKey: ['staff'],
    queryFn: () => staffApi.list(),
    select: (d) => d.data,
  });

  const invitationsQuery = useQuery({
    queryKey: ['invitations'],
    queryFn: () => staffApi.invitations(),
    select: (d) => d.data,
  });

  const inviteMutation = useMutation({
    mutationFn: () => staffApi.invite(inviteEmail.trim(), 'staff'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invitations'] });
      setInviteEmail('');
      setShowInviteForm(false);
      Alert.alert('Success', 'Invitation sent');
    },
    onError: (e) => {
      const msg =
        e instanceof ApiError && e.code === 'EMAIL_ALREADY_EXISTS'
          ? 'This email is already registered'
          : e instanceof ApiError
            ? e.message
            : 'Failed to send invite';
      Alert.alert('Error', msg);
    },
  });

  const resendMutation = useMutation({
    mutationFn: (id: string) => staffApi.resendInvite(id),
    onSuccess: () => Alert.alert('Success', 'Invitation resent'),
    onError: (e) => Alert.alert('Error', e instanceof ApiError ? e.message : 'Failed to resend'),
  });

  if (staffQuery.isLoading || invitationsQuery.isLoading) return <LoadingScreen />;
  if (staffQuery.isError || invitationsQuery.isError)
    return <ErrorView onRetry={() => { staffQuery.refetch(); invitationsQuery.refetch(); }} />;

  const staffList = staffQuery.data ?? [];
  const invitationList = invitationsQuery.data ?? [];

  return (
    <View className="flex-1 bg-surface">
      {/* Glass Header */}
      <View className="glass-effect px-5 pt-14 pb-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <Pressable onPress={() => router.back()} className="active:opacity-60">
              <Text className="text-primary font-semibold">← Back</Text>
            </Pressable>
            <Text className="text-xl font-extrabold text-on-surface tracking-tight">Team Directory</Text>
          </View>
          <Pressable
            onPress={() => setShowInviteForm((v) => !v)}
            className="kinetic-gradient rounded-xl px-4 py-2 active:opacity-80"
          >
            <Text className="text-on-primary text-sm font-bold">+ Invite</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-5"
        refreshControl={
          <RefreshControl
            refreshing={staffQuery.isRefetching || invitationsQuery.isRefetching}
            onRefresh={() => { staffQuery.refetch(); invitationsQuery.refetch(); }}
          />
        }
      >
        {/* Invite form */}
        {showInviteForm && (
          <View className="bg-surface-container-lowest rounded-2xl p-5 mb-4">
            <Text className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-4">
              Invite Staff Member
            </Text>
            <TextInput
              className="w-full h-12 px-4 bg-surface-container-high rounded-xl text-on-surface text-base mb-4"
              placeholder="Staff email address"
              placeholderTextColor="#737685"
              value={inviteEmail}
              onChangeText={setInviteEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Pressable
              onPress={() => inviteMutation.mutate()}
              disabled={inviteMutation.isPending || !inviteEmail.trim()}
              className="kinetic-gradient rounded-xl py-3.5 items-center active:opacity-80 disabled:opacity-50"
            >
              {inviteMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-on-primary font-bold">Send Invitation</Text>
              )}
            </Pressable>
          </View>
        )}

        {/* Staff list */}
        <Text className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-3">
          Active Staff ({staffList.length})
        </Text>
        {staffList.length === 0 && (
          <View className="py-8 items-center">
            <Text className="text-on-surface-variant text-sm">No active staff members</Text>
          </View>
        )}
        {staffList.map((s) => (
          <View key={s.id} className="bg-surface-container-lowest rounded-xl px-4 py-4 mb-3 flex-row items-center">
            <View className="w-10 h-10 rounded-full bg-surface-container-high items-center justify-center mr-3">
              <Text className="text-sm font-bold text-primary">{s.full_name.charAt(0)}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-on-surface">{s.full_name}</Text>
              <Text className="text-xs text-on-surface-variant mt-0.5">{s.email}</Text>
            </View>
          </View>
        ))}

        {/* Pending invitations */}
        {invitationList.length > 0 && (
          <>
            <Text className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-3 mt-4">
              Pending Invitations ({invitationList.length})
            </Text>
            {invitationList.map((inv) => (
              <View key={inv.id} className="bg-surface-container-lowest rounded-xl px-4 py-4 mb-3 flex-row items-center">
                <View className="w-10 h-10 rounded-full bg-surface-container-high items-center justify-center mr-3">
                  <Text className="text-sm font-bold text-primary">{inv.email.charAt(0).toUpperCase()}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-on-surface">{inv.email}</Text>
                  <View className="self-start mt-1 px-2 py-0.5 rounded-full bg-warning-container">
                    <Text className="text-[10px] font-bold uppercase tracking-wider text-on-warning-container">{inv.status}</Text>
                  </View>
                </View>
                <Pressable onPress={() => resendMutation.mutate(inv.id)} disabled={resendMutation.isPending} className="active:opacity-60 ml-2">
                  <Text className="text-xs font-semibold text-primary">Resend</Text>
                </Pressable>
              </View>
            ))}
          </>
        )}

        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
