import { Modal, Pressable, View as RNView, Text as RNText } from 'react-native';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  onConfirm,
  onCancel,
  destructive = false,
}: ConfirmDialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <Pressable
        onPress={onCancel}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      >
        <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 360 }}>
          <RNView
            style={{
              backgroundColor: '#fff',
              borderRadius: 20,
              padding: 24,
              boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
              elevation: 8,
            }}
          >
            <RNText style={{ fontSize: 17, fontWeight: '700', color: '#1a1a2e', marginBottom: 8 }}>
              {title}
            </RNText>
            <RNText style={{ fontSize: 14, color: '#5a5a72', lineHeight: 21, marginBottom: 24 }}>
              {message}
            </RNText>
            <RNView style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={onCancel}
                style={({ pressed }) => ({
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: '#f1f5f9',
                  alignItems: 'center',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <RNText style={{ fontSize: 14, fontWeight: '600', color: '#475569' }}>{cancelLabel}</RNText>
              </Pressable>
              <Pressable
                onPress={onConfirm}
                style={({ pressed }) => ({
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: destructive ? '#EF5350' : '#1E40AF',
                  alignItems: 'center',
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <RNText style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>{confirmLabel}</RNText>
              </Pressable>
            </RNView>
          </RNView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
