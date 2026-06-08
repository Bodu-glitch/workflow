import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Image,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { api } from '../../../lib/api';
import type { Bill } from '../../../lib/api';
import { COLORS } from '../../../constants/config';

function formatVND(amount: number) {
  return amount.toLocaleString('vi-VN') + ' ₫';
}

function vietQrUrl(p: { bank_code: string; account_number: string; account_name: string }, amount: number, info: string) {
  const base = `https://img.vietqr.io/image/${p.bank_code}-${p.account_number}-compact.png`;
  const params = new URLSearchParams({
    amount: String(Math.max(0, Math.round(amount))),
    addInfo: info.slice(0, 25),
    accountName: p.account_name,
  });
  return `${base}?${params}`;
}

export default function BillScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [bill, setBill] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.getBill(id as string)
      .then(setBill)
      .catch((e: any) => setError(e.message ?? 'Không thể tải hóa đơn'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>;
  }

  if (error || !bill) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 40 }}>🧾</Text>
        <Text style={styles.errorText}>{error ?? 'Không tìm thấy hóa đơn'}</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isPaid = bill.collected_amount != null && bill.collected_amount > 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
          <Text style={styles.headerBackText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hóa đơn</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        {/* Tenant */}
        {bill.tenant && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Doanh nghiệp</Text>
            <Text style={styles.tenantName}>{bill.tenant.name}</Text>
          </View>
        )}

        {/* Items */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Chi tiết dịch vụ</Text>
          {bill.items.length === 0 ? (
            <Text style={styles.emptyItems}>Không có hạng mục chi tiết</Text>
          ) : (
            bill.items.map((item, i) => (
              <View key={i} style={styles.itemRow}>
                <Text style={styles.itemLabel}>{item.label}</Text>
                <Text style={styles.itemPrice}>{formatVND(item.unit_price)}</Text>
              </View>
            ))
          )}
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tổng cộng</Text>
            <Text style={styles.totalValue}>{formatVND(bill.total)}</Text>
          </View>
        </View>

        {/* Payment QR */}
        {isPaid ? (
          <View style={styles.paidCard}>
            <Text style={styles.paidIcon}>✅</Text>
            <Text style={styles.paidTitle}>Đã thanh toán</Text>
            <Text style={styles.paidAmount}>{formatVND(bill.collected_amount!)}</Text>
          </View>
        ) : bill.payment ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Quét mã để thanh toán</Text>
            <View style={styles.qrWrap}>
              <Image
                source={{ uri: vietQrUrl(bill.payment, bill.total, `Thanh toan ${bill.request_id.slice(0, 8)}`) }}
                style={styles.qr}
                resizeMode="contain"
              />
            </View>
            <View style={styles.bankInfo}>
              <Text style={styles.bankLine}>{bill.payment.bank_code} — {bill.payment.account_number}</Text>
              <Text style={styles.bankName}>{bill.payment.account_name}</Text>
            </View>
            <View style={styles.qrAmount}>
              <Text style={styles.qrAmountLabel}>Số tiền</Text>
              <Text style={styles.qrAmountValue}>{formatVND(bill.total)}</Text>
            </View>
            <Text style={styles.hint}>
              Mở app ngân hàng → quét mã QR → kiểm tra số tiền → xác nhận
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.noPayment}>
              💳 Doanh nghiệp chưa cấu hình thông tin thanh toán. Vui lòng thanh toán trực tiếp.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 },
  errorText: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center' },
  backBtn: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: COLORS.primary, borderRadius: 12 },
  backBtnText: { color: '#fff', fontWeight: '600' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, backgroundColor: COLORS.surface,
  },
  headerBack: { padding: 8 },
  headerBackText: { fontSize: 20, color: COLORS.primary, fontWeight: '600' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  card: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, gap: 8 },
  cardLabel: { fontSize: 11, color: COLORS.textSecondary },
  tenantName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.text, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  emptyItems: { fontSize: 13, color: COLORS.textSecondary, fontStyle: 'italic' },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  itemLabel: { fontSize: 14, color: COLORS.text, flex: 1 },
  itemPrice: { fontSize: 14, color: COLORS.text, fontWeight: '500' },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  totalValue: { fontSize: 20, fontWeight: '800', color: COLORS.primary },
  qrWrap: { alignItems: 'center', paddingVertical: 8 },
  qr: { width: 240, height: 300, borderRadius: 12 },
  bankInfo: { backgroundColor: COLORS.background, borderRadius: 12, padding: 12, gap: 2 },
  bankLine: { fontSize: 13, color: COLORS.textSecondary },
  bankName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  qrAmount: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  qrAmountLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  qrAmountValue: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  hint: { fontSize: 12, color: COLORS.textSecondary, textAlign: 'center', marginTop: 4 },
  paidCard: { backgroundColor: COLORS.success + '15', borderRadius: 16, padding: 24, alignItems: 'center', gap: 6 },
  paidIcon: { fontSize: 40 },
  paidTitle: { fontSize: 16, fontWeight: '700', color: COLORS.success },
  paidAmount: { fontSize: 22, fontWeight: '800', color: COLORS.success },
  noPayment: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
});
