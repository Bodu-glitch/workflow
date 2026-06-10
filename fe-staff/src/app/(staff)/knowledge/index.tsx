import { useState } from 'react';
import { ActivityIndicator, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { View, Text, Pressable, ScrollView, TextInput } from '@/tw';
import { knowledgeApi, type KnowledgeArticle } from '@/lib/api/knowledge';
import { ErrorView } from '@/components/ui/ErrorView';

export default function KnowledgeListScreen() {
  const [search, setSearch] = useState('');
  const [activeQ, setActiveQ] = useState('');

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['knowledge', activeQ],
    queryFn: () => knowledgeApi.search(activeQ || undefined),
    select: (d) => d.data,
  });

  const handleSearch = () => setActiveQ(search.trim());

  const articles = data ?? [];

  return (
    <View className="flex-1 bg-surface">
      {/* Header */}
      <View className="glass-effect px-5 pt-14 pb-4">
        <View className="flex-row items-center gap-3 mb-3">
          <Pressable onPress={() => router.back()} className="active:opacity-60">
            <Text className="text-primary font-semibold">← Quay lại</Text>
          </Pressable>
          <Text className="text-2xl font-extrabold text-on-surface tracking-tight">Thư viện kỹ thuật</Text>
        </View>

        {/* Search bar */}
        <View className="flex-row gap-2">
          <TextInput
            className="flex-1 bg-surface-container-high rounded-xl px-4 py-3 text-sm text-on-surface"
            placeholder="🔍  Tìm kiếm bài viết..."
            placeholderTextColor="#737685"
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <Pressable
            onPress={handleSearch}
            className="bg-primary px-4 rounded-xl items-center justify-center active:opacity-70"
          >
            <Text className="text-white font-bold text-sm">Tìm</Text>
          </Pressable>
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#1E40AF" />
        </View>
      ) : isError ? (
        <ErrorView onRetry={refetch} />
      ) : (
        <ScrollView
          className="flex-1 px-4 pt-4"
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        >
          {articles.length === 0 ? (
            <View className="items-center justify-center py-20 gap-3">
              <Text className="text-4xl">📚</Text>
              <Text className="text-sm text-on-surface-variant">
                {activeQ ? `Không tìm thấy kết quả cho "${activeQ}"` : 'Thư viện trống'}
              </Text>
              {activeQ && (
                <Pressable onPress={() => { setSearch(''); setActiveQ(''); }} className="active:opacity-70">
                  <Text className="text-sm text-primary font-semibold">Xem tất cả</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <>
              {activeQ && (
                <View className="mb-3">
                  <Text className="text-xs text-on-surface-variant">
                    {articles.length} kết quả cho "{activeQ}"
                    <Text
                      className="text-primary font-semibold"
                      onPress={() => { setSearch(''); setActiveQ(''); }}
                    > · Xóa bộ lọc</Text>
                  </Text>
                </View>
              )}
              {articles.map((article) => (
                <Pressable
                  key={article.id}
                  onPress={() => router.push({ pathname: '/(staff)/knowledge/[id]', params: { id: article.id } })}
                  className="bg-surface-container-lowest rounded-xl p-4 mb-3 active:opacity-80"
                >
                  <View className="flex-row items-start gap-3">
                    <View className="w-10 h-10 bg-primary/10 rounded-xl items-center justify-center">
                      <Text className="text-xl">📄</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-bold text-on-surface mb-1" numberOfLines={2}>
                        {article.title}
                      </Text>
                      {article.category && (
                        <View className="flex-row items-center gap-1 mb-2">
                          <View className="bg-primary/10 px-2 py-0.5 rounded-full">
                            <Text className="text-xs font-semibold text-primary">{article.category.name}</Text>
                          </View>
                          {article.tenant && (
                            <View className="bg-surface-container-high px-2 py-0.5 rounded-full">
                              <Text className="text-xs text-on-surface-variant">{article.tenant.name}</Text>
                            </View>
                          )}
                        </View>
                      )}
                      {article.tags && article.tags.length > 0 && (
                        <View className="flex-row flex-wrap gap-1">
                          {article.tags.slice(0, 3).map((tag) => (
                            <View key={tag} className="bg-surface-container-high px-2 py-0.5 rounded-full">
                              <Text className="text-xs text-on-surface-variant">#{tag}</Text>
                            </View>
                          ))}
                          {article.tags.length > 3 && (
                            <Text className="text-xs text-on-surface-variant">+{article.tags.length - 3}</Text>
                          )}
                        </View>
                      )}
                    </View>
                    <Text className="text-on-surface-variant text-lg">›</Text>
                  </View>
                </Pressable>
              ))}
            </>
          )}
          <View className="h-8" />
        </ScrollView>
      )}
    </View>
  );
}
