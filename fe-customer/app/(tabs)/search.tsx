import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList,
  TouchableOpacity, ActivityIndicator, Image, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { api } from '../../lib/api';
import { COLORS, CATEGORY_ICONS } from '../../constants/config';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  description?: string;
  industry?: string;
  operating_area?: string;
  categories?: Array<{ id: string; name: string; slug: string }>;
  rating?: { avg: number | null; count: number };
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    // Load categories for filter
    api.get<Category[]>('/categories').then(setCategories).catch(console.warn);
    // Load initial list
    fetchTenants('');
  }, []);

  const fetchTenants = useCallback(async (q: string, categoryId?: string) => {
    setLoading(true);
    try {
      let path = `/customer/workspaces/search?limit=30`;
      if (q.trim()) path += `&q=${encodeURIComponent(q.trim())}`;
      if (categoryId) path += `&category_id=${categoryId}`;
      const result = await api.get<{ data: Tenant[] }>(path);
      setTenants((result as any).data ?? result);
      setSearched(true);
    } catch (e) {
      console.warn('Search error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = () => {
    fetchTenants(query, selectedCategory);
  };

  const handleCategoryFilter = (catId: string | undefined) => {
    setSelectedCategory(catId);
    fetchTenants(query, catId);
  };

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
          placeholder="Tìm kiếm dịch vụ, công ty..."
          placeholderTextColor={COLORS.textSecondary}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(''); fetchTenants('', selectedCategory); }}>
            <Text style={styles.clearBtn}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Category filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterContainer}
      >
        <TouchableOpacity
          style={[styles.filterChip, !selectedCategory && styles.filterChipActive]}
          onPress={() => handleCategoryFilter(undefined)}
        >
          <Text style={[styles.filterChipText, !selectedCategory && styles.filterChipTextActive]}>
            Tất cả
          </Text>
        </TouchableOpacity>
        {categories.map(cat => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.filterChip, selectedCategory === cat.id && styles.filterChipActive]}
            onPress={() => handleCategoryFilter(cat.id)}
          >
            <Text style={styles.filterChipIcon}>{CATEGORY_ICONS[cat.slug] ?? '🔧'}</Text>
            <Text style={[styles.filterChipText, selectedCategory === cat.id && styles.filterChipTextActive]}>
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Results */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={tenants}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            searched ? (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>🔍</Text>
                <Text style={styles.emptyTitle}>Không tìm thấy kết quả</Text>
                <Text style={styles.emptyText}>Thử từ khóa khác hoặc bỏ bộ lọc</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.tenantCard}
              onPress={() => router.push({ pathname: '/company/[id]', params: { id: item.id } })}
              activeOpacity={0.8}
            >
              <View style={styles.tenantHeader}>
                {item.logo_url ? (
                  <Image source={{ uri: item.logo_url }} style={styles.tenantLogo} />
                ) : (
                  <View style={styles.tenantLogoFallback}>
                    <Text style={styles.tenantLogoText}>{item.name.charAt(0)}</Text>
                  </View>
                )}
                <View style={styles.tenantInfo}>
                  <Text style={styles.tenantName} numberOfLines={1}>{item.name}</Text>
                  {item.industry && (
                    <Text style={styles.tenantIndustry}>{item.industry}</Text>
                  )}
                  {item.operating_area && (
                    <Text style={styles.tenantArea}>📍 {item.operating_area}</Text>
                  )}
                </View>
                <Text style={styles.chevron}>›</Text>
              </View>

              {/* Categories */}
              {item.categories && item.categories.length > 0 && (
                <View style={styles.categoryTags}>
                  {item.categories.slice(0, 3).map(cat => (
                    <View key={cat.id} style={styles.categoryTag}>
                      <Text style={styles.categoryTagText}>
                        {CATEGORY_ICONS[cat.slug] ?? '🔧'} {cat.name}
                      </Text>
                    </View>
                  ))}
                  {item.categories.length > 3 && (
                    <View style={styles.categoryTag}>
                      <Text style={styles.categoryTagText}>+{item.categories.length - 3}</Text>
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    margin: 16, marginBottom: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 14, paddingHorizontal: 14,
    borderWidth: 1, borderColor: COLORS.border,
    gap: 8,
  },
  searchIcon: { fontSize: 18 },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.text, paddingVertical: 12 },
  clearBtn: { fontSize: 16, color: COLORS.textSecondary, padding: 4 },
  filterContainer: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  filterChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '15' },
  filterChipIcon: { fontSize: 14 },
  filterChipText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  filterChipTextActive: { color: COLORS.primary, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, gap: 12 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  emptyText: { fontSize: 14, color: COLORS.textSecondary },
  tenantCard: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, gap: 12,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  tenantHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tenantLogo: { width: 52, height: 52, borderRadius: 12 },
  tenantLogoFallback: {
    width: 52, height: 52, borderRadius: 12,
    backgroundColor: COLORS.primary + '20',
    alignItems: 'center', justifyContent: 'center',
  },
  tenantLogoText: { fontSize: 22, fontWeight: '700', color: COLORS.primary },
  tenantInfo: { flex: 1, gap: 2 },
  tenantName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  tenantIndustry: { fontSize: 13, color: COLORS.textSecondary },
  tenantArea: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  chevron: { fontSize: 22, color: COLORS.textSecondary },
  categoryTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  categoryTag: {
    backgroundColor: COLORS.background, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  categoryTagText: { fontSize: 12, color: COLORS.textSecondary },
});
