import { useEffect, useRef, useState, useCallback } from 'react';
import { Modal, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { View, Text, Pressable } from '@/tw';
import { meApi } from '@/lib/api/me';
import { useSocketContext } from '@/context/socket';

interface PendingAlert {
  taskId: string;
  title: string;
  body: string;
}

function CountdownRing({ seconds, total }: { seconds: number; total: number }) {
  const pct = seconds / total;
  const color = pct > 0.4 ? '#16a34a' : pct > 0.15 ? '#f59e0b' : '#dc2626';
  return (
    <View className="items-center justify-center w-20 h-20">
      <View
        className="absolute inset-0 rounded-full border-4"
        style={{ borderColor: '#e5e7eb' }}
      />
      <View
        className="absolute inset-0 rounded-full border-4"
        style={{ borderColor: color, opacity: pct }}
      />
      <Text className="text-2xl font-bold" style={{ color }}>{seconds}</Text>
    </View>
  );
}

function AlertModal({ alert, onDismiss }: { alert: PendingAlert; onDismiss: () => void }) {
  const TOTAL = 60;
  const [seconds, setSeconds] = useState(TOTAL);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) { clearInterval(t); onDismiss(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [onDismiss]);

  const handleAccept = useCallback(async () => {
    setLoading(true);
    try {
      await meApi.claimPoolTask(alert.taskId);
      onDismiss();
      router.push(`/(staff)/tasks/${alert.taskId}` as any);
    } catch (err: any) {
      const code = err?.code ?? '';
      const msg = code === 'TIME_CONFLICT'
        ? 'Thời gian nhiệm vụ này trùng với nhiệm vụ bạn đang có.'
        : code === 'ALREADY_CLAIMED'
        ? 'Nhiệm vụ đã được người khác nhận rồi.'
        : 'Không thể nhận nhiệm vụ. Vui lòng thử lại.';
      Alert.alert('Không thể nhận', msg);
      onDismiss();
    } finally {
      setLoading(false);
    }
  }, [alert.taskId, onDismiss]);

  return (
    <Modal transparent animationType="fade" statusBarTranslucent>
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
        <View className="bg-white rounded-2xl mx-6 p-6 w-full max-w-sm">
          <View className="items-center mb-4">
            <Text className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">
              Nhiệm vụ mới gần bạn
            </Text>
            <CountdownRing seconds={seconds} total={TOTAL} />
            <Text className="text-xs text-gray-400 mt-1">giây để phản hồi</Text>
          </View>

          <Text className="text-lg font-bold text-gray-900 text-center mb-1">{alert.title}</Text>
          <Text className="text-sm text-gray-500 text-center mb-6">{alert.body}</Text>

          <View className="flex-row gap-3">
            <Pressable
              onPress={onDismiss}
              className="flex-1 py-3 rounded-xl border border-gray-200 items-center"
            >
              <Text className="font-semibold text-gray-600">Bỏ qua</Text>
            </Pressable>
            <Pressable
              onPress={handleAccept}
              disabled={loading}
              className="flex-1 py-3 rounded-xl bg-blue-600 items-center"
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text className="font-semibold text-white">Nhận ngay</Text>
              }
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function PoolTaskAlert() {
  const socket = useSocketContext();
  const [queue, setQueue] = useState<PendingAlert[]>([]);

  const push = useCallback((a: PendingAlert) => {
    setQueue((q) => {
      if (q.some((x) => x.taskId === a.taskId)) return q;
      return [...q, a];
    });
  }, []);

  const dismiss = useCallback(() => setQueue((q) => q.slice(1)), []);

  useEffect(() => {
    if (!socket) return;

    const handler = (data: any) => {
      if (data?.type === 'new_pool_task' && data?.task_id) {
        push({ taskId: data.task_id, title: data.title ?? 'Nhiệm vụ mới', body: data.body ?? '' });
      }
    };

    socket.on('notification:new', handler);
    return () => { socket.off('notification:new', handler); };
  }, [socket, push]);

  if (queue.length === 0) return null;
  return <AlertModal alert={queue[0]} onDismiss={dismiss} />;
}
