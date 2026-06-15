import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { COLORS } from '../constants/config';

interface Props {
  photos: string[];
  onAdd: (uri: string) => void;
  onRemove: (uri: string) => void;
  maxPhotos?: number;
}

export function PhotoUploader({ photos, onAdd, onRemove, maxPhotos = 5 }: Props) {

  const launchLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8 });
    if (!result.canceled && result.assets[0]) onAdd(result.assets[0].uri);
  };

  const launchCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Quyền bị từ chối', 'Cần cấp quyền camera để chụp ảnh');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.8 });
    if (!result.canceled && result.assets[0]) onAdd(result.assets[0].uri);
  };

  const handleAdd = () => {
    if (photos.length >= maxPhotos) {
      Alert.alert('Tối đa', `Chỉ được tải tối đa ${maxPhotos} ảnh`);
      return;
    }
    if (Platform.OS === 'web') {
      launchLibrary();
      return;
    }
    Alert.alert('Thêm ảnh', 'Chọn từ đâu?', [
      { text: 'Chụp ảnh', onPress: launchCamera },
      { text: 'Thư viện ảnh', onPress: launchLibrary },
      { text: 'Hủy', style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
        {photos.map((uri) => (
          <View key={uri} style={styles.photoWrapper}>
            <Image source={{ uri }} style={styles.photo} />
            <TouchableOpacity style={styles.removeBtn} onPress={() => onRemove(uri)}>
              <Text style={styles.removeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
        {photos.length < maxPhotos && (
          <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
            <Text style={styles.addBtnIcon}>📷</Text>
            <Text style={styles.addBtnText}>Thêm ảnh</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      <Text style={styles.hint}>{photos.length}/{maxPhotos} ảnh</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  scroll: { flexDirection: 'row' },
  photoWrapper: { position: 'relative', marginRight: 10 },
  photo: { width: 90, height: 90, borderRadius: 10, backgroundColor: COLORS.border },
  removeBtn: {
    position: 'absolute', top: -6, right: -6,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.error, alignItems: 'center', justifyContent: 'center',
  },
  removeBtnText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  addBtn: {
    width: 90, height: 90, borderRadius: 10,
    borderWidth: 2, borderColor: COLORS.border, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
    gap: 4, backgroundColor: COLORS.surface,
  },
  addBtnIcon: { fontSize: 24 },
  addBtnText: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '500' },
  hint: { fontSize: 11, color: COLORS.textSecondary },
});
