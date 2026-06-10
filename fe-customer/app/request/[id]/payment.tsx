import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { api } from '../../../lib/api';
import { COLORS } from '../../../constants/config';

interface PaymentInfo {
  id: string;
  name: string;
  qr_payment_url?: string;
  bank_name?: string;
  bank_account?: string;
  bank_account_name?: string;
}

interface RequestInfo {
  id: string;
  agreed_price: number;
  final_amount?: number;
  discount_amount?: number;
  completion_checklist?: Array<{ id: string; name: string; price: number; checked: boolean }>;
  tenant_id: string;
  applied_voucher_id?: string;
  voucher?: { code: string };
}

export default function PaymentScreen() {
  const { id: requestId } = useLocalSearchParams<{ id: string }>();
  const [request, setRequest] = useState<RequestInfo | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [voucher, setVoucher] = useState('');
  const [voucherResult, setVoucherResult] = useState<{
    discount_amount: number; final_amount: number; code: string
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [validatingVoucher, setValidatingVoucher] = useState(false);
  const [applyingVoucher, setApplyingVoucher] = useState(false);

  useEffect(() => {
    loadData();
  }, [requestId]);

  const loadData = async () => {
    try {
      const req = await api.get<RequestInfo>(`/requests/${requestId}`);
      setRequest(req);

      // Lấy payment info của tenant
      if (req.tenant_id) {
        const pInfo = await api.get<PaymentInfo>(`/workspace/public-payment/${req.tenant_id}`);
        setPaymentInfo(pInfo);
      }
    } catch (e) {
      console.warn('Payment load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleValidateVoucher = async () => {
    if (!voucher.trim() || !request) return;
    setValidatingVoucher(true);
    try {
      const result = await api.post<any>('/vouchers/validate', {
        code: voucher.trim(),
        tenant_id: request.tenant_id,
        order_amount: request.agreed_price,
      });
      setVoucherResult({ ...result, code: voucher.trim() });
    } catch (e: any) {
      Alert.alert('Voucher không hợp lệ', e.message);
      setVoucherResult(null);
    } finally {
      setValidatingVoucher(false);
    }
  };

  const handleApplyVoucher = async () => {
    if (!voucherResult || !request) return;
    setApplyingVoucher(true);
    try {
      await api.post(`/vouchers/apply/${request.id}`, {
        code: voucherResult.code,
        tenant_id: request.tenant_id,
      });
      setRequest(prev => prev ? {
        ...prev,
        discount_amount: voucherResult.discount_amount,
        final_amount: voucherResult.final_amount,
      } : null);
      Alert.alert('✅ Thành công', `Đã áp dụng voucher! Giảm ${voucherResult.discount_amount.toLocaleString('vi-VN')}đ`);
      setVoucher('');
      setVoucherResult(null);
    } catch (e: any) {
      Alert.alert('Lỗi', e.message);
    } finally {
      setApplyingVoucher(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const baseAmount = request?.agreed_price ?? 0;
  const discount = request?.discount_amount ?? 0;
  const finalAmount = request?.final_amount ?? (baseAmount - discount);
  const fmt = (n: number) => n.toLocaleString('vi-VN') + 'đ';

  // Transfer content
  const transferContent = `THANH TOAN ${requestId?.substring(0, 8).toUpperCase()}`;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Bill Summary */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>💰 Chi phí dịch vụ</Text>

        {request?.completion_checklist && request.completion_checklist.length > 0 ? (
          <>
            {request.completion_checklist.filter(item => item.checked).map(item => (
              <View key={item.id} style={styles.billRow}>
                <Text style={styles.billLabel}>{item.name}</Text>
                <Text style={styles.billValue}>{fmt(item.price)}</Text>
              </View>
            ))}
            <View style={styles.divider} />
          </>
        ) : null}

        <View style={styles.billRow}>
          <Text style={styles.billLabel}>Tổng dịch vụ</Text>
          <Text style={styles.billValue}>{fmt(baseAmount)}</Text>
        </View>

        {discount > 0 && (
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>
              Giảm giá {request?.voucher?.code ? `(${request.voucher.code})` : ''}
            </Text>
            <Text style={[styles.billValue, styles.discountValue]}>-{fmt(discount)}</Text>
          </View>
        )}

        <View style={[styles.billRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Tổng thanh toán</Text>
          <Text style={styles.totalValue}>{fmt(finalAmount)}</Text>
        </View>
      </View>

      {/* Voucher */}
      {!request?.applied_voucher_id && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🎟 Mã giảm giá</Text>
          <View style={styles.voucherRow}>
            <TextInput
              style={styles.voucherInput}
              value={voucher}
              onChangeText={setVoucher}
              placeholder="Nhập mã voucher"
              placeholderTextColor={COLORS.textSecondary}
              autoCapitalize="characters"
            />
            <TouchableOpacity
              style={styles.voucherBtn}
              onPress={handleValidateVoucher}
              disabled={validatingVoucher}
            >
              {validatingVoucher ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.voucherBtnText}>Kiểm tra</Text>
              )}
            </TouchableOpacity>
          </View>

          {voucherResult && (
            <View style={styles.voucherResult}>
              <View>
                <Text style={styles.voucherResultTitle}>✅ Voucher hợp lệ!</Text>
                <Text style={styles.voucherResultDiscount}>Giảm {fmt(voucherResult.discount_amount)}</Text>
                <Text style={styles.voucherResultFinal}>Còn lại: {fmt(voucherResult.final_amount)}</Text>
              </View>
              <TouchableOpacity
                style={styles.applyBtn}
                onPress={handleApplyVoucher}
                disabled={applyingVoucher}
              >
                {applyingVoucher ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <Text style={styles.applyBtnText}>Áp dụng</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* QR Payment */}
      {paymentInfo?.qr_payment_url ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📱 Quét QR thanh toán</Text>
          <View style={styles.qrContainer}>
            <Image
              source={{ uri: paymentInfo.qr_payment_url }}
              style={styles.qrImage}
              resizeMode="contain"
            />
          </View>

          <View style={styles.bankInfo}>
            {paymentInfo.bank_name && (
              <View style={styles.bankRow}>
                <Text style={styles.bankLabel}>Ngân hàng</Text>
                <Text style={styles.bankValue}>{paymentInfo.bank_name}</Text>
              </View>
            )}
            {paymentInfo.bank_account && (
              <View style={styles.bankRow}>
                <Text style={styles.bankLabel}>Số tài khoản</Text>
                <Text style={styles.bankValue}>{paymentInfo.bank_account}</Text>
              </View>
            )}
            {paymentInfo.bank_account_name && (
              <View style={styles.bankRow}>
                <Text style={styles.bankLabel}>Chủ tài khoản</Text>
                <Text style={styles.bankValue}>{paymentInfo.bank_account_name}</Text>
              </View>
            )}
            <View style={styles.bankRow}>
              <Text style={styles.bankLabel}>Số tiền</Text>
              <Text style={[styles.bankValue, styles.bankAmount]}>{fmt(finalAmount)}</Text>
            </View>
            <View style={[styles.bankRow, styles.contentRow]}>
              <Text style={styles.bankLabel}>Nội dung CK</Text>
              <View style={styles.contentBox}>
                <Text style={styles.contentText}>{transferContent}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.helpText}>
            📌 Vui lòng chuyển khoản đúng số tiền và nội dung để xác nhận thanh toán
          </Text>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>💵 Thanh toán tiền mặt</Text>
          <Text style={styles.cashText}>
            Vui lòng thanh toán trực tiếp cho kỹ thuật viên:{'\n'}
            <Text style={styles.cashAmount}>{fmt(finalAmount)}</Text>
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 16 },
  card: {
    backgroundColor: COLORS.surface, borderRadius: 16, padding: 18, gap: 14,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  billLabel: { fontSize: 14, color: COLORS.textSecondary },
  billValue: { fontSize: 14, color: COLORS.text, fontWeight: '600' },
  discountValue: { color: COLORS.success },
  divider: { height: 1, backgroundColor: COLORS.border },
  totalRow: { paddingTop: 4 },
  totalLabel: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  totalValue: { fontSize: 20, fontWeight: '800', color: COLORS.primary },
  voucherRow: { flexDirection: 'row', gap: 8 },
  voucherInput: {
    flex: 1, backgroundColor: COLORS.background, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: COLORS.text,
    borderWidth: 1, borderColor: COLORS.border,
    fontWeight: '700', letterSpacing: 1,
  },
  voucherBtn: {
    backgroundColor: COLORS.primary, borderRadius: 10,
    paddingHorizontal: 16, justifyContent: 'center',
  },
  voucherBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  voucherResult: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.success + '15', borderRadius: 10, padding: 12,
  },
  voucherResultTitle: { fontSize: 14, fontWeight: '700', color: COLORS.success },
  voucherResultDiscount: { fontSize: 13, color: COLORS.success },
  voucherResultFinal: { fontSize: 12, color: COLORS.textSecondary },
  applyBtn: { borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  applyBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
  qrContainer: { alignItems: 'center', padding: 8, backgroundColor: COLORS.background, borderRadius: 12 },
  qrImage: { width: 220, height: 220 },
  bankInfo: { gap: 10 },
  bankRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  bankLabel: { fontSize: 13, color: COLORS.textSecondary, width: 110 },
  bankValue: { fontSize: 14, color: COLORS.text, fontWeight: '600', flex: 1, textAlign: 'right' },
  bankAmount: { color: COLORS.primary, fontSize: 18, fontWeight: '800' },
  contentRow: { alignItems: 'flex-start' },
  contentBox: {
    flex: 1, backgroundColor: COLORS.primary + '10',
    borderRadius: 8, padding: 8, alignItems: 'flex-end',
  },
  contentText: { fontSize: 13, fontWeight: '700', color: COLORS.primary, letterSpacing: 0.5 },
  helpText: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 18 },
  cashText: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 22, textAlign: 'center' },
  cashAmount: { fontSize: 28, fontWeight: '800', color: COLORS.primary },
});
