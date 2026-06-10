import { ScrollView, RefreshControl, Dimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { View, Text, Pressable } from '@/tw';
import { Image } from '@/tw/image';
import { knowledgeApi } from '@/lib/api/knowledge';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorView } from '@/components/ui/ErrorView';

const { width } = Dimensions.get('window');

// Simple markdown renderer (no external dependency)
function renderMarkdown(content: string): React.ReactNode[] {
  const lines = content.split('\n');
  const nodes: React.ReactNode[] = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('# ')) {
      nodes.push(<Text key={key++} className="text-2xl font-extrabold text-on-surface mb-3 mt-2">{line.slice(2)}</Text>);
    } else if (line.startsWith('## ')) {
      nodes.push(<Text key={key++} className="text-xl font-bold text-on-surface mb-2 mt-4">{line.slice(3)}</Text>);
    } else if (line.startsWith('### ')) {
      nodes.push(<Text key={key++} className="text-base font-bold text-on-surface mb-2 mt-3">{line.slice(4)}</Text>);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      nodes.push(
        <View key={key++} className="flex-row items-start mb-1 ml-2">
          <Text className="text-on-surface-variant mr-2 mt-0.5">•</Text>
          <Text className="text-sm text-on-surface flex-1 leading-6">{line.slice(2)}</Text>
        </View>
      );
    } else if (/^\d+\. /.test(line)) {
      const num = line.match(/^(\d+)\. /)?.[1];
      nodes.push(
        <View key={key++} className="flex-row items-start mb-1 ml-2">
          <Text className="text-on-surface-variant mr-2 font-bold w-5">{num}.</Text>
          <Text className="text-sm text-on-surface flex-1 leading-6">{line.replace(/^\d+\. /, '')}</Text>
        </View>
      );
    } else if (line.startsWith('```')) {
      // collect code block
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      nodes.push(
        <View key={key++} className="bg-surface-container-highest rounded-xl p-4 mb-3">
          <Text className="font-mono text-xs text-on-surface-variant leading-5">
            {codeLines.join('\n')}
          </Text>
        </View>
      );
    } else if (line.startsWith('> ')) {
      nodes.push(
        <View key={key++} className="border-l-4 border-primary pl-3 mb-2">
          <Text className="text-sm text-on-surface-variant italic leading-6">{line.slice(2)}</Text>
        </View>
      );
    } else if (line.trim() === '') {
      nodes.push(<View key={key++} className="h-2" />);
    } else {
      // Bold/italic inline
      const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
      const inlineNodes = parts.map((part, pi) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <Text key={pi} className="font-bold text-on-surface">{part.slice(2, -2)}</Text>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return <Text key={pi} className="italic text-on-surface">{part.slice(1, -1)}</Text>;
        }
        return <Text key={pi} className="text-on-surface">{part}</Text>;
      });
      nodes.push(
        <Text key={key++} className="text-sm leading-6 text-on-surface mb-1">
          {inlineNodes}
        </Text>
      );
    }
  }
  return nodes;
}

export default function KnowledgeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['knowledge-article', id],
    queryFn: () => knowledgeApi.getArticle(id),
    select: (d) => d.data,
  });

  if (isLoading) return <LoadingScreen />;
  if (isError || !data) return <ErrorView onRetry={refetch} />;

  const article = data;

  return (
    <View className="flex-1 bg-surface">
      {/* Header */}
      <View className="glass-effect px-5 pt-14 pb-4">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} className="active:opacity-60">
            <Text className="text-primary font-semibold">← Quay lại</Text>
          </Pressable>
          <Text className="text-lg font-extrabold text-on-surface tracking-tight flex-1" numberOfLines={1}>
            {article.title}
          </Text>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {/* Meta */}
        <View className="px-5 pt-4 pb-2">
          {article.category && (
            <View className="flex-row items-center gap-2 mb-2">
              <View className="bg-primary/10 px-3 py-1 rounded-full">
                <Text className="text-xs font-bold text-primary">{article.category.name}</Text>
              </View>
              {article.tenant && (
                <Text className="text-xs text-on-surface-variant">by {article.tenant.name}</Text>
              )}
            </View>
          )}
          {article.tags && article.tags.length > 0 && (
            <View className="flex-row flex-wrap gap-1 mb-3">
              {article.tags.map((tag) => (
                <View key={tag} className="bg-surface-container-high px-2 py-1 rounded-full">
                  <Text className="text-xs text-on-surface-variant">#{tag}</Text>
                </View>
              ))}
            </View>
          )}
          <Text className="text-xs text-on-surface-variant mb-4">
            {new Date(article.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </Text>
        </View>

        {/* Content */}
        <View className="px-5 pb-4">
          {renderMarkdown(article.content)}
        </View>

        {/* Media */}
        {article.media_urls && article.media_urls.length > 0 && (
          <View className="px-5 pb-4">
            <Text className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-3">
              Hình ảnh minh họa
            </Text>
            {article.media_urls.map((url, idx) => (
              <View key={idx} className="rounded-xl overflow-hidden mb-3">
                <Image
                  source={{ uri: url }}
                  style={{ width: width - 40, height: (width - 40) * 0.6 }}
                  contentFit="cover"
                />
              </View>
            ))}
          </View>
        )}

        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
