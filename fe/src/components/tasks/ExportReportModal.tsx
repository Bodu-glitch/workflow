import { useState } from 'react';
import { Alert, ActivityIndicator, Modal, Platform } from 'react-native';
import { View, Text, Pressable } from '@/tw';
import { tokenStore, tenantStore } from '@/lib/api/client';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function ExportReportModal({ visible, onClose }: Props) {
  const now = new Date();
  const [period, setPeriod] = useState<'month' | 'year'>('month');
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [format, setFormat] = useState<'excel' | 'pdf'>('excel');
  const [loading, setLoading] = useState(false);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  const dateParam = period === 'month'
    ? `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`
    : String(selectedYear);

  const filename = `report-${dateParam}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
  const mimeType = format === 'excel'
    ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : 'application/pdf';
  const reportUrl = `${BASE_URL}/tasks/report?period=${period}&date=${dateParam}&format=${format}`;

  const handleExport = async () => {
    setLoading(true);
    try {
      const token = await tokenStore.get();
      const tenantId = await tenantStore.get();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (tenantId) headers['X-Tenant-ID'] = tenantId;

      if (Platform.OS === 'web') {
        // Web: fetch blob → trigger browser download
        const res = await fetch(reportUrl, { headers });
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        onClose();
        return;
      }

      // Native (Android/iOS): downloadAsync stream thẳng xuống đĩa, không qua RAM
      const FileSystem = await import('expo-file-system');
      const Sharing = await import('expo-sharing');

      const uri = `${FileSystem.cacheDirectory}${filename}`;
      const result = await FileSystem.downloadAsync(reportUrl, uri, { headers });

      if (result.status !== 200) throw new Error(`Download failed: ${result.status}`);

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(result.uri, { mimeType, dialogTitle: `Export ${filename}` });
      } else {
        Alert.alert('Saved', `File saved to: ${result.uri}`);
      }
      onClose();
    } catch (e: any) {
      Alert.alert('Export failed', e?.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        className="flex-1 justify-end"
        style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
        onPress={onClose}
      >
        <Pressable onPress={() => {}} className="bg-surface rounded-t-3xl p-6 gap-5">

          {/* Title */}
          <Text className="text-lg font-bold text-on-surface">Export Report</Text>

          {/* Period type */}
          <View className="gap-2">
            <Text className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
              Period
            </Text>
            <View className="flex-row gap-3">
              {(['month', 'year'] as const).map((p) => (
                <Pressable
                  key={p}
                  onPress={() => setPeriod(p)}
                  className="flex-1 py-2.5 rounded-xl items-center active:opacity-70"
                  style={{ backgroundColor: period === p ? '#1E40AF' : '#f1f5f9' }}
                >
                  <Text
                    className="text-sm font-semibold capitalize"
                    style={{ color: period === p ? '#fff' : '#64748b' }}
                  >
                    {p === 'month' ? 'Monthly' : 'Yearly'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Month picker */}
          {period === 'month' && (
            <View className="gap-2">
              <Text className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Month
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {MONTHS.map((m, i) => (
                  <Pressable
                    key={i}
                    onPress={() => setSelectedMonth(i)}
                    className="px-3 py-1.5 rounded-lg active:opacity-70"
                    style={{ backgroundColor: selectedMonth === i ? '#1E40AF' : '#f1f5f9' }}
                  >
                    <Text
                      className="text-xs font-semibold"
                      style={{ color: selectedMonth === i ? '#fff' : '#64748b' }}
                    >
                      {m.slice(0, 3)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Year picker */}
          <View className="gap-2">
            <Text className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
              Year
            </Text>
            <View className="flex-row gap-2">
              {years.map((y) => (
                <Pressable
                  key={y}
                  onPress={() => setSelectedYear(y)}
                  className="flex-1 py-2 rounded-lg items-center active:opacity-70"
                  style={{ backgroundColor: selectedYear === y ? '#1E40AF' : '#f1f5f9' }}
                >
                  <Text
                    className="text-xs font-semibold"
                    style={{ color: selectedYear === y ? '#fff' : '#64748b' }}
                  >
                    {y}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Format */}
          <View className="gap-2">
            <Text className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
              Format
            </Text>
            <View className="flex-row gap-3">
              {(['excel', 'pdf'] as const).map((f) => (
                <Pressable
                  key={f}
                  onPress={() => setFormat(f)}
                  className="flex-1 py-2.5 rounded-xl items-center active:opacity-70"
                  style={{ backgroundColor: format === f ? '#1E40AF' : '#f1f5f9' }}
                >
                  <Text
                    className="text-sm font-semibold"
                    style={{ color: format === f ? '#fff' : '#64748b' }}
                  >
                    {f === 'excel' ? '📊 Excel' : '📄 PDF'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Export button */}
          <Pressable
            onPress={handleExport}
            disabled={loading}
            className="rounded-2xl py-4 items-center active:opacity-80"
            style={{ backgroundColor: '#1E40AF' }}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text className="text-sm font-bold text-white">Export {filename}</Text>
            }
          </Pressable>

        </Pressable>
      </Pressable>
    </Modal>
  );
}