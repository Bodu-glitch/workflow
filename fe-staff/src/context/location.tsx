import * as Location from 'expo-location';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { useAuth } from './auth';
import { technicianApi } from '@/lib/api/technician';

const SEND_INTERVAL_MS = 15_000; // send every 15 seconds
const MIN_DISTANCE_M = 20;       // skip if moved less than 20m since last send

export function LocationTracker() {
  const { token, user } = useAuth();
  const isStaff = user?.role === 'staff';
  const lastSent = useRef<{ lat: number; lng: number } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const latestPos = useRef<Location.LocationObject | null>(null);

  useEffect(() => {
    if (!token || !isStaff) return;
    if (Platform.OS === 'web') return; // web doesn't support background location

    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;

      // Watch position continuously; store latest in ref (no network on every move)
      watchRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        (loc) => { latestPos.current = loc; },
      );

      // Send to backend every 15 seconds (only if moved enough)
      intervalRef.current = setInterval(() => {
        const pos = latestPos.current;
        if (!pos) return;
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;

        const prev = lastSent.current;
        if (prev) {
          const d = Math.sqrt((lat - prev.lat) ** 2 + (lng - prev.lng) ** 2) * 111_320;
          if (d < MIN_DISTANCE_M) return; // haven't moved enough
        }

        lastSent.current = { lat, lng };
        void technicianApi.updateLocation(
          lat, lng,
          accuracy ?? undefined,
          pos.coords.heading ?? undefined,
          pos.coords.speed ?? undefined,
        ).catch(() => {}); // best-effort, ignore errors
      }, SEND_INTERVAL_MS);
    })();

    const sub = AppState.addEventListener('change', (state) => {
      // Resume sending when app comes back to foreground
      if (state === 'active') latestPos.current = null;
    });

    return () => {
      cancelled = true;
      watchRef.current?.remove();
      if (intervalRef.current) clearInterval(intervalRef.current);
      sub.remove();
    };
  }, [token, isStaff]);

  return null;
}
