import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, ActivityIndicator, Image,
} from 'react-native';
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

function WorkspaceCard({ workspace, onPress }: { workspace: Workspace; onPress: () => void }) {
  const initials = workspace.name.charAt(0).toUpperCase();
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
        {workspace.operating_area && (
          <Text style={styles.cardArea} numberOfLines={1}>📍 {workspace.operating_area}</Text>
        )}
        {workspace.description && (
          <Text style={styles.cardDesc} numberOfLines={2}>{workspace.description}</Text>
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
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);

  const fetchWorkspaces = useCallback(async (q: string, cat: string | null, p: number, reset = false) => {
    setLoading(true);
    try {
      const res = await api.listWorkspaces({ search: q || undefined, category: cat || undefined, page: p });
      const items = res.data ?? [];
      setWorkspaces(reset ? items : (prev) => [...prev, ...items]);
      setTotal(res.meta?.total ?? items.length);
      setHasMore(items.length === 20);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPage(1);
    fetchWorkspaces(search, activeCategory, 1, true);
  }, [search, activeCategory, fetchWorkspaces]);

  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;
    const next = page + 1;
    setPage(next);
    fetchWorkspaces(search, activeCategory, next, false);
  }, [loading, hasMore, page, search, activeCategory, fetchWorkspaces]);

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
      <View style={styles.categoryRow}>
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
      </View>

      {/* Result count */}
      {!loading && total > 0 && (
        <Text style={styles.resultCount}>{total} doanh nghiệp</Text>
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
    margin: 16, paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: COLORS.surface, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text },
  categoryRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    paddingHorizontal: 16, paddingBottom: 12,
  },
  catChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.border,
  },
  catChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catText: { fontSize: 12, fontWeight: '600', color: COLORS.text },
  catTextActive: { color: '#fff' },
  resultCount: { fontSize: 12, color: COLORS.textSecondary, paddingHorizontal: 16, marginBottom: 8 },
  list: { padding: 16, gap: 12, paddingTop: 0 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.surface, borderRadius: 16, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  cardLeft: {},
  logo: { width: 52, height: 52, borderRadius: 12 },
  logoPlaceholder: {
    width: 52, height: 52, borderRadius: 12,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
  },
  logoText: { fontSize: 22, fontWeight: '700', color: '#fff' },
  cardBody: { flex: 1, gap: 3 },
  cardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardName: { fontSize: 15, fontWeight: '700', color: COLORS.primary, flex: 1 },
  verified: { fontSize: 13, color: '#3B82F6', fontWeight: '700' },
  cardIndustry: { fontSize: 12, color: COLORS.textSecondary },
  cardArea: { fontSize: 12, color: COLORS.textSecondary },
  cardDesc: { fontSize: 12, color: COLORS.text, marginTop: 2 },
  cardArrow: { fontSize: 20, color: COLORS.textSecondary },
  empty: { alignItems: 'center', gap: 8, paddingTop: 60 },
  emptyText: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  emptySubtext: { fontSize: 13, color: COLORS.textSecondary },
});
