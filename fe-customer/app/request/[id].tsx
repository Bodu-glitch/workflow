import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';

function confirm(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n${message}`)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: 'Không', style: 'cancel' },
      { text: title, style: 'destructive', onPress: onConfirm },
    ]);
  }
}
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useLocalSearchParams, router } from 'expo-router';
import { useRequest } from '../../hooks/useRequest';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../hooks/useSocket';
import { StatusBadge } from '../../components/StatusBadge';
import { api } from '../../lib/api';
import { COLORS, STATUS_LABELS, STATUS_COLORS } from '../../constants/config';
import type { RequestStatus } from '../../types';

const CANCELLABLE: RequestStatus[] = ['unavailable', 'available', 'pending_assignment'];
const RELEASABLE: RequestStatus[] = [];
// includes task statuses (moving/arrived) so the live map shows during the whole job
const TRACKING_ACTIVE: string[] = ['assigned', 'moving', 'arrived', 'in_progress'];

function formatEta(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.round(seconds / 60);
  return mins < 60 ? `${mins} phút` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, token } = useAuth();
  const { request, setRequest, loading, error } = useRequest(id ?? null);
  const { joinRequestRoom, onLocationUpdate, onStatusChange, onRequote } = useSocket(token);

  const mapRef = useRef<MapView>(null);
  const [staffLocation, setStaffLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null);
  const [requoteModal, setRequoteModal] = useState<{ price: number; reason: string } | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [confirmingPrice, setConfirmingPrice] = useState(false);

  // Join socket room and subscribe to real-time events
  useEffect(() => {
    if (!id) return;
    joinRequestRoom(id);

    const offLocation = onLocationUpdate((data) => {
      if (data.requestId !== id) return;
      setStaffLocation({ lat: data.lat, lng: data.lng });
      if (data.etaSeconds != null) setEtaSeconds(data.etaSeconds);
      mapRef.current?.animateToRegion(
        { latitude: data.lat, longitude: data.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 },
        300,
      );
    });

    const offStatus = onStatusChange((data) => {
      if (data.requestId !== id) return;
      setRequest((prev) => prev ? { ...prev, status: data.status as RequestStatus } : prev);
      // 'done' = task completed by staff; 'completed'/'completed_late' = service_request flow
      if (data.status === 'completed' || data.status === 'completed_late' || data.status === 'done') {
        router.replace(`/rating/${id}`);
      }
    });

    const offRequote = onRequote((data) => {
      if (data.requestId !== id) return;
      setRequoteModal({ price: data.requotePrice, reason: data.reason });
    });

    return () => {
      offLocation();
      offStatus();
      offRequote();
    };
  // token is included so the effect re-runs once the socket actually connects
  // (socketRef is null on first render when auth is still loading)
  }, [id, token, joinRequestRoom, onLocationUpdate, onStatusChange, onRequote, setRequest]);

  // Seed displayed status from linked task on load (request.status stays
  // pending_assignment after task creation — the live task status comes via socket)
  useEffect(() => {
    const linkedTaskStatus = (request as any)?.task?.status;
    if (linkedTaskStatus && linkedTaskStatus !== 'todo') {
      setRequest((prev: any) => (prev && prev.status !== linkedTaskStatus ? { ...prev, status: linkedTaskStatus } : prev));
    }
  }, [(request as any)?.task?.status, setRequest]);

  const handleCancel = useCallback(() => {
    confirm('Hủy yêu cầu', 'Bạn có chắc muốn hủy yêu cầu này?', async () => {
      setCancelling(true);
      try {
        await api.patch(`/requests/${id}/cancel`, { reason: 'Khách hàng hủy' });
        setRequest((prev) => prev ? { ...prev, status: 'cancelled' } : prev);
        Alert.alert('Đã hủy', 'Yêu cầu của bạn đã được hủy thành công.');
      } catch (e: any) {
        Alert.alert('Lỗi', e.message);
      } finally {
        setCancelling(false);
      }
    });
  }, [id, setRequest]);

  const handleRelease = useCallback(() => {
    confirm('Trả yêu cầu về pool', 'Bạn muốn tìm nhà cung cấp khác?', async () => {
      setReleasing(true);
      try {
        await api.patch(`/requests/${id}/release`);
        setRequest((prev) => prev ? { ...prev, status: 'available', tenant_id: null } : prev);
      } catch (e: any) {
        Alert.alert('Lỗi', e.message);
      } finally {
        setReleasing(false);
      }
    });
  }, [id, setRequest]);

  const handleAcceptRequote = useCallback(async () => {
    if (!requoteModal) return;
    setConfirmingPrice(true);
    try {
      await api.patch(`/requests/${id}/confirm-price`, { agreed_price: requoteModal.price });
      setRequest((prev) => prev ? { ...prev, agreed_price: requoteModal.price } : prev);
      setRequoteModal(null);
    } catch (e: any) {
      Alert.alert('Lỗi', e.message);
    } finally {
      setConfirmingPrice(false);
    }
  }, [id, requoteModal, setRequest]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  if (error || !request) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? 'Không tìm thấy yêu cầu'}</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const showMap = TRACKING_ACTIVE.includes(request.status) || staffLocation != null;
  const canCancel = CANCELLABLE.includes(request.status);
  const canRelease = RELEASABLE.includes(request.status);
  const canPay = request.status === 'in_progress' || request.status === 'assigned';
  const customerCoord = { latitude: request.location_lat, longitude: request.location_lng };

  return (
    <View style={styles.container}>
      {/* Map */}
      {showMap && (
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={{
            ...customerCoord,
            latitudeDelta: 0.04,
            longitudeDelta: 0.04,
          }}
        >
          <Marker coordinate={customerCoord} title="Vị trí của bạn" pinColor={COLORS.primary} />
          {staffLocation && (
            <>
              <Marker
                coordinate={{ latitude: staffLocation.lat, longitude: staffLocation.lng }}
                title={request.staff?.full_name ?? 'Kỹ thuật viên'}
                pinColor={COLORS.secondary}
              />
              <Polyline
                coordinates={[
                  { latitude: staffLocation.lat, longitude: staffLocation.lng },
                  customerCoord,
                ]}
                strokeColor={COLORS.primary}
                strokeWidth={2}
                lineDashPattern={[6, 4]}
              />
            </>
          )}
        </MapView>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Status row */}
        <View style={styles.statusRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <StatusBadge status={request.status} />
            <Text style={{ fontSize: 12, color: COLORS.textSecondary }}>
              {STATUS_LABELS[request.status] ?? request.status}
            </Text>
          </View>
          {etaSeconds != null && TRACKING_ACTIVE.includes(request.status) && (
            <View style={styles.etaBadge}>
              <Text style={styles.etaIcon}>🕐</Text>
              <Text style={styles.etaText}>{formatEta(etaSeconds)}</Text>
            </View>
          )}
        </View>

        {/* Category + description */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Loại sự cố</Text>
          <Text style={styles.cardValue}>{request.category?.name ?? '—'}</Text>
          <Text style={styles.cardLabel} numberOfLines={3}>
            {request.description}
          </Text>
        </View>

        {/* Staff info (when assigned/in-progress) */}
        {request.staff && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Kỹ thuật viên</Text>
            <View style={styles.staffRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {request.staff.full_name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.staffInfo}>
                <Text style={styles.staffName}>{request.staff.full_name}</Text>
                {request.staff.rating_avg != null && (
                  <Text style={styles.staffRating}>
                    ⭐ {request.staff.rating_avg.toFixed(1)} ({request.staff.rating_count ?? 0} đánh giá)
                  </Text>
                )}
                {request.staff.phone && (
                  <Text style={styles.staffPhone}>📞 {request.staff.phone}</Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Pricing */}
        {request.agreed_price != null && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Giá dịch vụ</Text>
            <Text style={styles.priceText}>
              {request.agreed_price.toLocaleString('vi-VN')}₫
            </Text>
            {request.collected_amount != null && (
              <View style={styles.collectedRow}>
                <Text style={styles.collectedIcon}>💰</Text>
                <Text style={styles.collectedText}>
                  Đã thu: {request.collected_amount.toLocaleString('vi-VN')}₫
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Bill — available after completion */}
        {['completed', 'completed_late', 'done'].includes(request.status) && (
          <TouchableOpacity
            style={styles.billBtn}
            onPress={() => router.push(`/request/${id}/bill` as any)}
          >
            <Text style={styles.billBtnText}>🧾 Xem hóa đơn & thanh toán</Text>
            <Text style={styles.billBtnArrow}>→</Text>
          </TouchableOpacity>
        )}

        {/* Location */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Địa điểm</Text>
          <Text style={styles.locationText}>
            {request.location_address ?? request.location_name ?? `${request.location_lat.toFixed(5)}, ${request.location_lng.toFixed(5)}`}
          </Text>
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          {request.status !== 'cancelled' && request.status !== 'completed' && request.status !== 'completed_late' && (
            <TouchableOpacity
              style={styles.chatBtn}
              onPress={() => router.push(`/request/${id}/chat` as any)}
            >
              <Text style={styles.chatBtnText}>💬 Chat</Text>
            </TouchableOpacity>
          )}
          {canRelease && (
            <TouchableOpacity
              style={[styles.releaseBtn, releasing && styles.btnDisabled]}
              onPress={handleRelease}
              disabled={releasing}
            >
              {releasing ? (
                <ActivityIndicator color={COLORS.warning} />
              ) : (
                <Text style={styles.releaseBtnText}>🔄 Tìm nhà cung cấp khác</Text>
              )}
            </TouchableOpacity>
          )}
          {canPay && (
            <TouchableOpacity
              style={styles.paymentBtn}
              onPress={() => router.push({ pathname: '/request/[id]/payment', params: { id } })}
            >
              <Text style={styles.paymentBtnText}>💳 Xem thông tin thanh toán</Text>
            </TouchableOpacity>
          )}
          {canCancel && (
            <TouchableOpacity
              style={[styles.cancelBtn, cancelling && styles.btnDisabled]}
              onPress={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? (
                <ActivityIndicator color={COLORS.error} />
              ) : (
                <Text style={styles.cancelBtnText}>Hủy yêu cầu</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Requote modal */}
      <Modal visible={requoteModal != null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Báo giá mới</Text>
            <Text style={styles.modalReason}>{requoteModal?.reason}</Text>
            <Text style={styles.modalPrice}>
              {requoteModal?.price.toLocaleString('vi-VN')}₫
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalRejectBtn}
                onPress={() => setRequoteModal(null)}
              >
                <Text style={styles.modalRejectText}>Từ chối</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalAcceptBtn, confirmingPrice && styles.btnDisabled]}
                onPress={handleAcceptRequote}
                disabled={confirmingPrice}
              >
                {confirmingPrice ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalAcceptText}>Chấp nhận</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 14, color: COLORS.textSecondary },
  backBtn: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: COLORS.primary, borderRadius: 8 },
  backBtnText: { color: '#fff', fontWeight: '600' },
  map: { width: '100%', height: 260 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12, paddingBottom: 40 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  etaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primaryLight + '20',
    borderColor: COLORS.primaryLight + '50',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  etaIcon: { fontSize: 14 },
  etaText: { fontSize: 13, color: COLORS.primary, fontWeight: '700' },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardLabel: { fontSize: 12, color: COLORS.textSecondary },
  cardValue: { fontSize: 15, color: COLORS.text, fontWeight: '600' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  staffRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: COLORS.primary },
  staffInfo: { flex: 1, gap: 3 },
  staffName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  staffRating: { fontSize: 12, color: COLORS.textSecondary },
  staffPhone: { fontSize: 12, color: COLORS.textSecondary },
  priceText: { fontSize: 22, fontWeight: '800', color: COLORS.primary },
  collectedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  collectedIcon: { fontSize: 14 },
  collectedText: { fontSize: 13, color: COLORS.success, fontWeight: '600' },
  locationText: { fontSize: 13, color: COLORS.text, lineHeight: 20 },
  actions: { gap: 10, marginTop: 4 },
  chatBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  chatBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  paymentBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: COLORS.success,
  },
  paymentBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  billBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.surface, borderRadius: 16, padding: 16,
    borderWidth: 1.5, borderColor: COLORS.primary,
  },
  billBtnText: { color: COLORS.primary, fontSize: 15, fontWeight: '700' },
  billBtnArrow: { color: COLORS.primary, fontSize: 18, fontWeight: '700' },
  cancelBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.error,
  },
  releaseBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.warning,
  },
  releaseBtnText: { color: COLORS.warning, fontSize: 15, fontWeight: '600' },
  cancelBtnText: { color: COLORS.error, fontSize: 15, fontWeight: '600' },
  btnDisabled: { opacity: 0.5 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  modalReason: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20 },
  modalPrice: { fontSize: 28, fontWeight: '800', color: COLORS.primary },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalRejectBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  modalRejectText: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },
  modalAcceptBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalAcceptText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
