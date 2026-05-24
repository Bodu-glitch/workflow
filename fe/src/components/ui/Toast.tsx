import { useEffect } from 'react';
import { Pressable, View as RNView, Text as RNText } from 'react-native';

export type ToastType = 'success' | 'error' | 'warning';

interface ToastItemProps {
  id: string;
  title?: string;
  message: string;
  type: ToastType;
  onDismiss: () => void;
}

const BG: Record<ToastType, string> = {
  success: '#4CAF50',
  error:   '#EF5350',
  warning: '#42A5F5',
};

const ICON: Record<ToastType, string> = {
  success: '✓',
  error:   '!',
  warning: 'i',
};

export function ToastItem({ title, message, type, onDismiss }: ToastItemProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <RNView
      style={{
        backgroundColor: BG[type],
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 14,
        marginBottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
        boxShadow: '0 2px 10px rgba(0,0,0,0.18)',
        elevation: 5,
      }}
    >
      <RNView
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          borderWidth: 2.5,
          borderColor: 'rgba(255,255,255,0.9)',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}
      >
        <RNText style={{ color: '#fff', fontSize: 14, fontWeight: '800', lineHeight: 17 }}>
          {ICON[type]}
        </RNText>
      </RNView>

      <RNView style={{ flex: 1 }}>
        <RNText style={{ color: '#fff', fontSize: 15, fontWeight: '700', lineHeight: 20 }}>
          {title ?? message}
        </RNText>
        {title ? (
          <RNText style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 18, marginTop: 2 }}>
            {message}
          </RNText>
        ) : null}
      </RNView>

      <Pressable onPress={onDismiss} style={{ padding: 6, marginLeft: 8 }}>
        <RNText style={{ color: '#fff', fontSize: 22, fontWeight: '300', lineHeight: 22 }}>×</RNText>
      </Pressable>
    </RNView>
  );
}
