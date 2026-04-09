import { useState, useMemo } from 'react';
import { Modal, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { View, Text, Pressable, TextInput, ScrollView } from '@/tw';
import { staffApi } from '@/lib/api/staff';
import type { StaffMember } from '@/types/api';

interface StaffPickerModalProps {
  visible: boolean;
  selected: string[];
  onConfirm: (ids: string[], members: StaffMember[]) => void;
  onClose: () => void;
}

function Initials({ name }: { name: string }) {
  const letters = name.trim().split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
  return (
    <View className="w-11 h-11 rounded-full items-center justify-center" style={{ backgroundColor: '#1E40AF' }}>
      <Text className="text-white font-bold text-sm">{letters}</Text>
    </View>
  );
}

export function StaffPickerModal({ visible, selected, onConfirm, onClose }: StaffPickerModalProps) {
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<string[]>(selected);

  const { data, isLoading } = useQuery({
    queryKey: ['staff'],
    queryFn: () => staffApi.list(),
    enabled: visible,
  });
  const staffList: StaffMember[] = data?.data ?? [];

  const filtered = useMemo(() => {
    if (!search.trim()) return staffList;
    const q = search.toLowerCase();
    return staffList.filter(
      (s) => s.full_name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q),
    );
  }, [staffList, search]);

  function toggle(id: string) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handleConfirm() {
    const members = staffList.filter((s) => picked.includes(s.id));
    onConfirm(picked, members);
    setSearch('');
  }

  function handleClose() {
    setPicked(selected);
    setSearch('');
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View className="flex-1 bg-surface">
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 pt-14 pb-4 border-b border-surface-container">
          <Pressable onPress={handleClose} className="active:opacity-60">
            <Text className="text-on-surface-variant font-medium">Cancel</Text>
          </Pressable>
          <Text className="text-lg font-extrabold text-on-surface">Assign Staff</Text>
          <View style={{ width: 56 }} />
        </View>

        {/* Search */}
        <View className="px-4 py-3">
          <View className="flex-row items-center bg-surface-container-high rounded-xl px-4 h-11 gap-2">
            <Text className="text-on-surface-variant text-base">🔍</Text>
            <TextInput
              className="flex-1 text-sm text-on-surface"
              placeholder="Search staff by name or role..."
              placeholderTextColor="#737685"
              value={search}
              onChangeText={setSearch}
            />
          </View>
        </View>

        {/* List */}
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#1E40AF" />
          </View>
        ) : (
          <ScrollView className="flex-1 px-4">
            {filtered.map((s) => {
              const isPicked = picked.includes(s.id);
              return (
                <Pressable
                  key={s.id}
                  onPress={() => toggle(s.id)}
                  className="flex-row items-center gap-3 py-3 border-b border-surface-container active:opacity-70"
                >
                  <Initials name={s.full_name} />
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-on-surface">{s.full_name}</Text>
                    <Text className="text-xs text-on-surface-variant mt-0.5">
                      {s.role.replace('_', ' ')}
                    </Text>
                  </View>
                  <View
                    className="w-6 h-6 rounded-full border-2 items-center justify-center"
                    style={{
                      backgroundColor: isPicked ? '#1E40AF' : 'transparent',
                      borderColor: isPicked ? '#1E40AF' : '#94a3b8',
                    }}
                  >
                    {isPicked && <Text className="text-white font-bold" style={{ fontSize: 12 }}>✓</Text>}
                  </View>
                </Pressable>
              );
            })}
            {filtered.length === 0 && (
              <Text className="text-center text-on-surface-variant py-8">No staff found</Text>
            )}
            <View className="h-6" />
          </ScrollView>
        )}

        {/* Confirm button */}
        <View className="px-5 pb-10 pt-3 border-t border-surface-container">
          <Pressable
            onPress={handleConfirm}
            disabled={picked.length === 0}
            className="h-14 rounded-2xl items-center justify-center active:opacity-80"
            style={{ backgroundColor: picked.length > 0 ? '#1E40AF' : '#94a3b8' }}
          >
            <Text className="text-white font-bold text-base">
              CONFIRM SELECTION{picked.length > 0 ? ` (${picked.length})` : ''} →
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
