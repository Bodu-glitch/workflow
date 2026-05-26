import { useState } from 'react';
import { Modal, FlatList } from 'react-native';
import { View, Text, Pressable } from '@/tw';

export interface FilterOption {
  label: string;
  value: string | undefined;
}

interface Props {
  label: string;
  value: string | undefined;
  options: FilterOption[];
  onChange: (value: string | undefined) => void;
}

export function FilterDropdown({ label, value, options, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const displayLabel = selected ? selected.label : 'All';
  const isFiltered = value !== undefined;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        className={`flex-1 flex-row items-center justify-between px-3 py-2.5 rounded-xl gap-1 active:opacity-70 ${isFiltered ? 'bg-primary' : 'bg-surface-container-high'}`}
      >
        <View className="flex-1 min-w-0">
          <Text className={`text-[10px] font-bold uppercase tracking-wide ${isFiltered ? 'text-white/70' : 'text-on-surface-variant'}`}>
            {label}
          </Text>
          <Text className={`text-xs font-bold mt-0.5 ${isFiltered ? 'text-white' : 'text-on-surface'}`} numberOfLines={1}>
            {displayLabel}
          </Text>
        </View>
        <Text className={`text-xs ${isFiltered ? 'text-white/70' : 'text-on-surface-variant'}`}>▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}
          onPress={() => setOpen(false)}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View className="bg-surface rounded-t-2xl" style={{ maxHeight: 400 }}>
              <View className="px-5 pt-5 pb-3 flex-row items-center justify-between">
                <Text className="text-base font-bold text-on-surface">{label}</Text>
                <Pressable onPress={() => setOpen(false)} className="active:opacity-60 p-1">
                  <Text className="text-on-surface-variant text-lg">✕</Text>
                </Pressable>
              </View>
              <FlatList
                data={options}
                keyExtractor={(item) => String(item.value ?? '__all')}
                style={{ paddingBottom: 8 }}
                renderItem={({ item }) => {
                  const active = item.value === value;
                  return (
                    <Pressable
                      onPress={() => { onChange(item.value); setOpen(false); }}
                      className="px-5 py-3.5 flex-row items-center justify-between active:bg-surface-container"
                    >
                      <Text className={`text-sm font-semibold ${active ? 'text-primary' : 'text-on-surface'}`}>
                        {item.label}
                      </Text>
                      {active && <Text className="text-primary text-base">✓</Text>}
                    </Pressable>
                  );
                }}
              />
              <View className="h-6" />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}