import type { Accessibility, Availability, Condition, FacilityType } from '../../shared/types';
import { useI18n, type TKey } from '../lib/i18n';

export interface Filters {
  query: string;
  type: 'all' | FacilityType;
  maxDistanceKm: number | null;
  availability: Availability[];
  conditions: Condition[];
  accessibleOnly: boolean;
  access: {
    wheelchairAccessible: boolean;
    accessibleEntrance: boolean;
    accessibleToilet: boolean;
    handrails: boolean;
    babyChanging: boolean;
    brailleSignage: boolean;
    lighting: boolean;
  };
}

export const emptyFilters: Filters = {
  query: '',
  type: 'all',
  maxDistanceKm: null,
  availability: [],
  conditions: [],
  accessibleOnly: false,
  access: {
    wheelchairAccessible: false,
    accessibleEntrance: false,
    accessibleToilet: false,
    handrails: false,
    babyChanging: false,
    brailleSignage: false,
    lighting: false,
  },
};

const ACCESS_FIELDS: { key: keyof Accessibility; labelKey: TKey; glyph: string }[] = [
  { key: 'wheelchairAccessible', labelKey: 'filters.access.wheelchair', glyph: '♿' },
  { key: 'accessibleEntrance', labelKey: 'filters.access.entrance', glyph: '🚪' },
  { key: 'accessibleToilet', labelKey: 'filters.access.toilet', glyph: '🚻' },
  { key: 'handrails', labelKey: 'filters.access.handrails', glyph: '🪜' },
  { key: 'babyChanging', labelKey: 'filters.access.baby', glyph: '👶' },
  { key: 'brailleSignage', labelKey: 'filters.access.braille', glyph: '⠿' },
  { key: 'lighting', labelKey: 'filters.access.lighting', glyph: '💡' },
];

/** Counts active filter CONTROLS only — the search query has its own input
 *  and is not counted, so "Clear filters (n)" always matches what it clears. */
export function activeFilterCount(f: Filters): number {
  let n = 0;
  if (f.type !== 'all') n += 1;
  if (f.maxDistanceKm != null) n += 1;
  n += f.availability.length;
  n += f.conditions.length;
  if (f.accessibleOnly) n += 1;
  n += Object.values(f.access).filter(Boolean).length;
  return n;
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

interface Props {
  value: Filters;
  onChange: (next: Filters) => void;
  hasLocation: boolean;
}

/** All filters are combinable (AND across groups, OR inside a group). */
export function FilterPanel({ value, onChange, hasLocation }: Props) {
  const { t } = useI18n();
  const set = (patch: Partial<Filters>): void => onChange({ ...value, ...patch });
  const count = activeFilterCount(value);

  const distanceOptions: { label: string; km: number | null }[] = [
    { label: t('filters.anyDistance'), km: null },
    { label: t('filters.within1'), km: 1 },
    { label: t('filters.within2'), km: 2 },
    { label: t('filters.within5'), km: 5 },
  ];

  return (
    <section className="card" aria-label={t('filters.aria')}>
      <div className="toolbar">
        <button
          type="button"
          className="chip accessible-chip"
          aria-pressed={value.accessibleOnly}
          onClick={() => set({ accessibleOnly: !value.accessibleOnly })}
          title={t('filters.accessibleTitle')}
        >
          {t('filters.accessibleChip')}
        </button>

        {(['all', 'toilet', 'water'] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            className="chip"
            aria-pressed={value.type === kind}
            onClick={() => set({ type: kind })}
          >
            {kind === 'all'
              ? t('filters.allTypes')
              : kind === 'toilet'
                ? t('filters.toilets')
                : t('filters.water')}
          </button>
        ))}

        <span className="chip" style={{ cursor: 'default' }}>
          <label htmlFor="distance" style={{ fontWeight: 700 }}>
            {t('filters.distance')}
          </label>
          <select
            id="distance"
            value={value.maxDistanceKm == null ? 'any' : String(value.maxDistanceKm)}
            onChange={(e) => set({ maxDistanceKm: e.target.value === 'any' ? null : Number(e.target.value) })}
            style={{ width: 'auto', minHeight: 34, padding: '2px 8px', border: 'none' }}
            disabled={!hasLocation}
            aria-describedby={hasLocation ? undefined : 'distance-help'}
          >
            {distanceOptions.map((o) => (
              <option key={o.km ?? 'any'} value={o.km == null ? 'any' : String(o.km)}>
                {o.label}
              </option>
            ))}
          </select>
        </span>

        {count > 0 && (
          <button type="button" className="chip" onClick={() => onChange({ ...emptyFilters, query: value.query })}>
            {t('filters.clear', { n: count })}
          </button>
        )}
      </div>

      {!hasLocation && (
        <p id="distance-help" className="map-note">
          {t('filters.locationHelp')}
        </p>
      )}

      <div className="filters-grid">
        <fieldset>
          <legend>{t('filters.availability')}</legend>
          <div className="check-list">
            {(['available', 'unavailable'] as const).map((a) => (
              <label key={a}>
                <input
                  type="checkbox"
                  checked={value.availability.includes(a)}
                  onChange={() => set({ availability: toggle(value.availability, a) })}
                />
                {a === 'available' ? t('filters.available') : t('filters.unavailable')}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>{t('filters.condition')}</legend>
          <div className="check-list">
            {([
              ['clean', 'filters.clean'],
              ['usable', 'filters.usable'],
              ['broken', 'filters.broken'],
              ['locked', 'filters.locked'],
              ['no_water', 'filters.noWater'],
            ] as const).map(([c, labelKey]) => (
              <label key={c}>
                <input
                  type="checkbox"
                  checked={value.conditions.includes(c)}
                  onChange={() => set({ conditions: toggle(value.conditions, c) })}
                />
                {t(labelKey)}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>{t('filters.accessibility')}</legend>
          <div className="check-list">
            {ACCESS_FIELDS.map((a) => (
              <label key={a.key}>
                <input
                  type="checkbox"
                  checked={value.access[a.key]}
                  onChange={() => set({ access: { ...value.access, [a.key]: !value.access[a.key] } })}
                />
                <span aria-hidden="true">{a.glyph}</span> {t(a.labelKey)}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    </section>
  );
}
