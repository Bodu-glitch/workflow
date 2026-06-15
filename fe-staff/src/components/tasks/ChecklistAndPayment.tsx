import { useState, useEffect, useCallback } from 'react';
import { Image as RNImage, ActivityIndicator, Alert } from 'react-native';
import { useQuery, useMutation } from '@tanstack/react-query';
import { View, Text, Pressable, TextInput } from '@/tw';
import { meApi, TaskServiceItem } from '@/lib/api/me';

function formatVND(amount: number) {
  return amount.toLocaleString('vi-VN') + ' ₫';
}

function vietQrUrl(bankCode: string, accountNo: string, accountName: string, amount: number, info: string) {
  const base = `https://img.vietqr.io/image/${bankCode}-${accountNo}-compact.png`;
  const params = new URLSearchParams({
    amount: String(Math.max(0, Math.round(amount))),
    addInfo: info.slice(0, 25),
    accountName,
  });
  return `${base}?${params}`;
}

// ── Service item row ──────────────────────────────────────────────────────────
function ServiceRow({
  item,
  onChange,
  onRemove,
}: {
  item: TaskServiceItem;
  onChange: (updated: TaskServiceItem) => void;
  onRemove?: () => void;
}) {
  return (
    <View className="flex-row items-center gap-3 mb-3">
      <Pressable
        onPress={() => onChange({ ...item, checked: !item.checked })}
        className={`w-6 h-6 rounded border-2 items-center justify-center flex-shrink-0 ${item.checked ? 'bg-primary border-primary' : 'border-on-surface-variant'}`}
      >
        {item.checked && <Text className="text-white text-xs font-bold">✓</Text>}
      </Pressable>

      <View className="flex-1">
        <Text className={`text-sm ${item.checked ? 'text-on-surface' : 'text-on-surface-variant line-through'}`} numberOfLines={1}>
          {item.label}
        </Text>
        {item.is_custom && (
          <TextInput
            className="text-xs text-primary bg-transparent p-0 mt-0.5"
            value={String(item.unit_price || '')}
            onChangeText={(v) => onChange({ ...item, unit_price: Number(v.replace(/\D/g, '')) })}
            placeholder="Nhập giá..."
            placeholderTextColor="#94a3b8"
            keyboardType="numeric"
          />
        )}
        {!item.is_custom && item.unit_price > 0 && (
          <Text className="text-xs text-on-surface-variant">{formatVND(item.unit_price)}</Text>
        )}
      </View>

      {item.is_custom && (
        <Pressable onPress={onRemove} className="p-1 active:opacity-60">
          <Text className="text-error text-sm">✕</Text>
        </Pressable>
      )}
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props {
  taskId: string;
  taskTitle: string;
  tenantId: string;
  onChange?: (items: TaskServiceItem[], total: number) => void;
}

export function ChecklistAndPayment({ taskId, taskTitle, onChange }: Props) {
  const [items, setItems] = useState<TaskServiceItem[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editAmount, setEditAmount] = useState<string | null>(null);

  const { data: services = [] } = useQuery({
    queryKey: ['workspace-services'],
    queryFn: () => meApi.workspaceServices().then((r) => (r as any).data ?? r),
    staleTime: 5 * 60 * 1000,
  });

  const { data: paymentInfo } = useQuery({
    queryKey: ['workspace-payment'],
    queryFn: () => meApi.paymentInfo().then((r) => (r as any)?.data ?? (r as any) ?? null),
    staleTime: 5 * 60 * 1000,
  });

  const { data: savedItems } = useQuery({
    queryKey: ['task-items', taskId],
    queryFn: () => meApi.getTaskItems(taskId).then((r) => (r as any).data ?? r),
  });

  const saveMut = useMutation({
    mutationFn: (toSave: TaskServiceItem[]) => meApi.saveTaskItems(taskId, toSave),
  });

  // Initialise items: saved items if any, else tenant services as pre-checked
  useEffect(() => {
    if (savedItems && Array.isArray(savedItems) && savedItems.length > 0) {
      setItems(savedItems);
      return;
    }
    if (services && services.length > 0) {
      setItems(
        services.map((s: any) => ({
          service_id: s.id,
          label: s.name,
          unit_price: s.unit_price ?? 0,
          is_custom: false,
          checked: true,
        })),
      );
    }
  }, [savedItems, services]);

  const total = items.filter((i) => i.checked).reduce((s, i) => s + (i.unit_price || 0), 0);
  const displayAmount = editAmount !== null ? Number(editAmount.replace(/\D/g, '')) : total;

  const update = useCallback((next: TaskServiceItem[]) => {
    setItems(next);
    const t = next.filter((i) => i.checked).reduce((s, i) => s + (i.unit_price || 0), 0);
    onChange?.(next, t);
    void saveMut.mutate(next);
  }, [onChange, saveMut]);

  const handleChange = useCallback((idx: number, updated: TaskServiceItem) => {
    const next = items.map((item, i) => (i === idx ? updated : item));
    update(next);
  }, [items, update]);

  const handleRemove = useCallback((idx: number) => {
    update(items.filter((_, i) => i !== idx));
  }, [items, update]);

  const addCustom = useCallback(() => {
    if (!newLabel.trim()) return;
    const next = [...items, {
      label: newLabel.trim(),
      unit_price: Number(newPrice.replace(/\D/g, '')) || 0,
      is_custom: true,
      checked: true,
    }];
    update(next);
    setNewLabel('');
    setNewPrice('');
    setShowAddForm(false);
  }, [items, newLabel, newPrice, update]);

  return (
    <View>
      {/* ── Checklist ── */}
      <View className="bg-surface-container-lowest rounded-xl p-5 mb-4">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
            Checklist dịch vụ
          </Text>
          <View className="flex-row items-center gap-2">
            {saveMut.isPending && <ActivityIndicator size="small" color="#6b7280" />}
            <Text className="text-xs text-primary font-semibold">{formatVND(total)}</Text>
          </View>
        </View>

        {items.length === 0 && (
          <Text className="text-xs text-on-surface-variant italic mb-3">Chưa có dịch vụ nào</Text>
        )}

        {items.map((item, idx) => (
          <ServiceRow
            key={`${item.service_id ?? 'custom'}-${idx}`}
            item={item}
            onChange={(updated) => handleChange(idx, updated)}
            onRemove={item.is_custom ? () => handleRemove(idx) : undefined}
          />
        ))}

        {/* Add custom item */}
        {showAddForm ? (
          <View className="bg-surface-container-high rounded-xl p-3 mt-2">
            <TextInput
              className="text-sm text-on-surface bg-transparent mb-2"
              placeholder="Tên dịch vụ phát sinh..."
              placeholderTextColor="#94a3b8"
              value={newLabel}
              onChangeText={setNewLabel}
              autoFocus
            />
            <TextInput
              className="text-sm text-on-surface bg-transparent mb-3"
              placeholder="Giá (VNĐ)"
              placeholderTextColor="#94a3b8"
              value={newPrice}
              onChangeText={setNewPrice}
              keyboardType="numeric"
            />
            <View className="flex-row gap-2">
              <Pressable onPress={addCustom} className="flex-1 py-2 rounded-lg bg-primary items-center active:opacity-80">
                <Text className="text-white text-xs font-bold">Thêm</Text>
              </Pressable>
              <Pressable onPress={() => { setShowAddForm(false); setNewLabel(''); setNewPrice(''); }}
                className="px-4 py-2 rounded-lg bg-surface-container items-center active:opacity-70">
                <Text className="text-xs text-on-surface-variant">Hủy</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable onPress={() => setShowAddForm(true)}
            className="flex-row items-center gap-2 mt-2 py-2 active:opacity-60">
            <Text className="text-primary text-base font-bold">+</Text>
            <Text className="text-primary text-xs font-semibold">Thêm phát sinh</Text>
          </Pressable>
        )}
      </View>

      {/* ── QR thanh toán ── */}
      {paymentInfo && (
        <View className="bg-surface-container-lowest rounded-xl p-5 mb-4">
          <Text className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-4">
            QR thanh toán
          </Text>

          <View className="items-center mb-4">
            <RNImage
              source={{ uri: vietQrUrl(paymentInfo.bank_name, paymentInfo.bank_account, paymentInfo.bank_account_name, displayAmount, taskTitle) }}
              style={{ width: 220, height: 280, borderRadius: 12 }}
              resizeMode="contain"
            />
          </View>

          <View className="bg-surface-container-high rounded-xl px-4 py-3 mb-3">
            <Text className="text-xs text-on-surface-variant mb-1">{paymentInfo.bank_name} — {paymentInfo.bank_account}</Text>
            <Text className="text-sm font-semibold text-on-surface">{paymentInfo.bank_account_name}</Text>
          </View>

          {/* Editable amount */}
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-semibold text-on-surface-variant">Số tiền</Text>
            <View className="flex-row items-center gap-1">
              <TextInput
                className="text-base font-bold text-primary text-right bg-transparent"
                value={editAmount ?? String(total)}
                onChangeText={setEditAmount}
                onBlur={() => {
                  if (editAmount === null) return;
                  const cleaned = editAmount.replace(/\D/g, '');
                  setEditAmount(cleaned);
                }}
                keyboardType="numeric"
                style={{ minWidth: 80 }}
              />
              <Text className="text-base font-bold text-primary">₫</Text>
            </View>
          </View>
          {editAmount !== null && Number(editAmount.replace(/\D/g, '')) !== total && (
            <Pressable onPress={() => setEditAmount(null)} className="mt-1 self-end active:opacity-60">
              <Text className="text-xs text-on-surface-variant underline">Về mặc định ({formatVND(total)})</Text>
            </Pressable>
          )}
        </View>
      )}

      {!paymentInfo && (
        <View className="bg-surface-container-high rounded-xl px-4 py-3 mb-4">
          <Text className="text-xs text-on-surface-variant text-center">
            💳 Chưa cấu hình thông tin thanh toán. BO cần cài đặt trong workspace.
          </Text>
        </View>
      )}
    </View>
  );
}
