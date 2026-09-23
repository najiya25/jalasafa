import { useEffect, useRef, type ReactNode } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Facility } from '../../shared/types';
import { useI18n } from '../lib/i18n';

interface Props {
  facilities: Facility[];
  userLocation: { lat: number; lng: number } | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Simulated route corridor (Along My Route) — drawn as a dashed line. */
  routeLine?: [number, number][] | null;
  children?: ReactNode;
}

const CITY_CENTER: [number, number] = [9.9816, 76.2999]; // Kochi

function pinHtml(type: Facility['type'], name: string): string {
  const glyph = type === 'toilet' ? '🚻' : '💧';
  return `<div class="marker-pin ${type}" role="img" aria-label="${name.replace(/"/g, '&quot;')}"><span aria-hidden="true">${glyph}</span></div>`;
}

/** Interactive map: distinct icons for toilets vs water points + user location. */
export function FacilityMap({ facilities, userLocation, selectedId, onSelect, routeLine, children }: Props) {
  const { t } = useI18n();
  const holder = useRef<HTMLDivElement | null>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef<L.Marker[]>([]);
  const userMarker = useRef<L.Layer | null>(null);
  const routeLayer = useRef<L.Polyline | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!holder.current || map.current) return;
    const mapObj = L.map(holder.current, { scrollWheelZoom: false }).setView(CITY_CENTER, 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(mapObj);
    // Map tiles are decorative background — give them an empty alt so screen
    // readers skip them (the map container itself carries the aria-label).
    mapObj.on('tileload', (e) => {
      const tile = (e as unknown as { tile?: HTMLElement }).tile;
      if (tile instanceof HTMLImageElement) tile.alt = '';
    });
    map.current = mapObj;
    return () => {
      mapObj.remove();
      map.current = null;
    };
  }, []);

  // Facility markers (+ optional simulated route line)
  useEffect(() => {
    const mapObj = map.current;
    if (!mapObj) return;
    markers.current.forEach((m) => m.remove());
    markers.current = [];
    if (routeLayer.current) {
      routeLayer.current.remove();
      routeLayer.current = null;
    }
    const bounds: [number, number][] = [];

    // Simulated corridor: drawn FIRST so facility pins sit above it.
    if (routeLine && routeLine.length >= 2) {
      routeLayer.current = L.polyline(routeLine, {
        color: '#b45309',
        weight: 4,
        dashArray: '10 8',
        className: 'route-line',
      })
        .addTo(mapObj)
        .bindPopup(t('map.routePopup'));
      routeLine.forEach((pt) => bounds.push(pt));
    }

    facilities.forEach((f) => {
      const marker = L.marker([f.lat, f.lng], {
        icon: L.divIcon({
          className: '',
          html: pinHtml(f.type, f.name),
          iconSize: [34, 34],
          iconAnchor: [17, 30],
          popupAnchor: [0, -28],
        }),
        title: `${f.name} — ${f.type}`,
        alt: f.name,
      }).addTo(mapObj);
      marker.on('click', () => onSelectRef.current(f.id));
      markers.current.push(marker);
      bounds.push([f.lat, f.lng]);
    });

    if (userLocation) bounds.push([userLocation.lat, userLocation.lng]);
    if (bounds.length) mapObj.fitBounds(L.latLngBounds(bounds).pad(0.15));
  }, [facilities, userLocation, routeLine, t]);

  // User's approximate location (only when permission was granted)
  useEffect(() => {
    const mapObj = map.current;
    if (!mapObj) return;
    if (userMarker.current) {
      userMarker.current.remove();
      userMarker.current = null;
    }
    if (userLocation) {
      userMarker.current = L.circleMarker([userLocation.lat, userLocation.lng], {
        radius: 9,
        color: '#ffffff',
        weight: 3,
        fillColor: '#b91c1c',
        fillOpacity: 1,
      })
        .addTo(mapObj)
        .bindPopup(t('map.userPopup'));
    }
  }, [userLocation, t]);

  // Highlight the card the user selected (and vice versa)
  useEffect(() => {
    if (!selectedId || !map.current) return;
    const facility = facilities.find((f) => f.id === selectedId);
    if (facility) map.current.panTo([facility.lat, facility.lng]);
  }, [selectedId, facilities]);

  return (
    <div className="map-wrap">
      <div ref={holder} className="map" role="application" aria-label={t('map.aria')} />
      <p className="map-note">{t('map.note')}</p>
      {children}
    </div>
  );
}
