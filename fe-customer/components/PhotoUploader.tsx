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
  const handleFileChange = (e: any) => {
    const file = e.target.files?.[0];
    if (file) onAdd(URL.createObjectURL(file));
    e.target.value = '';
  };

  if (Platform.OS === 'web') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 } as any}>
        <div style={{ display: 'flex', flexDirection: 'row', gap: 10, overflowX: 'auto' } as any}>
          {photos.map((uri) => (
            <div key={uri} style={{ position: 'relative', flexShrink: 0 } as any}>
              <img
                src={uri}
                alt=""
                style={{ width: 90, height: 90, borderRadius: 10, objectFit: 'cover', display: 'block' } as any}
              />
              <button
                onClick={() => onRemove(uri)}
                style={{
                  position: 'absolute', top: -6, right: -6,
                  width: 22, height: 22, borderRadius: 11,
                  backgroundColor: COLORS.error, border: 'none',
                  color: '#fff', fontSize: 10, fontWeight: '700',
                  cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                } as any}
              >✕</button>
            </div>
          ))}
          {photos.length < maxPhotos && (
            // Overlay technique: transparent <input type="file"> sits on top of the
            // visible button. User clicks directly on the input → always a trusted
            // event → browser opens file dialog. No JS .click() or label needed.
            <div style={{ position: 'relative', width: 90, height: 90, flexShrink: 0 } as any}>
              <div style={{
                width: 90, height: 90, borderRadius: 10,
                border: `2px dashed ${COLORS.border}`,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 4, backgroundColor: COLORS.surface,
              } as any}>
                <span style={{ fontSize: 24 }}>📷</span>
                <span style={{ fontSize: 10, color: COLORS.textSecondary, fontWeight: '500' }}>Thêm ảnh</span>
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{
                  position: 'absolute', top: 0, left: 0,
                  width: '100%', height: '100%',
                  opacity: 0, cursor: 'pointer',
                } as any}
              />
            </div>
          )}
        </div>
        <span style={{ fontSize: 11, color: COLORS.textSecondary } as any}>
          {photos.length}/{maxPhotos} ảnh
        </span>
      </div>
    );
  }

  const launchCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Quyền bị từ chối', 'Cần cấp quyền camera để chụp ảnh');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.8 });
    if (!res.canceled) onAdd(res.assets[0].uri);
  };

  const launchLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Quyền bị từ chối', 'Cần cấp quyền thư viện ảnh');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8 });
    if (!res.canceled) onAdd(res.assets[0].uri);
  };

  const pickImage = () => {
    if (photos.length >= maxPhotos) {
      Alert.alert('Tối đa', `Chỉ được tải tối đa ${maxPhotos} ảnh`);
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
          <TouchableOpacity style={styles.addBtn} onPress={pickImage}>
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
