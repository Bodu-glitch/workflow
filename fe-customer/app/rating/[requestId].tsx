import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView, Image, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, router } from 'expo-router';
import { useRequest } from '../../hooks/useRequest';
import { api } from '../../lib/api';
import { COLORS } from '../../constants/config';

const REPORT_REASONS = [
  'Nhân viên không đúng giờ',
  'Chất lượng dịch vụ kém',
  'Không giải quyết đúng vấn đề',
  'Thái độ không chuyên nghiệp',
  'Tính tiền sai',
  'Khác',
];

async function pickPhoto(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: any) => {
        const file = e.target?.files?.[0];
        if (file) resolve(URL.createObjectURL(file));
        else resolve(null);
      };
      input.click();
    });
  }
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Quyền bị từ chối', 'Cần cấp quyền thư viện ảnh');
    return null;
  }
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.75 });
  return res.canceled ? null : res.assets[0].uri;
}

async function uploadPhoto(uri: string, requestId: string): Promise<string> {
  const formData = new FormData();
  if (Platform.OS === 'web') {
    const blob = await fetch(uri).then(r => r.blob());
    formData.append('photo', blob, 'review.jpg');
  } else {
    formData.append('photo', { uri, type: 'image/jpeg', name: 'review.jpg' } as any);
  }
  const res = await api.postForm<{ url: string }>(`/requests/${requestId}/upload-review-photo`, formData);
  return res.url;
}

export default function RatingScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const { request } = useRequest(requestId ?? null);

  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handlePickPhoto = async () => {
    const uri = await pickPhoto();
    if (uri) setPhotoUri(uri);
  };

  const handleRemovePhoto = () => setPhotoUri(null);

  const handleSubmit = useCallback(async () => {
    if (score === 0) {
      Alert.alert('Thiếu đánh giá', 'Vui lòng chọn số sao trước khi gửi');
      return;
    }
    setSubmitting(true);
    try {
      let photo_url: string | undefined;
      if (photoUri) {
        setUploadingPhoto(true);
        photo_url = await uploadPhoto(photoUri, requestId as string);
        setUploadingPhoto(false);
      }
      await api.post(`/requests/${requestId}/rate`, {
        score,
        comment: comment.trim() || undefined,
        photo_url,
        report_reason: (showReport && reportReason) ? reportReason : undefined,
      });
      router.replace('/(tabs)');
    } catch (e: any) {
      setUploadingPhoto(false);
      Alert.alert('Lỗi', e.message);
    } finally {
      setSubmitting(false);
    }
  }, [requestId, score, comment, photoUri, showReport, reportReason]);

  const handleSkip = useCallback(() => router.replace('/(tabs)'), []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.checkmark}>✅</Text>
        <Text style={styles.title}>Yêu cầu hoàn thành!</Text>
        <Text style={styles.subtitle}>
          Hãy đánh giá kỹ thuật viên để giúp chúng tôi cải thiện chất lượng dịch vụ
        </Text>
      </View>

      {request?.staff && (
        <View style={styles.staffCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{request.staff.full_name.charAt(0).toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.staffName}>{request.staff.full_name}</Text>
            <Text style={styles.staffLabel}>Kỹ thuật viên</Text>
          </View>
        </View>
      )}

      {/* Star rating */}
      <View style={styles.starsSection}>
        <Text style={styles.starsLabel}>Bạn đánh giá dịch vụ thế nào?</Text>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((s) => (
            <TouchableOpacity key={s} onPress={() => setScore(s)} activeOpacity={0.7}>
              <Text style={[styles.star, s <= score && styles.starActive]}>★</Text>
            </TouchableOpacity>
          ))}
        </View>
        {score > 0 && (
          <Text style={styles.scoreLabel}>
            {score === 1 ? 'Rất tệ' : score === 2 ? 'Tệ' : score === 3 ? 'Bình thường' : score === 4 ? 'Tốt' : 'Xuất sắc'}
          </Text>
        )}
      </View>

      {/* Comment */}
      <View style={styles.commentSection}>
        <Text style={styles.commentLabel}>Nhận xét (không bắt buộc)</Text>
        <TextInput
          style={styles.commentInput}
          value={comment}
          onChangeText={setComment}
          placeholder="Chia sẻ trải nghiệm của bạn..."
          placeholderTextColor={COLORS.textSecondary}
          multiline
          numberOfLines={3}
          maxLength={500}
          textAlignVertical="top"
        />
        <Text style={styles.commentCount}>{comment.length}/500</Text>
      </View>

      {/* Photo attachment */}
      <View style={styles.photoSection}>
        <Text style={styles.commentLabel}>Đính kèm ảnh (không bắt buộc)</Text>
        {photoUri ? (
          <View style={styles.photoPreviewWrap}>
            <Image source={{ uri: photoUri }} style={styles.photoPreview} />
            <TouchableOpacity style={styles.removePhotoBtn} onPress={handleRemovePhoto}>
              <Text style={styles.removePhotoBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.addPhotoBtn} onPress={handlePickPhoto}>
            <Text style={styles.addPhotoIcon}>📷</Text>
            <Text style={styles.addPhotoText}>Thêm ảnh minh chứng</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Report problem */}
      <View style={styles.reportSection}>
        <TouchableOpacity
          style={[styles.reportToggle, showReport && styles.reportToggleActive]}
          onPress={() => setShowReport(v => !v)}
        >
          <Text style={[styles.reportToggleText, showReport && styles.reportToggleTextActive]}>
            {showReport ? '✕ Hủy báo cáo' : '⚠️ Báo cáo vấn đề'}
          </Text>
        </TouchableOpacity>

        {showReport && (
          <View style={styles.reportForm}>
            <Text style={styles.reportFormLabel}>Chọn lý do:</Text>
            {REPORT_REASONS.map(reason => (
              <TouchableOpacity
                key={reason}
                style={[styles.reasonChip, reportReason === reason && styles.reasonChipActive]}
                onPress={() => setReportReason(reason)}
              >
                <Text style={[styles.reasonChipText, reportReason === reason && styles.reasonChipTextActive]}>
                  {reason}
                </Text>
              </TouchableOpacity>
            ))}
            <Text style={[styles.reportFormLabel, { marginTop: 10 }]}>Mô tả thêm (không bắt buộc):</Text>
            <TextInput
              style={styles.reportInput}
              value={comment}
              onChangeText={setComment}
              placeholder="Mô tả chi tiết vấn đề..."
              placeholderTextColor={COLORS.textSecondary}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.submitBtn, (score === 0 || submitting) && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={score === 0 || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : uploadingPhoto ? (
            <Text style={styles.submitBtnText}>Đang tải ảnh...</Text>
          ) : (
            <Text style={styles.submitBtnText}>
              {showReport && reportReason ? 'Gửi đánh giá & báo cáo' : 'Gửi đánh giá'}
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
          <Text style={styles.skipBtnText}>Bỏ qua</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 24, gap: 20, paddingBottom: 48 },
  header: { alignItems: 'center', gap: 10, paddingTop: 20 },
  checkmark: { fontSize: 56 },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, paddingHorizontal: 12 },
  staffCard: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.primary + '20', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 22, fontWeight: '700', color: COLORS.primary },
  staffName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  staffLabel: { fontSize: 12, color: COLORS.textSecondary },
  starsSection: { alignItems: 'center', gap: 12 },
  starsLabel: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  stars: { flexDirection: 'row', gap: 8 },
  star: { fontSize: 44, color: COLORS.border },
  starActive: { color: COLORS.rating ?? '#f59e0b' },
  scoreLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  commentSection: { gap: 6 },
  commentLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  commentInput: { backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: 14, fontSize: 14, color: COLORS.text, minHeight: 80 },
  commentCount: { fontSize: 11, color: COLORS.textSecondary, alignSelf: 'flex-end' },
  photoSection: { gap: 8 },
  photoPreviewWrap: { position: 'relative', alignSelf: 'flex-start' },
  photoPreview: { width: 120, height: 120, borderRadius: 12 },
  removePhotoBtn: { position: 'absolute', top: -8, right: -8, width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.error, alignItems: 'center', justifyContent: 'center' },
  removePhotoBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  addPhotoBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border, borderStyle: 'dashed', backgroundColor: COLORS.surface, alignSelf: 'flex-start' },
  addPhotoIcon: { fontSize: 20 },
  addPhotoText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  reportSection: { gap: 8 },
  reportToggle: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.border, alignSelf: 'flex-start', backgroundColor: COLORS.surface },
  reportToggleActive: { borderColor: COLORS.error, backgroundColor: COLORS.error + '10' },
  reportToggleText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  reportToggleTextActive: { color: COLORS.error },
  reportForm: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, gap: 6 },
  reportFormLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  reasonChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.background, alignSelf: 'flex-start', marginBottom: 4 },
  reasonChipActive: { borderColor: COLORS.error, backgroundColor: COLORS.error + '15' },
  reasonChipText: { fontSize: 12, fontWeight: '600', color: COLORS.text },
  reasonChipTextActive: { color: COLORS.error },
  reportInput: { backgroundColor: COLORS.background, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, padding: 12, fontSize: 13, color: COLORS.text, minHeight: 72 },
  actions: { gap: 12 },
  submitBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnDisabled: { opacity: 0.4 },
  skipBtn: { paddingVertical: 12, alignItems: 'center' },
  skipBtnText: { fontSize: 14, color: COLORS.textSecondary },
});
