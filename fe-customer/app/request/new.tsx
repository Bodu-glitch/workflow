import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
  FlatList,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { api } from '../../lib/api';
import { useLocation } from '../../hooks/useLocation';
import { CategoryPicker } from '../../components/CategoryPicker';
import { PhotoUploader } from '../../components/PhotoUploader';
import { DateTimePickerModal } from '../../components/DateTimePickerModal';
import { COLORS, CATEGORY_ICONS, CATEGORY_BG_COLORS, CATEGORY_PROBLEMS } from '../../constants/config';
import type { Category, ServiceRequest, MatchingTenant } from '../../types';

const STEPS = ['Dịch vụ', 'Vấn đề', 'Mô tả', 'Chọn doanh nghiệp'];
const FILTER_OPTIONS = ['Đề xuất', 'Gần nhất', 'Đánh giá cao', 'Chi phí thấp'];
const TIME_OPTIONS = ['Ngay bây giờ', 'Hôm nay', 'Đặt lịch'];

function formatPrice(min: number | null, max: number | null, fixed: number | null): string {
  if (fixed) return `${(fixed / 1000).toFixed(0)}k`;
  if (min && max) return `${(min / 1000).toFixed(0)}k – ${(max / 1000).toFixed(0)}k`;
  if (min) return `Từ ${(min / 1000).toFixed(0)}k`;
  if (max) return `Đến ${(max / 1000).toFixed(0)}k`;
  return 'Liên hệ';
}

function getPriceMin(t: MatchingTenant): number {
  return t.pricing.price_fixed ?? t.pricing.price_min ?? 0;
}

export default function NewRequestScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category_slug?: string }>();
  const { location, error: locationError } = useLocation();

  const [step, setStep] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedProblems, setSelectedProblems] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [isEmergency, setIsEmergency] = useState(false);
  const [timeOption, setTimeOption] = useState(0); // 0=now, 1=today, 2=scheduled
  const [scheduledDate, setScheduledDate] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'time' | 'datetime'>('time');
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [tenants, setTenants] = useState<MatchingTenant[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState(0);
  const [createdRequestId, setCreatedRequestId] = useState<string | null>(null);
  const [selectingTenant, setSelectingTenant] = useState(false);

  useEffect(() => { fetchCategories(); }, []);

  useEffect(() => {
    if (location && !locationCoords) {
      setLocationCoords({ lat: location.latitude, lng: location.longitude });
    } else if (locationError && !locationCoords) {
      // GPS unavailable — fall back to HCM City center so submission can proceed
      setLocationCoords({ lat: 10.8231, lng: 106.6297 });
    }
  }, [location, locationError]);

  async function fetchCategories() {
    try {
      const data = await api.get<Category[]>('/categories');
      setCategories(data);
      if (params.category_slug) {
        const found = data.find((c) => c.slug === params.category_slug);
        if (found) setSelectedCategoryId(found.id);
      }
    } catch { /* silent */ }
  }

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  const problemOptions = selectedCategory
    ? (CATEGORY_PROBLEMS[selectedCategory.slug] ?? ['Khác'])
    : [];

  function toggleProblem(p: string) {
    setSelectedProblems((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  }

  async function handleSubmitAndLoadTenants() {
    if (!locationCoords) {
      Alert.alert('Lỗi', 'Không thể lấy vị trí. Vui lòng thử lại.');
      return;
    }
    if (description.length < 10) {
      Alert.alert('Lỗi', 'Mô tả phải có ít nhất 10 ký tự.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      const fullDescription = selectedProblems.length > 0
        ? `[${selectedProblems.join(', ')}] ${description}`
        : description;
      formData.append('description', fullDescription);
      formData.append('location_lat', String(locationCoords.lat));
      formData.append('location_lng', String(locationCoords.lng));
      if (locationName) formData.append('location_name', locationName);
      if (selectedCategoryId) formData.append('category_id', selectedCategoryId);
      if (isEmergency) formData.append('is_emergency', 'true');
      if (scheduledDate && (timeOption === 1 || timeOption === 2)) {
        formData.append('scheduled_at', scheduledDate.toISOString());
      }

      for (const photoUri of photos) {
        const ext = photoUri.split('.').pop() ?? 'jpg';
        formData.append('photos', {
          uri: photoUri,
          name: `photo_${Date.now()}.${ext}`,
          type: `image/${ext}`,
        } as any);
      }

      const result = await api.postForm<ServiceRequest>('/requests', formData);
      setCreatedRequestId(result.id);

      // Fetch matching tenants
      setStep(3);
      setLoadingTenants(true);
      try {
        const res = await api.get<{ matches: MatchingTenant[] }>(
          `/requests/${result.id}/matching-tenants`,
        );
        setTenants(res?.matches ?? []);
      } catch {
        setTenants([]);
      } finally {
        setLoadingTenants(false);
      }
    } catch (e: any) {
      Alert.alert('Lỗi', e.message ?? 'Không thể tạo yêu cầu. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSelectTenant() {
    if (!selectedTenantId || !createdRequestId) return;
    setSelectingTenant(true);
    try {
      await api.selectTenant(createdRequestId, selectedTenantId);
      router.replace(`/request/success?id=${createdRequestId}`);
    } catch (e: any) {
      Alert.alert('Lỗi', e.message ?? 'Không thể chọn doanh nghiệp. Vui lòng thử lại.');
    } finally {
      setSelectingTenant(false);
    }
  }

  function getFilteredTenants(): MatchingTenant[] {
    const copy = [...tenants];
    switch (activeFilter) {
      case 1: // Gần nhất — keep insertion order (backend sorts by distance)
        return copy;
      case 2: // Đánh giá cao — no rating data from this endpoint, keep order
        return copy;
      case 3: // Chi phí thấp
        return copy.sort((a, b) => getPriceMin(a) - getPriceMin(b));
      default: // Đề xuất
        return copy;
    }
  }

  function canGoNext() {
    if (step === 0) return !!selectedCategoryId;
    if (step === 1) return true; // problem selection optional
    if (step === 2) return description.length >= 10;
    return false;
  }

  function renderStep() {
    switch (step) {
      case 0:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Chọn loại dịch vụ</Text>
            <Text style={styles.stepSubtitle}>Tìm dịch vụ phù hợp với sự cố của bạn</Text>
            {categories.length === 0 ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />
            ) : (
              <CategoryPicker
                categories={categories}
                selected={selectedCategoryId}
                onSelect={(id) => {
                  setSelectedCategoryId(id);
                  setSelectedProblems([]);
                }}
              />
            )}
          </View>
        );

      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Chọn vấn đề gặp phải</Text>
            <Text style={styles.stepSubtitle}>Chọn các vấn đề phù hợp (có thể chọn nhiều)</Text>
            <View style={styles.problemGrid}>
              {problemOptions.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.problemChip, selectedProblems.includes(p) && styles.problemChipActive]}
                  onPress={() => toggleProblem(p)}
                >
                  {selectedProblems.includes(p) && (
                    <Text style={styles.problemChipCheck}>✓ </Text>
                  )}
                  <Text style={[
                    styles.problemChipText,
                    selectedProblems.includes(p) && styles.problemChipTextActive,
                  ]}>
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {selectedProblems.length > 0 && (
              <Text style={styles.selectedCount}>
                Đã chọn: {selectedProblems.join(', ')}
              </Text>
            )}
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Mô tả vấn đề</Text>
            <Text style={styles.stepSubtitle}>Thợ sẽ chuẩn bị dụng cụ phù hợp</Text>

            <TextInput
              style={styles.textArea}
              multiline
              numberOfLines={5}
              placeholder="VD: Máy lạnh chạy nhưng không mát, bật khoảng 30 phút mới có gió lạnh yếu..."
              placeholderTextColor={COLORS.textSecondary}
              value={description}
              onChangeText={setDescription}
              textAlignVertical="top"
            />

            <PhotoUploader
              photos={photos}
              onAdd={(uri) => setPhotos((p) => [...p, uri])}
              onRemove={(uri) => setPhotos((p) => p.filter((x) => x !== uri))}
            />

            <Text style={styles.sectionLabel}>Thời gian</Text>
            <View style={styles.timeRow}>
              {TIME_OPTIONS.map((opt, i) => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.timeChip, timeOption === i && styles.timeChipActive]}
                  onPress={() => {
                    setTimeOption(i);
                    if (i === 0) { setScheduledDate(null); return; }
                    const d = new Date();
                    if (i === 1) { d.setHours(18, 0, 0, 0); setPickerMode('time'); }
                    else { d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); setPickerMode('datetime'); }
                    setScheduledDate(d);
                    setShowPicker(true);
                  }}
                >
                  <Text style={[styles.timeChipText, timeOption === i && styles.timeChipTextActive]}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {scheduledDate && timeOption > 0 && (
              <TouchableOpacity style={styles.scheduledDisplay} onPress={() => setShowPicker(true)}>
                <Text style={styles.scheduledDisplayText}>
                  🕐{' '}
                  {timeOption === 1
                    ? scheduledDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                    : scheduledDate.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </Text>
                <Text style={styles.scheduledEditHint}>Chạm để thay đổi</Text>
              </TouchableOpacity>
            )}

            <DateTimePickerModal
              visible={showPicker}
              mode={pickerMode}
              value={scheduledDate ?? new Date()}
              minimumDate={pickerMode === 'datetime' ? new Date() : undefined}
              onChange={(date) => setScheduledDate(date)}
              onClose={() => setShowPicker(false)}
            />

            <TouchableOpacity
              style={[styles.urgencyCard, isEmergency && styles.urgencyCardActive]}
              onPress={() => setIsEmergency((v) => !v)}
            >
              <View style={[styles.urgencyCheckbox, isEmergency && styles.urgencyCheckboxActive]}>
                {isEmergency && <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>✓</Text>}
              </View>
              <View style={styles.urgencyTexts}>
                <Text style={styles.urgencyTitle}>Ưu tiên khẩn cấp</Text>
                <Text style={styles.urgencyDesc}>Tìm thợ nhanh nhất, phụ phí 20k</Text>
              </View>
            </TouchableOpacity>

            {selectedCategory && (
              <View style={styles.costBox}>
                <Text style={styles.costLabel}>Ước tính chi phí</Text>
                <Text style={styles.costValue}>
                  {CATEGORY_PROBLEMS[selectedCategory.slug]
                    ? 'Phụ thuộc doanh nghiệp'
                    : '—'}
                </Text>
                <Text style={styles.costNote}>Đã bao gồm phí đi lại</Text>
              </View>
            )}

            <TextInput
              style={styles.locationInput}
              placeholder="Địa chỉ cụ thể (tùy chọn): Nhà, Công ty..."
              placeholderTextColor={COLORS.textSecondary}
              value={locationName}
              onChangeText={setLocationName}
            />
          </View>
        );

      case 3:
        return (
          <View style={{ flex: 1 }}>
            <View style={styles.businessHeader}>
              <Text style={styles.businessServiceLabel}>
                Dịch vụ: <Text style={{ color: COLORS.primary }}>{selectedCategory?.name}</Text>
              </Text>
              <Text style={styles.stepTitle}>Chọn doanh nghiệp</Text>
              <Text style={styles.stepSubtitle}>Được đánh giá tốt gần bạn</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingVertical: 8 }}>
              {FILTER_OPTIONS.map((f, i) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterChip, activeFilter === i && styles.filterChipActive]}
                  onPress={() => setActiveFilter(i)}
                >
                  <Text style={[styles.filterChipText, activeFilter === i && styles.filterChipTextActive]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {loadingTenants ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={COLORS.primary} size="large" />
                <Text style={styles.loadingText}>Đang tìm doanh nghiệp phù hợp...</Text>
              </View>
            ) : tenants.length === 0 ? (
              <View style={styles.loadingBox}>
                <Text style={{ fontSize: 40 }}>🔍</Text>
                <Text style={styles.loadingText}>Chưa có doanh nghiệp nào trong khu vực của bạn.</Text>
                <Text style={[styles.loadingText, { fontSize: 12, marginTop: 4 }]}>Yêu cầu đã được ghi nhận và sẽ được xử lý sớm.</Text>
                <TouchableOpacity
                  style={[styles.continueBtn, { marginTop: 16 }]}
                  onPress={() => router.replace(`/request/${createdRequestId}`)}
                >
                  <Text style={styles.continueBtnText}>Theo dõi yêu cầu</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={getFilteredTenants()}
                keyExtractor={(item) => item.tenant.id}
                contentContainerStyle={{ padding: 16, gap: 12 }}
                renderItem={({ item }) => {
                  const isSelected = selectedTenantId === item.tenant.id;
                  const priceStr = formatPrice(item.pricing.price_min, item.pricing.price_max, item.pricing.price_fixed);
                  const categoryIcon = selectedCategory ? (CATEGORY_ICONS[selectedCategory.slug] ?? '🔧') : '🔧';
                  const bgColor = selectedCategory ? (CATEGORY_BG_COLORS[selectedCategory.slug] ?? '#F3F4F6') : '#F3F4F6';
                  const eta = item.pricing.estimated_duration_minutes
                    ? `${item.pricing.estimated_duration_minutes} phút`
                    : null;
                  const isPriceMin = activeFilter === 3 && getFilteredTenants()[0]?.tenant.id === item.tenant.id;

                  return (
                    <TouchableOpacity
                      style={[styles.businessCard, isSelected && styles.businessCardSelected]}
                      onPress={() => setSelectedTenantId(item.tenant.id)}
                    >
                      <View style={styles.businessCardTop}>
                        <View style={[styles.businessIcon, { backgroundColor: bgColor }]}>
                          <Text style={{ fontSize: 28 }}>{categoryIcon}</Text>
                        </View>
                        <View style={styles.businessInfo}>
                          <View style={styles.businessNameRow}>
                            <Text style={styles.businessName}>{item.tenant.name}</Text>
                            <Text style={styles.verifiedBadge}>✓</Text>
                          </View>
                          <Text style={styles.businessServiceType}>{item.pricing.service_name}</Text>
                          <View style={styles.businessStatsRow}>
                            <Text style={styles.businessStats}>⭐ — · </Text>
                            {eta && <Text style={styles.businessEta}>{eta}</Text>}
                          </View>
                        </View>
                        {isSelected && (
                          <View style={styles.selectedCircle}>
                            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>✓</Text>
                          </View>
                        )}
                        {!isSelected && (isPriceMin ? (
                          <View style={styles.tagBadge}>
                            <Text style={styles.tagBadgeText}>Chi phí thấp</Text>
                          </View>
                        ) : null)}
                      </View>

                      <View style={styles.businessCardBottom}>
                        <Text style={styles.businessCompleted}>— việc đã hoàn thành</Text>
                        <Text style={[styles.businessPrice, isSelected && { color: COLORS.primary }]}>
                          Từ {priceStr}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        );
    }
  }

  const isStep3 = step === 3;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => step === 0 ? router.back() : setStep((s) => s - 1)}>
            <Text style={styles.backBtn}>← {step === 0 ? 'Hủy' : 'Quay lại'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{STEPS[step]}</Text>
          <Text style={styles.stepCounter}>{step + 1}/{STEPS.length}</Text>
        </View>

        {/* Progress */}
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${((step + 1) / STEPS.length) * 100}%` }]} />
        </View>

        {isStep3 ? (
          <View style={{ flex: 1 }}>
            {renderStep()}
          </View>
        ) : (
          <ScrollView style={styles.scrollArea} contentContainerStyle={{ paddingBottom: 20 }}>
            {renderStep()}
          </ScrollView>
        )}

        {/* Footer */}
        {step < 2 && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.nextBtn, !canGoNext() && styles.disabled]}
              onPress={() => setStep((s) => s + 1)}
              disabled={!canGoNext()}
            >
              <Text style={styles.nextBtnText}>Tiếp theo →</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 2 && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.submitBtn, (submitting || description.length < 10) && styles.disabled]}
              onPress={handleSubmitAndLoadTenants}
              disabled={submitting || description.length < 10}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>✓ Gửi yêu cầu</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {step === 3 && tenants.length > 0 && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.nextBtn, (!selectedTenantId || selectingTenant) && styles.disabled]}
              onPress={handleSelectTenant}
              disabled={!selectedTenantId || selectingTenant}
            >
              {selectingTenant ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.nextBtnText}>Tiếp tục →</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: COLORS.surface,
  },
  backBtn: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  stepCounter: { fontSize: 13, color: COLORS.textSecondary },
  progressBar: { height: 3, backgroundColor: COLORS.border },
  progressFill: { height: 3, backgroundColor: COLORS.primary },
  scrollArea: { flex: 1 },
  stepContent: { padding: 20, gap: 16 },
  stepTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  stepSubtitle: { fontSize: 13, color: COLORS.textSecondary, marginTop: -8 },

  // Step 1 — problems
  problemGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  problemChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  problemChipActive: {
    backgroundColor: COLORS.primary + '15',
    borderColor: COLORS.primary,
  },
  problemChipCheck: { fontSize: 12, color: COLORS.primary, fontWeight: '700' },
  problemChipText: { fontSize: 13, color: COLORS.text, fontWeight: '500' },
  problemChipTextActive: { color: COLORS.primary, fontWeight: '700' },
  selectedCount: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },

  // Step 2 — description
  textArea: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    color: COLORS.text,
    minHeight: 120,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  timeRow: { flexDirection: 'row', gap: 10 },
  timeChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  timeChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  timeChipText: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  timeChipTextActive: { color: '#fff' },
  scheduledInput: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  scheduledDisplay: {
    backgroundColor: COLORS.primaryLight + '15',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.primary + '40',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scheduledDisplayText: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  scheduledEditHint: { fontSize: 11, color: COLORS.textSecondary },
  urgencyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  urgencyCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '08' },
  urgencyCheckbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  urgencyCheckboxActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  urgencyTexts: { flex: 1 },
  urgencyTitle: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  urgencyDesc: { fontSize: 11, color: COLORS.textSecondary },
  costBox: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    gap: 4,
  },
  costLabel: { fontSize: 12, color: COLORS.textSecondary },
  costValue: { fontSize: 22, fontWeight: '800', color: COLORS.primary },
  costNote: { fontSize: 11, color: COLORS.textSecondary },
  locationInput: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  // Step 3 — business selection
  businessHeader: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4, gap: 4 },
  businessServiceLabel: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  filterRow: { flexGrow: 0 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipText: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  filterChipTextActive: { color: '#fff' },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  loadingText: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' },
  businessCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  businessCardSelected: {
    borderColor: COLORS.primary,
    borderWidth: 2,
  },
  businessCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    gap: 12,
  },
  businessIcon: {
    width: 56, height: 56,
    borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  businessInfo: { flex: 1, gap: 3 },
  businessNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  businessName: { fontSize: 15, fontWeight: '700', color: COLORS.primary, flex: 1 },
  verifiedBadge: { fontSize: 13, color: '#3B82F6', fontWeight: '700' },
  businessServiceType: { fontSize: 12, color: COLORS.textSecondary },
  businessStatsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  businessStats: { fontSize: 12, color: COLORS.text },
  businessEta: { fontSize: 12, color: COLORS.success, fontWeight: '600' },
  tagBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8,
  },
  tagBadgeText: { fontSize: 10, color: '#92400E', fontWeight: '700' },
  selectedCircle: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  businessCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  businessCompleted: { fontSize: 12, color: COLORS.textSecondary },
  businessPrice: { fontSize: 14, fontWeight: '700', color: COLORS.text },

  footer: {
    padding: 20, paddingBottom: 36,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  nextBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 50,
    padding: 16,
    alignItems: 'center',
  },
  nextBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  submitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 50,
    padding: 16,
    alignItems: 'center',
  },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  continueBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 50,
    paddingHorizontal: 28,
    paddingVertical: 14,
    alignItems: 'center',
  },
  continueBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  disabled: { opacity: 0.45 },
});
