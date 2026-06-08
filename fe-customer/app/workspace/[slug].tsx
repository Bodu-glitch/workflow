import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../lib/api';
import type { Workspace } from '../../lib/api';
import { COLORS } from '../../constants/config';

type WorkspaceDetail = Workspace & {
  services: Array<{ id: string; name: string }>;
  rating_avg: number | null;
  rating_count: number;
};

export default function WorkspaceDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const [workspace, setWorkspace] = useState<WorkspaceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    api.getWorkspace(slug as string)
      .then(setWorkspace)
      .catch(() => setError('Không thể tải thông tin doanh nghiệp'))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  if (error || !workspace) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? 'Không tìm thấy'}</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const initials = workspace.name.charAt(0).toUpperCase();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
          <Text style={styles.headerBackText}>←</Text>
        </TouchableOpacity>
      </View>

      <ScrollView>
        {/* Hero */}
        <View style={styles.hero}>
          {workspace.logo_url ? (
            <Image source={{ uri: workspace.logo_url }} style={styles.logo} />
          ) : (
            <View style={styles.logoPlaceholder}>
              <Text style={styles.logoText}>{initials}</Text>
            </View>
          )}
          <Text style={styles.name}>{workspace.name}</Text>
          {workspace.industry && <Text style={styles.industry}>🔧 {workspace.industry}</Text>}
          {workspace.rating_avg !== null && (
            <View style={styles.ratingRow}>
              <Text style={styles.rating}>⭐ {workspace.rating_avg.toFixed(1)}</Text>
              <Text style={styles.ratingCount}>({workspace.rating_count} đánh giá)</Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thông tin</Text>
          {workspace.description && (
            <Text style={styles.description}>{workspace.description}</Text>
          )}
          {workspace.operating_area && (
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>📍</Text>
              <Text style={styles.infoText}>{workspace.operating_area}</Text>
            </View>
          )}
          {workspace.benefits && (
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>🎁</Text>
              <Text style={styles.infoText}>{workspace.benefits}</Text>
            </View>
          )}
        </View>

        {/* Services */}
        {workspace.services.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dịch vụ cung cấp</Text>
            <View style={styles.serviceGrid}>
              {workspace.services.map((s) => (
                <View key={s.id} style={styles.serviceChip}>
                  <Text style={styles.serviceText}>🔧 {s.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* CTA */}
        <View style={{ padding: 20 }}>
          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={() => router.push('/request/new')}
          >
            <Text style={styles.ctaBtnText}>📋 Đặt dịch vụ ngay</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 },
  errorText: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center' },
  backBtn: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: COLORS.primary, borderRadius: 12 },
  backBtnText: { color: '#fff', fontWeight: '600' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12,
    backgroundColor: COLORS.surface,
  },
  headerBack: { padding: 8 },
  headerBackText: { fontSize: 20, color: COLORS.primary, fontWeight: '600' },
  hero: {
    backgroundColor: COLORS.surface, padding: 24,
    alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  logo: { width: 80, height: 80, borderRadius: 20 },
  logoPlaceholder: { width: 80, height: 80, borderRadius: 20, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 32, fontWeight: '700', color: '#fff' },
  name: { fontSize: 22, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  industry: { fontSize: 13, color: COLORS.textSecondary },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rating: { fontSize: 16, fontWeight: '700', color: COLORS.rating },
  ratingCount: { fontSize: 12, color: COLORS.textSecondary },
  section: { backgroundColor: COLORS.surface, margin: 16, borderRadius: 16, padding: 16, gap: 10 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.text, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  description: { fontSize: 14, color: COLORS.text, lineHeight: 22 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  infoIcon: { fontSize: 16 },
  infoText: { fontSize: 14, color: COLORS.textSecondary, flex: 1, lineHeight: 20 },
  serviceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  serviceChip: { backgroundColor: COLORS.primary + '15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  serviceText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  ctaBtn: { backgroundColor: COLORS.primary, borderRadius: 16, padding: 16, alignItems: 'center' },
  ctaBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
