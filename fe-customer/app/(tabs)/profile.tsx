import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Image } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { COLORS } from '../../constants/config';

interface MenuItem {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  chevron?: boolean;
}

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert('Đăng xuất', 'Bạn muốn đăng xuất?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: logout },
    ]);
  };

  const menuItems: MenuItem[] = [
    {
      icon: '✏️', label: 'Chỉnh sửa hồ sơ',
      onPress: () => router.push('/profile/edit'), chevron: true,
    },
    {
      icon: '📍', label: 'Địa chỉ đã lưu',
      onPress: () => router.push('/profile/addresses'), chevron: true,
    },
    {
      icon: '🔔', label: 'Thông báo',
      onPress: () => router.push('/notifications'), chevron: true,
    },
    {
      icon: '📞', label: 'Số điện thoại',
      value: user?.phone ?? 'Chưa cập nhật',
    },
    {
      icon: '👤', label: 'Vai trò',
      value: 'Khách hàng',
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar section */}
      <View style={styles.avatarSection}>
        {user?.avatar_url ? (
          <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.full_name?.charAt(0).toUpperCase() ?? '?'}
            </Text>
          </View>
        )}
        <Text style={styles.name}>{user?.full_name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <TouchableOpacity
          style={styles.editAvatarBtn}
          onPress={() => router.push('/profile/edit')}
        >
          <Text style={styles.editAvatarText}>Chỉnh sửa hồ sơ</Text>
        </TouchableOpacity>
      </View>

      {/* Menu items */}
      <View style={styles.section}>
        {menuItems.map((item, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.menuRow, i < menuItems.length - 1 && styles.menuRowBorder]}
            onPress={item.onPress}
            disabled={!item.onPress}
            activeOpacity={item.onPress ? 0.7 : 1}
          >
            <Text style={styles.menuIcon}>{item.icon}</Text>
            <View style={styles.menuContent}>
              <Text style={styles.menuLabel}>{item.label}</Text>
              {item.value && (
                <Text style={styles.menuValue}>{item.value}</Text>
              )}
            </View>
            {item.chevron && (
              <Text style={styles.chevron}>›</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>🚪 Đăng xuất</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, gap: 20 },
  avatarSection: { alignItems: 'center', gap: 8, paddingVertical: 20 },
  avatar: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 36, fontWeight: '700', color: '#fff' },
  name: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  email: { fontSize: 13, color: COLORS.textSecondary },
  editAvatarBtn: {
    marginTop: 4,
    paddingHorizontal: 20, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.primary,
  },
  editAvatarText: { color: COLORS.primary, fontWeight: '600', fontSize: 13 },
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  menuRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, gap: 14,
  },
  menuRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  menuIcon: { fontSize: 22, width: 32 },
  menuContent: { flex: 1, gap: 2 },
  menuLabel: { fontSize: 15, color: COLORS.text, fontWeight: '500' },
  menuValue: { fontSize: 13, color: COLORS.textSecondary },
  chevron: { fontSize: 22, color: COLORS.textSecondary },
  logoutBtn: {
    backgroundColor: COLORS.surface,
    borderRadius: 14, padding: 16,
    alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.error,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  logoutText: { color: COLORS.error, fontWeight: '700', fontSize: 15 },
});
