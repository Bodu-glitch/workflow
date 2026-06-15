import { useState } from 'react';
import { ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { View, Text, Pressable, ScrollView } from '@/tw';
import { technicianApi } from '@/lib/api/technician';
import { ErrorView } from '@/components/ui/ErrorView';

const PERIODS = [
  { label: 'Hôm nay', key: 'day' as const },
  { label: 'Tuần này', key: 'week' as const },
  { label: 'Tháng này', key: 'month' as const },
];

function fmt(n: number) {
  return Number(n ?? 0).toLocaleString('vi-VN') + '₫';
}

function StarRating({ score }: { score: number | null }) {
  if (score == null) return <Text className="text-xs text-on-surface-variant">Chưa đánh giá</Text>;
  return (
    <Text className="text-xs text-warning font-bold">
      {'★'.repeat(Math.round(score))}{'☆'.repeat(5 - Math.round(score))} {score.toFixed(1)}
    </Text>
  );
}

export default function IncomeScreen() {
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('month');

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['technician-earnings', period],
    queryFn: () => technicianApi.getEarnings(period),
    select: (d) => d.data,
  });

  const handleExportPdf = async () => {
    try {
      Alert.alert('Thông báo', 'Tính năng xuất PDF đang được phát triển. Vui lòng kiểm tra lại sau.');
    } catch {
      Alert.alert('Lỗi', 'Không thể xuất PDF');
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator size="large" color="#1E40AF" />
      </View>
    );
  }
  if (isError) return <ErrorView onRetry={refetch} />;

  const summary = data?.summary;
  const jobs = data?.jobs ?? [];

  return (
    <View className="flex-1 bg-surface">
      {/* Header */}
      <View className="glass-effect px-5 pt-14 pb-4">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-2xl font-extrabold text-on-surface tracking-tight">Thu nhập</Text>
          <Pressable
            onPress={handleExportPdf}
            className="bg-primary/10 px-3 py-2 rounded-xl active:opacity-70"
          >
            <Text className="text-xs font-bold text-primary">📄 Xuất PDF</Text>
          </Pressable>
        </View>

        {/* Period selector */}
        <View className="flex-row gap-2">
          {PERIODS.map((p) => (
            <Pressable
              key={p.key}
              onPress={() => setPeriod(p.key)}
              className={`px-4 py-2 rounded-full ${period === p.key ? 'bg-primary' : 'bg-surface-container-high'}`}
            >
              <Text className={`text-sm font-semibold ${period === p.key ? 'text-white' : 'text-on-surface-variant'}`}>
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {/* Summary Cards */}
        {summary && (
          <>
            {/* Main earning card */}
            <View className="bg-primary rounded-2xl p-5 mb-4">
              <Text className="text-white/70 text-sm font-medium mb-1">Thu nhập của bạn</Text>
              <Text className="text-white text-4xl font-extrabold mb-3">{fmt(summary.total_earning)}</Text>
              <View className="flex-row gap-4">
                <View>
                  <Text className="text-white/60 text-xs">Tổng đơn</Text>
                  <Text className="text-white font-bold text-lg">{summary.total_jobs}</Text>
                </View>
                <View>
                  <Text className="text-white/60 text-xs">Doanh thu gốc</Text>
                  <Text className="text-white font-bold text-lg">{fmt(summary.total_gross)}</Text>
                </View>
                <View>
                  <Text className="text-white/60 text-xs">Đánh giá TB</Text>
                  <Text className="text-white font-bold text-lg">
                    {summary.avg_rating != null ? `⭐ ${summary.avg_rating.toFixed(1)}` : 'N/A'}
                  </Text>
                </View>
              </View>
            </View>

          </>
        )}

        {/* Job list */}
        <View className="bg-surface-container-lowest rounded-xl overflow-hidden mb-4">
          <View className="px-4 py-3 border-b border-outline/10">
            <Text className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Chi tiết từng đơn ({jobs.length})
            </Text>
          </View>
          {jobs.length === 0 ? (
            <View className="items-center justify-center py-12 gap-2">
              <Text className="text-3xl">💸</Text>
              <Text className="text-sm text-on-surface-variant">Chưa có đơn hoàn thành</Text>
            </View>
          ) : (
            jobs.map((job, idx) => (
              <View
                key={job.id}
                className={`px-4 py-4 ${idx < jobs.length - 1 ? 'border-b border-outline/10' : ''}`}
              >
                <View className="flex-row items-start justify-between mb-2">
                  <View className="flex-1 gap-1">
                    <Text className="text-xs font-bold text-primary">{job.category?.name ?? 'Dịch vụ'}</Text>
                    <Text className="text-sm font-medium text-on-surface" numberOfLines={2}>{job.description}</Text>
                    <Text className="text-xs text-on-surface-variant">
                      {new Date(job.completed_at).toLocaleDateString('vi-VN', {
                        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </Text>
                  </View>
                  <View className="items-end gap-1 ml-3">
                    <Text className="text-base font-extrabold text-success">{fmt(job.staff_earning)}</Text>
                    <StarRating score={job.rating} />
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
