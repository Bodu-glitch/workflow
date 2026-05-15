import { Slot, usePathname, useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Text } from '@/tw';

const TABS = [
  { name: 'Tasks',    href: '/(staff)' as const,           match: /^\/(staff)?\/?$|^\/$/ },
  { name: 'Dịch vụ', href: '/(staff)/jobs' as const,       match: /\/jobs/ },
  { name: 'Lịch sử', href: '/(staff)/history' as const,    match: /\/history/ },
];

export default function StaffLayoutWeb() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <View style={{ flex: 1, flexDirection: 'column' }}>
      <View style={{ flex: 1 }}>
        <Slot />
      </View>

      <View style={{
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#f8f9ff',
        borderTopWidth: 1,
        borderTopColor: '#c3c6d6',
      }}>
        {TABS.map((tab) => {
          const active = tab.match.test(pathname);
          return (
            <Pressable
              key={tab.href}
              onPress={() => router.push(tab.href)}
              style={{
                paddingHorizontal: 20,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: active ? '#1E40AF' : '#dce9ff',
              }}
            >
              <Text style={{
                fontSize: 12,
                fontWeight: '700',
                color: active ? '#ffffff' : '#434654',
              }}>
                {tab.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
