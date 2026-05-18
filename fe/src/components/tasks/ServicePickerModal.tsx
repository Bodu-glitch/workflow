import { useState, useMemo } from 'react';
import { Modal, ActivityIndicator, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { View, Text, Pressable, TextInput, ScrollView } from '@/tw';
import { tenantApi } from '@/lib/api/tenant';
import type { TenantService } from '@/types/api';

interface ServicePickerModalProps {
  visible: boolean;
  selected: string | undefined;
  onConfirm: (name: string) => void;
  onClose: () => void;
}

export function ServicePickerModal({ visible, selected, onConfirm, onClose }: ServicePickerModalProps) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [picked, setPicked] = useState<string | undefined>(selected);

  const { data, isLoading } = useQuery({
    queryKey: ['tenant-services'],
    queryFn: () => tenantApi.services.list(),
    enabled: visible,
    select: (d) => d.data,
  });
  const services: TenantService[] = data ?? [];

  const addMutation = useMutation({
    mutationFn: (name: string) => tenantApi.services.create(name),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['tenant-services'] });
      qc.invalidateQueries({ queryKey: ['task-filter-options'] });
      setPicked(res.data.name);
      setNewName('');
    },
    onError: () => Alert.alert('Error', 'Failed to add service'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tenantApi.services.delete(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['tenant-services'] });
      qc.invalidateQueries({ queryKey: ['task-filter-options'] });
      if (picked === services.find((s) => s.id === id)?.name) setPicked(undefined);
    },
    onError: () => Alert.alert('Error', 'Failed to delete service'),
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return services;
    const q = search.toLowerCase();
    return services.filter((s) => s.name.toLowerCase().includes(q));
  }, [services, search]);

  function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (services.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
      setPicked(trimmed);
      setNewName('');
      return;
    }
    addMutation.mutate(trimmed);
  }

  function handleConfirm() {
    if (picked) {
      onConfirm(picked);
      setSearch('');
      setNewName('');
    }
  }

  function handleClose() {
    setPicked(selected);
    setSearch('');
    setNewName('');
    onClose();
  }

  function confirmDelete(service: TenantService) {
    Alert.alert(
      'Delete Service',
      `Remove "${service.name}" from the service list? Existing tasks will keep this value.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(service.id) },
      ],
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View className="flex-1 bg-surface">
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 pt-14 pb-4 border-b border-surface-container">
          <Pressable onPress={handleClose} className="active:opacity-60">
            <Text className="text-on-surface-variant font-medium">Cancel</Text>
          </Pressable>
          <Text className="text-lg font-extrabold text-on-surface">Select Service</Text>
          <View style={{ width: 56 }} />
        </View>

        {/* Search */}
        <View className="px-4 py-3">
          <View className="flex-row items-center bg-surface-container-high rounded-xl px-4 h-11 gap-2">
            <Text className="text-on-surface-variant text-base">🔍</Text>
            <TextInput
              className="flex-1 text-sm text-on-surface"
              placeholder="Search services..."
              placeholderTextColor="#737685"
              value={search}
              onChangeText={setSearch}
              style={{ outlineStyle: 'none' } as any}
            />
          </View>
        </View>

        {/* Add new service */}
        <View className="px-4 pb-3 flex-row gap-2">
          <View className="flex-1 flex-row items-center bg-surface-container-high rounded-xl px-4 h-11 gap-2">
            <Text className="text-on-surface-variant text-base">🔧</Text>
            <TextInput
              className="flex-1 text-sm text-on-surface"
              placeholder="Add new service..."
              placeholderTextColor="#737685"
              value={newName}
              onChangeText={setNewName}
              onSubmitEditing={handleAdd}
              returnKeyType="done"
              style={{ outlineStyle: 'none' } as any}
            />
          </View>
          <Pressable
            onPress={handleAdd}
            disabled={!newName.trim() || addMutation.isPending}
            className="h-11 px-4 rounded-xl items-center justify-center active:opacity-80"
            style={{ backgroundColor: newName.trim() ? '#1E40AF' : '#e2e8f0' }}
          >
            {addMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-sm font-bold" style={{ color: newName.trim() ? '#fff' : '#94a3b8' }}>Add</Text>
            )}
          </Pressable>
        </View>

        {/* List */}
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#1E40AF" />
          </View>
        ) : (
          <ScrollView className="flex-1 px-4">
            {filtered.map((s) => {
              const isPicked = picked === s.name;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => setPicked(isPicked ? undefined : s.name)}
                  className="flex-row items-center gap-3 py-3 border-b border-surface-container active:opacity-70"
                >
                  <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: '#eff6ff' }}>
                    <Text style={{ fontSize: 18 }}>🔧</Text>
                  </View>
                  <Text className="flex-1 text-sm font-semibold text-on-surface">{s.name}</Text>
                  <Pressable
                    onPress={() => confirmDelete(s)}
                    className="p-2 active:opacity-60"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={{ fontSize: 16 }}>🗑️</Text>
                  </Pressable>
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
            {filtered.length === 0 && !isLoading && (
              <Text className="text-center text-on-surface-variant py-8">
                {search ? 'No matching services' : 'No services yet — add one above'}
              </Text>
            )}
            <View className="h-6" />
          </ScrollView>
        )}

        {/* Confirm button */}
        <View className="px-5 pb-10 pt-3 border-t border-surface-container">
          <Pressable
            onPress={handleConfirm}
            disabled={!picked}
            className="h-14 rounded-2xl items-center justify-center active:opacity-80"
            style={{ backgroundColor: picked ? '#1E40AF' : '#94a3b8' }}
          >
            <Text className="text-white font-bold text-base">
              {picked ? `CONFIRM: ${picked}  →` : 'SELECT A SERVICE'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}