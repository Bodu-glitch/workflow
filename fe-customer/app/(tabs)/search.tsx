import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, ActivityIndicator, Image, ScrollView as RNScrollView,
  Platform,
} from 'react-native';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { api } from '../../lib/api';
import type { Workspace } from '../../lib/api';
import { COLORS } from '../../constants/config';

const CATEGORIES = [
  { slug: 'dien', label: '⚡ Điện' },
  { slug: 'nuoc', label: '🚿 Nước' },
  { slug: 'dieu-hoa', label: '❄️ Điều hòa' },
  { slug: 'may-giat', label: '🔄 Máy giặt' },
  { slug: 'sua-chua', label: '🔧 Sửa chữa' },
  { slug: 'bao-duong', label: '🛠 Bảo dưỡng' },
];

const RATING_OPTIONS = [
  { label: '⭐ 4.5+', value: 4.5 },
  { label: '⭐ 4+', value: 4 },
  { label: '⭐ 3+', value: 3 },
];

function formatDistance(m?: number) {
  if (m == null || m === Infinity) return null;
  if (m < 1000) return `${Math.round(m)}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

function StarRating({ avg, count }: { avg: number | null; count: number }) {
  if (!avg) return null;
  return (
    <View style={styles.ratingRow}>
      <Text style={styles.ratingText}>⭐ {avg.toFixed(1)}</Text>
      <Text style={styles.ratingCount}>({count})</Text>
    </View>
  );
}

function WorkspaceCard({ workspace, onPress }: { workspace: Workspace; onPress: () => void }) {
  const initials = workspace.name.charAt(0).toUpperCase();
  const dist = formatDistance(workspace.distance_m);
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardLeft}>
        {workspace.logo_url ? (
          <Image source={{ uri: workspace.logo_url }} style={styles.logo} />
        ) : (
          <View style={styles.logoPlaceholder}>
            <Text style={styles.logoText}>{initials}</Text>
          </View>
        )}
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardNameRow}>
          <Text style={styles.cardName} numberOfLines={1}>{workspace.name}</Text>
          <Text style={styles.verified}>✓</Text>
        </View>
        {workspace.industry && (
          <Text style={styles.cardIndustry} numberOfLines={1}>🔧 {workspace.industry}</Text>
        )}
        <View style={styles.cardMeta}>
          {workspace.operating_area && (
            <Text style={styles.cardArea} numberOfLines={1}>📍 {workspace.operating_area}</Text>
          )}
          {dist && <Text style={styles.distanceText}>📐 {dist}</Text>}
        </View>
        <StarRating avg={workspace.rating_avg} count={workspace.rating_count} />
        {workspace.description && (
          <Text style={styles.cardDesc} numberOfLines={1}>{workspace.description}</Text>
        )}
      </View>
      <Text style={styles.cardArrow}>›</Text>
    </TouchableOpacity>
  );
}

export default function SearchScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [minRating, setMinRating] = useState<number | null>(null);
  const [nearMe, setNearMe] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);

  const getGps = useCallback(async () => {
    if (userCoords) return userCoords;
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      setUserCoords(coords);
      return coords;
    } catch {
      return null;
    } finally {
      setGpsLoading(false);
    }
  }, [userCoords]);

  const toggleNearMe = async () => {
    if (nearMe) {
      setNearMe(false);
      return;
    }
    const coords = await getGps();
    if (coords) setNearMe(true);
  };

  const fetchWorkspaces = useCallback(async (
    q: string,
    cat: string | null,
    rating: number | null,
    near: boolean,
    coords: { lat: number; lng: number } | null,
    p: number,
    reset = false,
  ) => {
    setLoading(true);
    try {
      const res = await api.listWorkspaces({
        search: q || undefined,
        category: cat || undefined,
        min_rating: rating ?? undefined,
        lat: (near && coords) ? coords.lat : undefined,
        lng: (near && coords) ? coords.lng : undefined,
        sort_by: near ? 'distance' : (rating ? 'rating' : 'name'),
        page: p,
      });
      const items = res.data ?? [];
      setWorkspaces(reset ? items : (prev) => [...prev, ...items]);
      setTotal(res.meta?.total ?? items.length);
      setHasMore(items.length === 20);
    } catch {
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPage(1);
    fetchWorkspaces(search, activeCategory, minRating, nearMe, userCoords, 1, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, activeCategory, minRating, nearMe]);

  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;
    const next = page + 1;
    setPage(next);
    fetchWorkspaces(search, activeCategory, minRating, nearMe, userCoords, next, false);
  }, [loading, hasMore, page, search, activeCategory, minRating, nearMe, userCoords, fetchWorkspaces]);

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Tìm theo tên công ty, dịch vụ..."
          placeholderTextColor={COLORS.textSecondary}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={{ color: COLORS.textSecondary, fontSize: 16, paddingHorizontal: 8 }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Category filter */}
      <RNScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        <TouchableOpacity
          style={[styles.catChip, !activeCategory && styles.catChipActive]}
          onPress={() => setActiveCategory(null)}
        >
          <Text style={[styles.catText, !activeCategory && styles.catTextActive]}>Tất cả</Text>
        </TouchableOpacity>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.slug}
            style={[styles.catChip, activeCategory === cat.slug && styles.catChipActive]}
            onPress={() => setActiveCategory(cat.slug === activeCategory ? null : cat.slug)}
          >
            <Text style={[styles.catText, activeCategory === cat.slug && styles.catTextActive]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </RNScrollView>

      {/* Rating + GPS filters */}
      <RNScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {/* GPS Near Me chip */}
        <TouchableOpacity
          style={[styles.filterChip, nearMe && styles.filterChipActive]}
          onPress={toggleNearMe}
          disabled={gpsLoading}
        >
          {gpsLoading
            ? <ActivityIndicator size="small" color={nearMe ? '#fff' : COLORS.primary} style={{ marginRight: 4 }} />
            : null
          }
          <Text style={[styles.filterChipText, nearMe && styles.filterChipTextActive]}>
            📍 Gần tôi
          </Text>
        </TouchableOpacity>

        {/* Rating chips */}
        {RATING_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.filterChip, minRating === opt.value && styles.filterChipActive]}
            onPress={() => setMinRating(minRating === opt.value ? null : opt.value)}
          >
            <Text style={[styles.filterChipText, minRating === opt.value && styles.filterChipTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </RNScrollView>

      {/* Result count */}
      {!loading && total > 0 && (
        <Text style={styles.resultCount}>
          {total} doanh nghiệp{nearMe ? ' gần bạn' : ''}
          {minRating ? ` · ${minRating}⭐+` : ''}
        </Text>
      )}

      {/* List */}
      <FlatList
        data={workspaces}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <WorkspaceCard
            workspace={item}
            onPress={() => router.push({ pathname: '/workspace/[slug]', params: { slug: item.slug } } as any)}
          />
        )}
        contentContainerStyle={styles.list}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.empty}>
              <Text style={{ fontSize: 40 }}>🔍</Text>
              <Text style={styles.emptyText}>Không tìm thấy doanh nghiệp nào</Text>
              <Text style={styles.emptySubtext}>Thử tìm kiếm với từ khóa khác</Text>
            </View>
          )
        }
        ListFooterComponent={loading ? <ActivityIndicator color={COLORS.primary} style={{ margin: 16 }} /> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    margin: 16, marginBottom: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: COLORS.surface, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text },
  filterRow: { flexDirection: 'row', alignItems: 'flex-start', paddingLeft: 16, paddingRight: 4, paddingTop: 6, paddingBottom: 6 },
  catChip: { alignSelf: 'flex-start', flexShrink: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.border, marginRight: 8 },
  catChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catText: { fontSize: 12, fontWeight: '600', color: COLORS.text },
  catTextActive: { color: '#fff' },
  filterChip: {
    alignSelf: 'flex-start', flexShrink: 0, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.border, marginRight: 8,
  },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipText: { fontSize: 12, fontWeight: '600', color: COLORS.text },
  filterChipTextActive: { color: '#fff' },
  resultCount: { fontSize: 12, color: COLORS.textSecondary, paddingHorizontal: 16, marginBottom: 4 },
  list: { padding: 16, gap: 12, paddingTop: 0 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.surface, borderRadius: 16, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  cardLeft: {},
  logo: { width: 52, height: 52, borderRadius: 12 },
  logoPlaceholder: { width: 52, height: 52, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 22, fontWeight: '700', color: '#fff' },
  cardBody: { flex: 1, gap: 3 },
  cardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardName: { fontSize: 15, fontWeight: '700', color: COLORS.primary, flex: 1 },
  verified: { fontSize: 13, color: '#3B82F6', fontWeight: '700' },
  cardIndustry: { fontSize: 12, color: COLORS.textSecondary },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cardArea: { fontSize: 12, color: COLORS.textSecondary, flex: 1 },
  distanceText: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 12, fontWeight: '700', color: '#f59e0b' },
  ratingCount: { fontSize: 11, color: COLORS.textSecondary },
  cardDesc: { fontSize: 12, color: COLORS.text, marginTop: 2 },
  cardArrow: { fontSize: 20, color: COLORS.textSecondary },
  empty: { alignItems: 'center', gap: 8, paddingTop: 60 },
  emptyText: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  emptySubtext: { fontSize: 13, color: COLORS.textSecondary },
});
