import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Image,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '../../lib/api';
import { COLORS, CATEGORY_ICONS } from '../../constants/config';

interface Pricing {
  id: string;
  service_name: string;
  price_min?: number;
  price_max?: number;
  price_fixed?: number;
  estimated_duration_minutes?: number;
  category?: { name: string; slug: string };
}

interface WorkspaceDetail {
  id: string;
  name: string;
  logo_url?: string;
  description?: string;
  industry?: string;
  operating_area?: string;
  benefits?: string;
  policies?: string;
  categories?: Array<{ id: string; name: string; slug: string }>;
  pricings?: Pricing[];
  rating?: { avg: number | null; count: number };
}

function formatPrice(p: Pricing) {
  const fmt = (n: number) => n.toLocaleString('vi-VN') + 'đ';
  if (p.price_fixed) return fmt(p.price_fixed);
  if (p.price_min && p.price_max) return `${fmt(p.price_min)} – ${fmt(p.price_max)}`;
  if (p.price_min) return `Từ ${fmt(p.price_min)}`;
  return 'Liên hệ';
}

export default function CompanyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [workspace, setWorkspace] = useState<WorkspaceDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<WorkspaceDetail>(`/customer/workspaces/${id}`)
      .then(setWorkspace)
      .catch(console.warn)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!workspace) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Không tìm thấy thông tin công ty</Text>
      </View>
    );
  }

  const groupedPricings = workspace.pricings?.reduce((acc: Record<string, Pricing[]>, p) => {
    const key = p.category?.name ?? 'Khác';
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {}) ?? {};

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        {workspace.logo_url ? (
          <Image source={{ uri: workspace.logo_url }} style={styles.logo} />
        ) : (
          <View style={styles.logoFallback}>
            <Text style={styles.logoText}>{workspace.name.charAt(0)}</Text>
          </View>
        )}
        <Text style={styles.name}>{workspace.name}</Text>
        {workspace.industry && (
          <Text style={styles.industry}>{workspace.industry}</Text>
        )}

        {/* Rating */}
        {workspace.rating?.count ? (
          <View style={styles.ratingRow}>
            <Text style={styles.star}>⭐</Text>
            <Text style={styles.ratingText}>
              {workspace.rating.avg?.toFixed(1)} ({workspace.rating.count} đánh giá)
            </Text>
          </View>
        ) : null}

        {/* Area */}
        {workspace.operating_area && (
          <Text style={styles.area}>📍 {workspace.operating_area}</Text>
        )}
      </View>

      {/* Categories */}
      {workspace.categories && workspace.categories.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dịch vụ cung cấp</Text>
          <View style={styles.categoryGrid}>
            {workspace.categories.map(cat => (
              <View key={cat.id} style={styles.categoryItem}>
                <Text style={styles.categoryIcon}>{CATEGORY_ICONS[cat.slug] ?? '🔧'}</Text>
                <Text style={styles.categoryName}>{cat.name}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Description */}
      {workspace.description && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Giới thiệu</Text>
          <Text style={styles.description}>{workspace.description}</Text>
        </View>
      )}

      {/* Pricing */}
      {Object.keys(groupedPricings).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bảng giá dịch vụ</Text>
          {Object.entries(groupedPricings).map(([catName, items]) => (
            <View key={catName} style={styles.pricingGroup}>
              <Text style={styles.pricingGroupName}>{catName}</Text>
              {items.map(p => (
                <View key={p.id} style={styles.pricingRow}>
                  <View style={styles.pricingInfo}>
                    <Text style={styles.pricingName}>{p.service_name}</Text>
                    {p.estimated_duration_minutes && (
                      <Text style={styles.pricingDuration}>⏱ {p.estimated_duration_minutes} phút</Text>
                    )}
                  </View>
                  <Text style={styles.pricingPrice}>{formatPrice(p)}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      )}

      {/* Benefits & Policies */}
      {workspace.benefits && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ưu đãi</Text>
          <Text style={styles.description}>{workspace.benefits}</Text>
        </View>
      )}

      {/* CTA Button */}
      <TouchableOpacity
        style={styles.bookBtn}
        onPress={() => router.push({ pathname: '/request/new', params: { tenant_id: id } })}
      >
        <Text style={styles.bookBtnText}>Đặt dịch vụ ngay</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { gap: 16, paddingBottom: 32 },
  errorText: { color: COLORS.textSecondary, fontSize: 15 },
  header: {
    backgroundColor: COLORS.surface,
    padding: 24, alignItems: 'center', gap: 8,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  logo: { width: 80, height: 80, borderRadius: 20, marginBottom: 4 },
  logoFallback: {
    width: 80, height: 80, borderRadius: 20,
    backgroundColor: COLORS.primary + '20',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  logoText: { fontSize: 32, fontWeight: '700', color: COLORS.primary },
  name: { fontSize: 22, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  industry: { fontSize: 14, color: COLORS.textSecondary },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  star: { fontSize: 16 },
  ratingText: { fontSize: 14, color: COLORS.text, fontWeight: '600' },
  area: { fontSize: 13, color: COLORS.textSecondary },
  section: {
    backgroundColor: COLORS.surface, marginHorizontal: 16,
    borderRadius: 16, padding: 16, gap: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryItem: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.background, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  categoryIcon: { fontSize: 18 },
  categoryName: { fontSize: 13, color: COLORS.text, fontWeight: '500' },
  description: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 22 },
  pricingGroup: { gap: 8 },
  pricingGroupName: { fontSize: 13, fontWeight: '700', color: COLORS.primary, textTransform: 'uppercase' },
  pricingRow: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 8,
  },
  pricingInfo: { flex: 1, gap: 2 },
  pricingName: { fontSize: 14, color: COLORS.text, fontWeight: '500' },
  pricingDuration: { fontSize: 12, color: COLORS.textSecondary },
  pricingPrice: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  bookBtn: {
    marginHorizontal: 16,
    backgroundColor: COLORS.primary, borderRadius: 16,
    padding: 18, alignItems: 'center',
    shadowColor: COLORS.primary, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4,
  },
  bookBtnText: { color: '#fff', fontWeight: '800', fontSize: 17 },
});
