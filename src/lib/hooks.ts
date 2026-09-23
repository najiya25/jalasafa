/** Small shared React hooks: online state, high-contrast mode, geolocation. */
import { useEffect, useState } from 'react';

/**
 * Online/offline state: browser events + failures reported by the API client.
 * (navigator.onLine alone is unreliable, so failed fetches also flip us offline.)
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const up = (): void => setOnline(true);
    const down = (): void => setOnline(false);
    const apiNet = (e: Event): void => {
      const detail = (e as CustomEvent<{ online: boolean }>).detail;
      setOnline(detail.online);
    };
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    window.addEventListener('jalsafa:net', apiNet);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
      window.removeEventListener('jalsafa:net', apiNet);
    };
  }, []);

  return online;
}

const CONTRAST_KEY = 'jalsafa.contrast';

export function useHighContrast(): [boolean, () => void] {
  const [enabled, setEnabled] = useState(() => localStorage.getItem(CONTRAST_KEY) === 'high');

  useEffect(() => {
    document.documentElement.dataset.contrast = enabled ? 'high' : 'normal';
    localStorage.setItem(CONTRAST_KEY, enabled ? 'high' : 'normal');
  }, [enabled]);

  return [enabled, () => setEnabled((v) => !v)];
}

export interface GeoState {
  coords: { lat: number; lng: number } | null;
  request: () => void;
  requesting: boolean;
  denied: boolean;
}

/**
 * One-shot location. Used ONLY to compute nearby distances — never persisted,
 * never sent to the server (privacy requirement H).
 */
export function useGeolocation(): GeoState {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [denied, setDenied] = useState(false);

  const request = (): void => {
    if (!navigator.geolocation) {
      setDenied(true);
      return;
    }
    setRequesting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setRequesting(false);
        setDenied(false);
      },
      () => {
        setDenied(true);
        setRequesting(false);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  };

  // If permission was already granted earlier, quietly refresh the position.
  useEffect(() => {
    let cancelled = false;
    navigator.permissions?.query({ name: 'geolocation' }).then((status) => {
      if (status.state === 'granted' && !cancelled) request();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { coords, request, requesting, denied };
}
