import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, CATEGORY_ICONS } from '../constants/config';
import type { Category } from '../types';

interface Props {
  categories: Category[];
  selected: string | null;
  onSelect: (id: string) => void;
  /** Optional: render extra content inside each card (e.g., reference price) */
  renderExtra?: (cat: Category) => React.ReactNode;
}

export function CategoryPicker({ categories, selected, onSelect, renderExtra }: Props) {
  return (
    <View style={styles.grid}>
      {categories.map((cat) => {
        const isSelected = selected === cat.id;
        return (
          <TouchableOpacity
            key={cat.id}
            style={[styles.card, isSelected && styles.cardSelected]}
            onPress={() => onSelect(cat.id)}
          >
            <Text style={styles.icon}>{CATEGORY_ICONS[cat.slug] ?? '🔧'}</Text>
            <Text style={[styles.name, isSelected && styles.nameSelected]} numberOfLines={2}>
              {cat.name}
            </Text>
            {renderExtra ? renderExtra(cat) : null}
            {isSelected && <View style={styles.checkmark}><Text style={styles.checkmarkText}>✓</Text></View>}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    width: '30%',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '08',
  },
  icon: { fontSize: 30 },
  name: { fontSize: 11, color: COLORS.text, fontWeight: '500', textAlign: 'center' },
  nameSelected: { color: COLORS.primary, fontWeight: '700' },
  checkmark: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
