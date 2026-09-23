/**
 * Human-friendly formatting + icon/text labels.
 * Every status label pairs an icon with text so meaning never depends on colour.
 *
 * Glyphs, tones and formatting are unchanged from the original design; only the
 * human-readable text is routed through the central dictionary (lib/i18n.tsx)
 * so it follows the selected language. Components using these helpers consume
 * `useI18n()`, so they re-render when the language changes.
 */
import type { Availability, Condition, FacilityType, Issue, OpenStatus, Priority, TicketStatus } from '../../shared/types';
import { tx } from './i18n';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "23 Sep 2026, 4:30 PM" — the exact freshness format required by the brief. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = String(d.getDate()).padStart(2, '0');
  const month = MONTHS[d.getMonth()];
  const year = d.getFullYear();
  let hours = d.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
}

/** "Due 24 Sep 2026, 4:30 PM" style deadline from createdAt + slaHours. */
export function dueDate(iso: string, slaHours: number): string {
  const d = new Date(iso);
  d.setTime(d.getTime() + slaHours * 3600 * 1000);
  return formatDate(d.toISOString());
}

export function daysAgo(iso: string): number {
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return 0;
  return Math.floor((Date.now() - d) / 86_400_000);
}

interface Labeled {
  glyph: string;
  text: string;
}

export const conditionLabel = (c: Condition): Labeled =>
  ({
    clean: { glyph: '🧼', text: tx('label.clean') },
    usable: { glyph: '👍', text: tx('label.usable') },
    broken: { glyph: '⚠️', text: tx('label.broken') },
    locked: { glyph: '🔒', text: tx('label.locked') },
    no_water: { glyph: '🚱', text: tx('label.noWater') },
  })[c];

export const issueLabel = (i: Issue): Labeled =>
  i === 'other' ? { glyph: 'ℹ️', text: tx('label.otherIssue') } : conditionLabel(i);

export const availabilityLabel = (a: Availability): Labeled =>
  a === 'available'
    ? { glyph: '✔', text: tx('label.available') }
    : { glyph: '✘', text: tx('label.unavailable') };

export const facilityTypeLabel = (t: FacilityType): Labeled =>
  t === 'toilet'
    ? { glyph: '🚻', text: tx('label.publicToilet') }
    : { glyph: '💧', text: tx('label.drinkingWater') };

export const openStatusLabel = (s: OpenStatus): Labeled =>
  ({
    open: { glyph: '🟢', text: tx('label.open') },
    closed: { glyph: '⛔', text: tx('label.closed') },
    unknown: { glyph: '❔', text: tx('label.hoursUnknown') },
  })[s];

export const statusLabel = (s: TicketStatus): Labeled =>
  ({
    submitted: { glyph: '📤', text: tx('label.submitted') },
    assigned: { glyph: '👷', text: tx('label.assigned') },
    in_progress: { glyph: '🛠️', text: tx('label.inProgress') },
    resolved: { glyph: '✅', text: tx('label.resolved') },
  })[s];

export const priorityLabel = (p: Priority): Labeled =>
  ({
    high: { glyph: '▲', text: tx('label.highPriority') },
    medium: { glyph: '◆', text: tx('label.mediumPriority') },
    low: { glyph: '▽', text: tx('label.lowPriority') },
  })[p];

/** Tone class for badges — always combined with icon + text above. */
export function badgeTone(
  kind: 'condition' | 'availability' | 'status' | 'priority',
  value: string,
): string {
  if (kind === 'condition') {
    if (value === 'clean' || value === 'usable') return 'ok';
    if (value === 'broken' || value === 'no_water') return 'bad';
    return 'warn';
  }
  if (kind === 'availability') return value === 'available' ? 'ok' : 'bad';
  if (kind === 'status') {
    if (value === 'resolved') return 'ok';
    if (value === 'in_progress') return 'info';
    if (value === 'assigned') return 'info';
    return 'warn';
  }
  if (value === 'high') return 'bad';
  if (value === 'medium') return 'warn';
  return 'muted';
}
