import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
  FlatList, Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { api } from '../../lib/api';
import { useLocation } from '../../hooks/useLocation';
import { CategoryPicker } from '../../components/CategoryPicker';
import { PhotoUploader } from '../../components/PhotoUploader';
import { DateTimePickerModal } from '../../components/DateTimePickerModal';
import {
  COLORS, CATEGORY_ICONS, CATEGORY_BG_COLORS, CATEGORY_PROBLEMS,
  CATEGORY_REFERENCE_PRICES,
} from '../../constants/config';
import type { Category, ServiceRequest, MatchingTenant } from '../../types';

const GOOGLE_PLACES_API_KEY = 'AIzaSyBKe-ICXblspXDmicSi0NVuQmdsZ3LS_w0';

const STEPS = ['Dịch vụ', 'Vấn đề', 'Mô tả & Địa chỉ', 'Chọn doanh nghiệp', 'Voucher'];
const FILTER_OPTIONS = ['Đề xuất', 'Gần nhất', 'Đánh giá cao', 'Chi phí thấp'];
const TIME_OPTIONS = ['Ngay bây giờ', 'Hôm nay', 'Đặt lịch'];

interface SavedAddress {
  id: string;
  label: string;
  address: string;
  lat?: number;
  lng?: number;
  is_default: boolean;
}

interface PlacePrediction {
  place_id: string;
  description: string;
}

interface Voucher {
  id: string;
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  max_discount?: number | null;
  min_order_value?: number | null;
  usage_limit?: number | null;
  usage_count: number;
  ends_at?: string | null;
  is_active: boolean;
  category?: { name: string } | null;
}

function formatPrice(min: number | null, max: number | null, fixed: number | null): string {
  if (fixed) return `${(fixed / 1000).toFixed(0)}k`;
  if (min && max) return `${(min / 1000).toFixed(0)}k – ${(max / 1000).toFixed(0)}k`;
  if (min) return `Từ ${(min / 1000).toFixed(0)}k`;
  if (max) return `Đến ${(max / 1000).toFixed(0)}k`;
  return 'Liên hệ';
}

function formatVnd(n: number) {
  return n.toLocaleString('vi-VN') + '₫';
}

function getPriceMin(t: MatchingTenant): number {
  return t.pricing.price_fixed ?? t.pricing.price_min ?? 0;
}

function calcVoucherDiscount(voucher: Voucher, basePrice: number): number {
  if (voucher.type === 'percent') {
    const d = Math.round(basePrice * voucher.value / 100);
    return voucher.max_discount ? Math.min(d, voucher.max_discount) : d;
  }
  return Math.min(voucher.value, basePrice);
}

export default function NewRequestScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category_slug?: string; tenant_id?: string }>();
  const { location, error: locationError } = useLocation();

  const [step, setStep] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedProblems, setSelectedProblems] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [isEmergency, setIsEmergency] = useState(false);
  const [timeOption, setTimeOption] = useState(0);
  const [scheduledDate, setScheduledDate] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'time' | 'datetime'>('time');

  // Address
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState('');

  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [placePredictions, setPlacePredictions] = useState<PlacePrediction[]>([]);
  const [addressSearch, setAddressSearch] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Business selection
  const [reverseGeocoding, setReverseGeocoding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tenants, setTenants] = useState<MatchingTenant[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState(0);
  const [createdRequestId, setCreatedRequestId] = useState<string | null>(null);
  const [selectingTenant, setSelectingTenant] = useState(false);
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherResult, setVoucherResult] = useState<{ voucher_id: string; code: string; name: string; discount_amount: number; final_amount: number } | null>(null);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [validatingVoucher, setValidatingVoucher] = useState(false);

  // Voucher
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loadingVouchers, setLoadingVouchers] = useState(false);
  const [selectedVoucherId, setSelectedVoucherId] = useState<string | null>(null);
  const [applyingVoucher, setApplyingVoucher] = useState(false);

  useEffect(() => { fetchCategories(); fetchSavedAddresses(); }, []);

  useEffect(() => {
    if (location && !locationCoords) {
      setLocationCoords({ lat: location.latitude, lng: location.longitude });
      reverseGeocode(location.latitude, location.longitude);
    } else if (locationError && !locationCoords) {
      setLocationCoords({ lat: 10.8231, lng: 106.6297 });
    }
  }, [location, locationError]);

  async function reverseGeocode(lat: number, lng: number) {
    setReverseGeocoding(true);
    try {
      if (Platform.OS === 'web') {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
          { headers: { 'Accept-Language': 'vi' } },
        );
        const json = await res.json();
        // Parse address object to avoid duplicate admin levels in display_name
        const a = json?.address ?? {};
        const strip = (s?: string) => s?.replace(/^(Thành phố|Quận|Huyện|Phường|Xã|Thị xã|Thị trấn)\s+/i, '').trim();
        const parts = [
          a.road,
          strip(a.suburb) || strip(a.quarter),
          strip(a.city ?? a.county ?? a.municipality),
        ].filter(Boolean);
        setLocationName(parts.length > 0 ? parts.join(', ') : (json?.display_name ?? ''));
        return;
      }
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (results.length > 0) {
        const addr = results[0];
        const parts = [addr.streetNumber, addr.street, addr.district, addr.subregion ?? addr.city].filter(Boolean);
        const formatted = parts.length > 0 ? parts.join(', ') : (addr.name ?? null);
        if (formatted) setLocationName(formatted);
      }
    } catch { /* silent */ } finally {
      setReverseGeocoding(false);
    }
  }

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

  async function fetchSavedAddresses() {
    try {
      const data = await api.get<SavedAddress[]>('/customer/addresses');
      setSavedAddresses(data);
    } catch { /* silent */ }
  }

  async function searchPlaces(input: string) {
    if (input.length < 2) { setPlacePredictions([]); return; }
    setSearchLoading(true);
    try {
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&language=vi&components=country:vn&key=${GOOGLE_PLACES_API_KEY}`;
      const res = await fetch(url);
      const json = await res.json();
      setPlacePredictions(json.predictions ?? []);
    } catch {
      setPlacePredictions([]);
    } finally {
      setSearchLoading(false);
    }
  }

  async function selectPlace(prediction: PlacePrediction) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?place_id=${prediction.place_id}&key=${GOOGLE_PLACES_API_KEY}`;
      const res = await fetch(url);
      const json = await res.json();
      const result = json.results?.[0];
      if (result) {
        const { lat, lng } = result.geometry.location;
        setLocationCoords({ lat, lng });
        setLocationName(result.formatted_address ?? prediction.description);
      } else {
        setLocationName(prediction.description);
      }
    } catch {
      setLocationName(prediction.description);
    }
    setPlacePredictions([]);
    setAddressSearch('');
    setShowAddressPicker(false);
  }

  function selectSavedAddress(addr: SavedAddress) {
    if (addr.lat && addr.lng) {
      setLocationCoords({ lat: addr.lat, lng: addr.lng });
    }
    setLocationName(addr.address);
    setPlacePredictions([]);
    setAddressSearch('');
    setShowAddressPicker(false);
  }

  function handleAddressSearchChange(text: string) {
    setAddressSearch(text);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => searchPlaces(text), 400);
  }

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  const problemOptions = selectedCategory
    ? (CATEGORY_PROBLEMS[selectedCategory.slug] ?? ['Khác'])
    : [];
  const refPrice = selectedCategory ? CATEGORY_REFERENCE_PRICES[selectedCategory.slug] : null;

  function toggleProblem(p: string) {
    setSelectedProblems((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  }

  async function handleSubmitAndLoadTenants() {
    if (!locationCoords) {
      Alert.alert('Lỗi', 'Vui lòng chọn địa chỉ để tiếp tục.');
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
        formData.append('photos', { uri: photoUri, name: `photo_${Date.now()}.${ext}`, type: `image/${ext}` } as any);
      }

      const result = await api.postForm<ServiceRequest>('/requests', formData);
      setCreatedRequestId(result.id);

      setStep(3);
      setLoadingTenants(true);
      try {
        const res = await api.get<{ matches: MatchingTenant[] }>(`/requests/${result.id}/matching-tenants`);
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


  async function handleConfirmTenantAndLoadVouchers() {
    if (!selectedTenantId || !createdRequestId) return;
    setSelectingTenant(true);
    try {
      await api.selectTenant(createdRequestId, selectedTenantId);
      // Load vouchers for selected tenant
      setStep(4);
      setLoadingVouchers(true);
      try {
        const res = await api.get<Voucher[]>(`/customer/tenants/${selectedTenantId}/vouchers`);
        const active = (res ?? []).filter(v => {
          if (!v.is_active) return false;
          if (v.ends_at && new Date(v.ends_at) < new Date()) return false;
          if (v.usage_limit != null && v.usage_count >= v.usage_limit) return false;
          return true;
        });
        setVouchers(active);
      } catch {
        setVouchers([]);
      } finally {
        setLoadingVouchers(false);
      }

  async function handleApplyVoucher() {
    if (!voucherCode.trim() || !selectedTenantId) return;
    const selectedTenant = tenants.find(t => t.tenant.id === selectedTenantId);
    const orderAmount = selectedTenant?.pricing.price_fixed ?? selectedTenant?.pricing.price_min ?? 0;
    setValidatingVoucher(true);
    setVoucherError(null);
    setVoucherResult(null);
    try {
      const res = await api.post<{ voucher_id: string; code: string; name: string; discount_amount: number; final_amount: number }>(
        '/vouchers/public/validate',
        { code: voucherCode.trim(), tenant_id: selectedTenantId, order_amount: orderAmount },
      );
      setVoucherResult(res);
    } catch (e: any) {
      setVoucherError(e.message ?? 'Mã giảm giá không hợp lệ');
    } finally {
      setValidatingVoucher(false);
    }
  }

  async function handleSelectTenant() {
    if (!selectedTenantId || !createdRequestId) return;
    setSelectingTenant(true);
    try {
      await api.post<{ message: string }>(`/requests/${createdRequestId}/select-tenant`, {
        tenant_id: selectedTenantId,
        ...(voucherResult ? { voucher_code: voucherResult.code, agreed_price: voucherResult.final_amount + voucherResult.discount_amount } : {}),
      });
      router.replace(`/request/success?id=${createdRequestId}`);
    } catch (e: any) {
      Alert.alert('Lỗi', e.message ?? 'Không thể chọn doanh nghiệp. Vui lòng thử lại.');
    } finally {
      setSelectingTenant(false);
    }
  }

  async function handleApplyVoucherAndFinish() {
    if (!createdRequestId) return;
    setApplyingVoucher(true);
    try {
      if (selectedVoucherId) {
        await api.post(`/requests/${createdRequestId}/apply-voucher`, { voucher_id: selectedVoucherId });
      }
      router.replace(`/request/success?id=${createdRequestId}`);
    } catch (e: any) {
      // Even if voucher application fails, navigate to tracking
      router.replace(`/request/success?id=${createdRequestId}`);
    } finally {
      setApplyingVoucher(false);
    }
  }

  function getFilteredTenants(): MatchingTenant[] {
    const copy = [...tenants];
    switch (activeFilter) {
      case 3: return copy.sort((a, b) => getPriceMin(a) - getPriceMin(b));
      default: return copy;
    }
  }

  function canGoNext() {
    if (step === 0) return !!selectedCategoryId;
    if (step === 1) return true;
    if (step === 2) return description.length >= 10 && !!locationCoords;
    return false;
  }

  // Base price from selected tenant for voucher discount calculation
  const selectedTenant = tenants.find(t => t.tenant.id === selectedTenantId);
  const basePrice = selectedTenant
    ? (selectedTenant.pricing.price_fixed ?? selectedTenant.pricing.price_min ?? 0)
    : 0;
  const selectedVoucher = vouchers.find(v => v.id === selectedVoucherId);
  const discountAmount = selectedVoucher && basePrice > 0
    ? calcVoucherDiscount(selectedVoucher, basePrice)
    : 0;
  const finalPrice = basePrice > 0 ? Math.max(0, basePrice - discountAmount) : 0;

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
                renderExtra={(cat) => {
                  const rp = CATEGORY_REFERENCE_PRICES[cat.slug];
                  if (!rp) return null;
                  return (
                    <Text style={styles.refPrice}>
                      {(rp.min / 1000).toFixed(0)}k – {(rp.max / 1000).toFixed(0)}k
                    </Text>
                  );
                }}
              />
            )}
            {refPrice && selectedCategory && (
              <View style={styles.refPriceBox}>
                <Text style={styles.refPriceLabel}>💰 Giá tham khảo thị trường</Text>
                <Text style={styles.refPriceValue}>
                  {formatVnd(refPrice.min)} – {formatVnd(refPrice.max)}
                </Text>
                <Text style={styles.refPriceNote}>{refPrice.note}</Text>
              </View>
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
              <Text style={styles.selectedCount}>Đã chọn: {selectedProblems.join(', ')}</Text>
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

            {/* Address Picker */}
            <Text style={styles.sectionLabel}>📍 Địa chỉ dịch vụ</Text>
            <TouchableOpacity
              style={[styles.addressBtn, locationName ? styles.addressBtnFilled : null]}
              onPress={() => setShowAddressPicker(true)}
            >
              <Text style={[styles.addressBtnText, !locationName && styles.addressBtnPlaceholder]}>
                {locationName || 'Chọn địa chỉ...'}
              </Text>
              <Text style={styles.addressBtnIcon}>📍</Text>
            </TouchableOpacity>

            {/* Time */}
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
                  <Text style={[styles.timeChipText, timeOption === i && styles.timeChipTextActive]}>{opt}</Text>
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

            {refPrice && (
              <View style={styles.costBox}>
                <Text style={styles.costLabel}>💰 Giá tham khảo thị trường</Text>
                <Text style={styles.costValue}>
                  {formatVnd(refPrice.min)} – {formatVnd(refPrice.max)}
                </Text>
                <Text style={styles.costNote}>{refPrice.note}. Giá thực tế do doanh nghiệp quyết định.</Text>
              </View>
            )}


            <View style={styles.locationRow}>
              <TextInput
                style={[styles.locationInput, { flex: 1 }]}
                placeholder="Địa chỉ của bạn..."
                placeholderTextColor={COLORS.textSecondary}
                value={locationName}
                onChangeText={setLocationName}
              />
              <TouchableOpacity
                style={styles.gpsBtn}
                onPress={() => {
                  if (location) reverseGeocode(location.latitude, location.longitude);
                }}
                disabled={reverseGeocoding || !location}
              >
                {reverseGeocoding
                  ? <ActivityIndicator size="small" color={COLORS.primary} />
                  : <Text style={styles.gpsBtnText}>📍</Text>
                }
              </TouchableOpacity>
            </View>
            {locationError && !locationCoords && (
              <Text style={styles.locationError}>⚠️ {locationError}</Text>
            )}
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
                        {isSelected ? (
                          <View style={styles.selectedCircle}>
                            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>✓</Text>
                          </View>
                        ) : (!isSelected && isPriceMin ? (
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

                      {/* View Profile button */}
                      <TouchableOpacity
                        style={styles.viewProfileBtn}
                        onPress={() => router.push({ pathname: '/company/[id]', params: { id: item.tenant.id } })}
                      >
                        <Text style={styles.viewProfileText}>👁 Xem profile & bảng giá</Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        );

      case 4:
        return (
          <View style={{ flex: 1 }}>
            <View style={styles.voucherHeader}>
              <Text style={styles.stepTitle}>Chọn voucher</Text>
              <Text style={styles.stepSubtitle}>
                {selectedTenant
                  ? `Voucher từ ${selectedTenant.tenant.name}`
                  : 'Voucher của doanh nghiệp'}
              </Text>

              {/* Price summary */}
              {basePrice > 0 && (
                <View style={styles.priceSummary}>
                  <View style={styles.priceSummaryRow}>
                    <Text style={styles.priceSummaryLabel}>Giá tham khảo:</Text>
                    <Text style={styles.priceSummaryValue}>{formatVnd(basePrice)}</Text>
                  </View>
                  {discountAmount > 0 && (
                    <View style={styles.priceSummaryRow}>
                      <Text style={[styles.priceSummaryLabel, { color: COLORS.success }]}>Giảm giá:</Text>
                      <Text style={[styles.priceSummaryValue, { color: COLORS.success }]}>-{formatVnd(discountAmount)}</Text>
                    </View>
                  )}
                  <View style={[styles.priceSummaryRow, styles.priceSummaryTotal]}>
                    <Text style={styles.priceSummaryTotalLabel}>Dự kiến thanh toán:</Text>
                    <Text style={styles.priceSummaryTotalValue}>{formatVnd(finalPrice || basePrice)}</Text>
                  </View>
                  <Text style={styles.priceNote}>* Giá thực tế có thể thay đổi sau khi thợ kiểm tra. Voucher vẫn được áp dụng.</Text>
                </View>
              )}
            </View>

            {loadingVouchers ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={COLORS.primary} size="large" />
                <Text style={styles.loadingText}>Đang tải voucher...</Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
                {/* Skip option */}
                <TouchableOpacity
                  style={[styles.voucherCard, !selectedVoucherId && styles.voucherCardSelected]}
                  onPress={() => setSelectedVoucherId(null)}
                >
                  <View style={styles.voucherCardLeft}>
                    <Text style={styles.voucherIcon}>🚫</Text>
                    <View>
                      <Text style={styles.voucherCode}>Không dùng voucher</Text>
                      <Text style={styles.voucherDesc}>Thanh toán giá gốc</Text>
                    </View>
                  </View>
                  {!selectedVoucherId && (
                    <View style={styles.voucherCheck}>
                      <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {vouchers.length === 0 ? (
                  <View style={styles.noVoucherBox}>
                    <Text style={{ fontSize: 36 }}>🎟️</Text>
                    <Text style={styles.loadingText}>Doanh nghiệp chưa có voucher nào</Text>
                  </View>
                ) : (
                  vouchers.map((v) => {
                    const isSelected = selectedVoucherId === v.id;
                    const valueDisplay = v.type === 'percent'
                      ? `Giảm ${v.value}%${v.max_discount ? ` (tối đa ${formatVnd(v.max_discount)})` : ''}`
                      : `Giảm ${formatVnd(v.value)}`;
                    const discount = basePrice > 0 ? calcVoucherDiscount(v, basePrice) : 0;

                    return (
                      <TouchableOpacity
                        key={v.id}
                        style={[styles.voucherCard, isSelected && styles.voucherCardSelected]}
                        onPress={() => setSelectedVoucherId(v.id)}
                      >
                        <View style={styles.voucherCardLeft}>
                          <View style={styles.voucherCodeBox}>
                            <Text style={styles.voucherCodeText}>{v.code}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.voucherValue}>{valueDisplay}</Text>
                            {v.min_order_value && v.min_order_value > 0 && (
                              <Text style={styles.voucherDesc}>Đơn tối thiểu {formatVnd(v.min_order_value)}</Text>
                            )}
                            {v.ends_at && (
                              <Text style={styles.voucherDesc}>HSD: {new Date(v.ends_at).toLocaleDateString('vi-VN')}</Text>
                            )}
                            {discount > 0 && (
                              <Text style={styles.voucherSaving}>Tiết kiệm {formatVnd(discount)}</Text>
                            )}
                          </View>
                        </View>
                        {isSelected && (
                          <View style={styles.voucherCheck}>
                            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>✓</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })
                )}
                <View style={{ height: 100 }} />
              </ScrollView>
            )}
          </View>
        );
    }
  }

  const isStep3 = step === 3;
  const isStep4 = step === 4;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => step === 0 ? (router.canGoBack() ? router.back() : router.replace('/(tabs)' as any)) : setStep((s) => s - 1)}>
            <Text style={styles.backBtn}>← {step === 0 ? 'Hủy' : 'Quay lại'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{STEPS[step]}</Text>
          <Text style={styles.stepCounter}>{step + 1}/{STEPS.length}</Text>
        </View>

        {/* Progress */}
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${((step + 1) / STEPS.length) * 100}%` }]} />
        </View>

        {(isStep3 || isStep4) ? (
          <View style={{ flex: 1 }}>
            {renderStep()}
          </View>
        ) : (
          <ScrollView style={styles.scrollArea} contentContainerStyle={{ paddingBottom: 20 }}>
            {renderStep()}
          </ScrollView>
        )}

        {/* Footers */}
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
              style={[styles.submitBtn, (submitting || !canGoNext()) && styles.disabled]}
              onPress={handleSubmitAndLoadTenants}
              disabled={submitting || !canGoNext()}
            >
              {submitting
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitBtnText}>✓ Gửi yêu cầu & tìm doanh nghiệp</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        {step === 3 && tenants.length > 0 && selectedTenantId && (
          <View style={styles.footer}>
            {/* Voucher code input */}
            <View style={styles.voucherRow}>
              <TextInput
                style={styles.voucherInput}
                placeholder="Nhập mã giảm giá..."
                placeholderTextColor={COLORS.textSecondary}
                value={voucherCode}
                onChangeText={(v) => { setVoucherCode(v.toUpperCase()); setVoucherResult(null); setVoucherError(null); }}
                autoCapitalize="characters"
              />
              <TouchableOpacity
                style={[styles.voucherBtn, (!voucherCode.trim() || validatingVoucher) && styles.disabled]}
                onPress={handleApplyVoucher}
                disabled={!voucherCode.trim() || validatingVoucher}
              >
                {validatingVoucher ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.voucherBtnText}>Áp dụng</Text>}
              </TouchableOpacity>
            </View>
            {voucherError && <Text style={styles.voucherError}>{voucherError}</Text>}
            {voucherResult && (
              <View style={styles.voucherSuccess}>
                <Text style={styles.voucherSuccessText}>🎟️ {voucherResult.name} — Giảm {voucherResult.discount_amount.toLocaleString('vi-VN')}₫</Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.nextBtn, (!selectedTenantId || selectingTenant) && styles.disabled]}
              onPress={handleConfirmTenantAndLoadVouchers}
              disabled={!selectedTenantId || selectingTenant}
            >
              {selectingTenant
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.nextBtnText}>Chọn doanh nghiệp này →</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        {step === 4 && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.nextBtn, applyingVoucher && styles.disabled]}
              onPress={handleApplyVoucherAndFinish}
              disabled={applyingVoucher}
            >
              {applyingVoucher
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.nextBtnText}>
                    {selectedVoucherId ? '🎟️ Xác nhận & áp dụng voucher' : '✓ Xác nhận yêu cầu'}
                  </Text>
              }
            </TouchableOpacity>
          </View>
        )}
        {step === 3 && tenants.length > 0 && !selectedTenantId && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.nextBtn, styles.disabled]}
              disabled
            >
              <Text style={styles.nextBtnText}>Chọn doanh nghiệp để tiếp tục</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Address Picker Modal */}
      <Modal visible={showAddressPicker} animationType="slide" onRequestClose={() => setShowAddressPicker(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAddressPicker(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Chọn địa chỉ</Text>
            <View style={{ width: 28 }} />
          </View>

          {/* Search Box */}
          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm kiếm địa chỉ..."
              placeholderTextColor={COLORS.textSecondary}
              value={addressSearch}
              onChangeText={handleAddressSearchChange}
              autoFocus
            />
            {searchLoading && <ActivityIndicator size="small" color={COLORS.primary} />}
          </View>

          <ScrollView style={{ flex: 1 }}>
            {/* GPS option */}
            {location && (
              <TouchableOpacity
                style={styles.addressOption}
                onPress={() => {
                  setLocationCoords({ lat: location.latitude, lng: location.longitude });
                  setLocationName('Vị trí hiện tại của tôi');
                  setShowAddressPicker(false);
                }}
              >
                <Text style={styles.addressOptionIcon}>📍</Text>
                <View>
                  <Text style={styles.addressOptionLabel}>Vị trí hiện tại của tôi</Text>
                  <Text style={styles.addressOptionSub}>Dùng GPS</Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Place predictions */}
            {placePredictions.length > 0 && (
              <>
                <Text style={styles.sectionDivider}>Kết quả tìm kiếm</Text>
                {placePredictions.map((pred) => (
                  <TouchableOpacity
                    key={pred.place_id}
                    style={styles.addressOption}
                    onPress={() => selectPlace(pred)}
                  >
                    <Text style={styles.addressOptionIcon}>🗺️</Text>
                    <Text style={styles.addressOptionLabel} numberOfLines={2}>{pred.description}</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {/* Saved addresses */}
            {savedAddresses.length > 0 && placePredictions.length === 0 && (
              <>
                <Text style={styles.sectionDivider}>Địa chỉ đã lưu</Text>
                {savedAddresses.map((addr) => (
                  <TouchableOpacity
                    key={addr.id}
                    style={styles.addressOption}
                    onPress={() => selectSavedAddress(addr)}
                  >
                    <Text style={styles.addressOptionIcon}>
                      {addr.label === 'Nhà' ? '🏠' : addr.label === 'Văn phòng' ? '🏢' : '📍'}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.addressOptionLabel}>{addr.label}</Text>
                        {addr.is_default && (
                          <View style={styles.defaultBadge}>
                            <Text style={styles.defaultBadgeText}>Mặc định</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.addressOptionSub} numberOfLines={1}>{addr.address}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12, backgroundColor: COLORS.surface,
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

  // Reference price in step 0
  refPrice: { fontSize: 11, color: COLORS.primary, fontWeight: '600', marginTop: 2 },
  refPriceBox: {
    backgroundColor: COLORS.primary + '10',
    borderRadius: 14, padding: 14, gap: 4,
    borderWidth: 1, borderColor: COLORS.primary + '30',
  },
  refPriceLabel: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  refPriceValue: { fontSize: 20, fontWeight: '800', color: COLORS.primary },
  refPriceNote: { fontSize: 11, color: COLORS.textSecondary },

  // Problems (step 1)
  problemGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  problemChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 24,
    backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.border,
  },
  problemChipActive: { backgroundColor: COLORS.primary + '15', borderColor: COLORS.primary },
  problemChipCheck: { fontSize: 12, color: COLORS.primary, fontWeight: '700' },
  problemChipText: { fontSize: 13, color: COLORS.text, fontWeight: '500' },
  problemChipTextActive: { color: COLORS.primary, fontWeight: '700' },
  selectedCount: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },

  // Step 2 — description
  textArea: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 14,
    fontSize: 14, color: COLORS.text, minHeight: 120, textAlignVertical: 'top',
    borderWidth: 1, borderColor: COLORS.border,
  },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text },

  // Address button
  addressBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 14,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  addressBtnFilled: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '08' },
  addressBtnText: { fontSize: 14, color: COLORS.text, flex: 1, marginRight: 8 },
  addressBtnPlaceholder: { color: COLORS.textSecondary },
  addressBtnIcon: { fontSize: 18 },

  // Time
  timeRow: { flexDirection: 'row', gap: 10 },
  timeChip: {
    flex: 1, paddingVertical: 10, borderRadius: 24,
    backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center',
  },
  timeChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  timeChipText: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  timeChipTextActive: { color: '#fff' },
  scheduledDisplay: {
    backgroundColor: COLORS.primary + '15', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.primary + '40',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  scheduledDisplayText: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  scheduledEditHint: { fontSize: 11, color: COLORS.textSecondary },
  urgencyCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14,
    backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.border,
  },
  urgencyCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '08' },
  urgencyCheckbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  urgencyCheckboxActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  urgencyTexts: { flex: 1 },
  urgencyTitle: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  urgencyDesc: { fontSize: 11, color: COLORS.textSecondary },
  costBox: {
    padding: 16, borderRadius: 14, borderWidth: 1.5,
    borderColor: COLORS.border, backgroundColor: COLORS.surface, gap: 4,
  },
  costLabel: { fontSize: 12, color: COLORS.textSecondary },
  costValue: { fontSize: 20, fontWeight: '800', color: COLORS.primary },
  costNote: { fontSize: 11, color: COLORS.textSecondary },

  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  locationInput: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  gpsBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gpsBtnText: { fontSize: 20 },
  locationError: { fontSize: 12, color: COLORS.error ?? '#EF4444', marginTop: -8 },

  // Step 3 — business
  businessHeader: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4, gap: 4 },
  businessServiceLabel: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  filterRow: { flexGrow: 0 },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 24,
    backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.border,
  },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipText: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  filterChipTextActive: { color: '#fff' },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  loadingText: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' },
  businessCard: {
    backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1.5, borderColor: COLORS.border,
    overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  businessCardSelected: { borderColor: COLORS.primary, borderWidth: 2 },
  businessCardTop: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 12 },
  businessIcon: { width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  businessInfo: { flex: 1, gap: 3 },
  businessNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  businessName: { fontSize: 15, fontWeight: '700', color: COLORS.primary, flex: 1 },
  verifiedBadge: { fontSize: 13, color: '#3B82F6', fontWeight: '700' },
  businessServiceType: { fontSize: 12, color: COLORS.textSecondary },
  businessStatsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  businessStats: { fontSize: 12, color: COLORS.text },
  businessEta: { fontSize: 12, color: COLORS.success, fontWeight: '600' },
  tagBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  tagBadgeText: { fontSize: 10, color: '#92400E', fontWeight: '700' },
  selectedCircle: { width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  businessCardBottom: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  businessCompleted: { fontSize: 12, color: COLORS.textSecondary },
  businessPrice: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  viewProfileBtn: {
    paddingVertical: 10, alignItems: 'center', justifyContent: 'center',
    borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.primary + '08',
  },
  viewProfileText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },

  // Step 4 — voucher
  voucherHeader: { padding: 20, gap: 4 },
  priceSummary: {
    marginTop: 12, backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, gap: 8,
    borderWidth: 1, borderColor: COLORS.border,
  },
  priceSummaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceSummaryLabel: { fontSize: 13, color: COLORS.textSecondary },
  priceSummaryValue: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  priceSummaryTotal: { paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 4 },
  priceSummaryTotalLabel: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  priceSummaryTotalValue: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  priceNote: { fontSize: 11, color: COLORS.textSecondary, lineHeight: 16 },
  noVoucherBox: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  voucherCard: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderColor: COLORS.border,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  voucherCardSelected: { borderColor: COLORS.primary, borderWidth: 2 },
  voucherCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  voucherIcon: { fontSize: 24 },
  voucherCodeBox: {
    backgroundColor: COLORS.primary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, minWidth: 60, alignItems: 'center',
  },
  voucherCodeText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  voucherCode: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  voucherValue: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  voucherDesc: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  voucherSaving: { fontSize: 12, color: COLORS.success, fontWeight: '700', marginTop: 4 },
  voucherCheck: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },

  // Address modal
  modalContainer: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20, backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  modalClose: { fontSize: 18, color: COLORS.text, fontWeight: '600', width: 28 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    margin: 16, backgroundColor: COLORS.surface, borderRadius: 12, padding: 12,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  searchIcon: { fontSize: 18 },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text },
  sectionDivider: {
    fontSize: 11, fontWeight: '700', color: COLORS.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5,
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4,
  },
  addressOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  addressOptionIcon: { fontSize: 22 },
  addressOptionLabel: { fontSize: 14, color: COLORS.text, fontWeight: '500' },
  addressOptionSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  defaultBadge: {
    backgroundColor: COLORS.primary + '20', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2,
  },
  defaultBadgeText: { fontSize: 11, color: COLORS.primary, fontWeight: '600' },

  // Footer
  footer: {
    padding: 20, paddingBottom: 36, backgroundColor: COLORS.surface,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  nextBtn: { backgroundColor: COLORS.primary, borderRadius: 50, padding: 16, alignItems: 'center' },
  nextBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  submitBtn: { backgroundColor: COLORS.primary, borderRadius: 50, padding: 16, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  continueBtn: { backgroundColor: COLORS.primary, borderRadius: 50, paddingHorizontal: 28, paddingVertical: 14, alignItems: 'center' },
  continueBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  disabled: { opacity: 0.45 },

  // Voucher
  voucherRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  voucherInput: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  voucherBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voucherBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  voucherError: { fontSize: 12, color: COLORS.error ?? '#EF4444', marginBottom: 8 },
  voucherSuccess: {
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  voucherSuccessText: { fontSize: 13, color: '#166534', fontWeight: '600' },
});
