import { useState } from 'react';
import { Alert, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { View, Text, Pressable, ScrollView, TextInput } from '@/tw';
import { supportApi } from '@/lib/api/support';
import { ApiError } from '@/lib/api/client';

export default function NewSupportTicketScreen() {
  const { job_id } = useLocalSearchParams<{ job_id?: string }>();
  const [subject, setSubject] = useState('');
  const qc = useQueryClient();

  const createMutation = useMutation({
    mutationFn: () => supportApi.createTicket(subject.trim(), job_id || undefined),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['support-tickets'] });
      Alert.alert('Đã tạo', 'Yêu cầu hỗ trợ đã được gửi đến bộ phận hỗ trợ.', [
        {
          text: 'Xem chat',
          onPress: () => router.replace({ pathname: '/(staff)/support/[id]', params: { id: (res as any).data?.id } }),
        },
      ]);
    },
    onError: (e) => Alert.alert('Lỗi', e instanceof ApiError ? e.message : 'Không thể tạo yêu cầu hỗ trợ'),
  });

  const canSubmit = subject.trim().length >= 5;

  return (
    <View className="flex-1 bg-surface">
      <View className="glass-effect px-5 pt-14 pb-4">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} className="active:opacity-60">
            <Text className="text-primary font-semibold">← Quay lại</Text>
          </Pressable>
          <Text className="text-xl font-extrabold text-on-surface tracking-tight">Yêu cầu hỗ trợ</Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-4 pt-6" keyboardShouldPersistTaps="handled">
        <View className="bg-surface-container-lowest rounded-xl p-5 mb-4">
          <Text className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-4">
            Thông tin yêu cầu
          </Text>

          {job_id && (
            <View className="bg-primary/10 rounded-xl px-4 py-3 mb-4">
              <Text className="text-xs font-bold text-primary">🔗 Gắn với công việc: #{job_id.slice(-8)}</Text>
            </View>
          )}

          <Text className="text-sm font-semibold text-on-surface mb-2">Vấn đề cần hỗ trợ *</Text>
          <TextInput
            className="bg-surface-container-high rounded-xl px-4 py-3 text-base text-on-surface mb-1"
            placeholder="Mô tả vấn đề của bạn (tối thiểu 5 ký tự)..."
            placeholderTextColor="#737685"
            value={subject}
            onChangeText={setSubject}
            multiline
            numberOfLines={4}
            style={{ minHeight: 100, textAlignVertical: 'top' }}
          />
          <Text className="text-xs text-on-surface-variant">{subject.length} ký tự</Text>
        </View>

        <View className="bg-warning/10 rounded-xl px-4 py-3 mb-6">
          <Text className="text-xs font-semibold text-warning">
            ⏱ Thời gian phản hồi thường trong vòng 30 phút đến 2 giờ làm việc.
          </Text>
        </View>

        <Pressable
          onPress={() => createMutation.mutate()}
          disabled={createMutation.isPending || !canSubmit}
          className="bg-primary py-4 rounded-xl items-center active:opacity-80 disabled:opacity-50"
        >
          {createMutation.isPending
            ? <ActivityIndicator color="#fff" />
            : <Text className="text-white font-bold text-base">🎫 Gửi yêu cầu hỗ trợ</Text>
          }
        </Pressable>

        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
