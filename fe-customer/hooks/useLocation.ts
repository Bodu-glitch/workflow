import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';

interface LocationCoords {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

export function useLocation() {
  const [location, setLocation] = useState<LocationCoords | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Cần quyền truy cập vị trí để tìm kỹ thuật viên gần bạn');
        setLoading(false);
        return;
      }

      try {
        // Get initial position immediately
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude, accuracy: loc.coords.accuracy });
        setLoading(false);

        // Then watch for updates
        subscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 20 },
          (updated) => {
            setLocation({ latitude: updated.coords.latitude, longitude: updated.coords.longitude, accuracy: updated.coords.accuracy });
          },
        );
      } catch {
        setError('Không thể lấy vị trí hiện tại');
        setLoading(false);
      }
    })();

    // expo-location watchPositionAsync cleanup is broken on web (LocationEventEmitter.removeSubscription missing)
    return () => { try { subscription?.remove(); } catch { /* ignore */ } };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude, accuracy: loc.coords.accuracy });
    } catch {
      setError('Không thể lấy vị trí hiện tại');
    } finally {
      setLoading(false);
    }
  }, []);

  return { location, error, loading, refresh };
}
