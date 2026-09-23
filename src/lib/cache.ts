/**
 * Client-side offline cache.
 *  • facility list   → localStorage (browsed offline)
 *  • facility detail → localStorage (recently viewed, opened offline)
 *  • recently viewed → ordered id list shown as chips on the home screen
 * Tiles and app shell are cached by the service worker (public/sw.js).
 */
import type { Facility } from '../../shared/types';

const KEY_LIST = 'jalsafa.cache.facilities';
const KEY_RECENT = 'jalsafa.cache.recent';
const KEY_DETAIL_PREFIX = 'jalsafa.cache.facility.';
const MAX_RECENT = 6;

export interface CachedList {
  savedAt: string;
  facilities: Facility[];
}

export function saveFacilityList(facilities: Facility[]): void {
  try {
    localStorage.setItem(KEY_LIST, JSON.stringify({ savedAt: new Date().toISOString(), facilities }));
  } catch {
    /* storage full or unavailable — offline mode simply falls back to nothing */
  }
}

export function loadFacilityList(): CachedList | null {
  try {
    const raw = localStorage.getItem(KEY_LIST);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedList;
    if (!parsed || !Array.isArray(parsed.facilities)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveFacilityDetail(facility: Facility): void {
  try {
    localStorage.setItem(KEY_DETAIL_PREFIX + facility.id, JSON.stringify(facility));
    const recent = localStorage.getItem(KEY_RECENT);
    const ids: string[] = recent ? (JSON.parse(recent) as string[]) : [];
    const next = [facility.id, ...ids.filter((x) => x !== facility.id)].slice(0, MAX_RECENT);
    localStorage.setItem(KEY_RECENT, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function loadFacilityDetail(id: string): Facility | null {
  try {
    const raw = localStorage.getItem(KEY_DETAIL_PREFIX + id);
    return raw ? (JSON.parse(raw) as Facility) : null;
  } catch {
    return null;
  }
}

export function loadRecentIds(): string[] {
  try {
    const raw = localStorage.getItem(KEY_RECENT);
    const ids = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
}
