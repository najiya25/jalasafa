import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Facility, Issue } from '../../shared/types';
import { api, NetworkError } from '../lib/api';
import { loadFacilityDetail, saveFacilityDetail } from '../lib/cache';
import { useOnline } from '../lib/hooks';
import { facilityTypeLabel } from '../lib/labels';
import { useI18n, type TKey } from '../lib/i18n';

const ISSUES: { value: Issue; labelKey: TKey }[] = [
  { value: 'clean', labelKey: 'report.issue.clean' },
  { value: 'usable', labelKey: 'report.issue.usable' },
  { value: 'broken', labelKey: 'report.issue.broken' },
  { value: 'locked', labelKey: 'report.issue.locked' },
  { value: 'no_water', labelKey: 'report.issue.noWater' },
  { value: 'other', labelKey: 'report.issue.other' },
];

/**
 * Accessible reporting workflow (spec E).
 * Deliberately asks for NO identity: no name, phone, email — and no location
 * field either (the facility itself carries the coordinates).
 */
export function ReportPage() {
  const { facilityId = '' } = useParams();
  const navigate = useNavigate();
  const online = useOnline();
  const { t } = useI18n();

  const [facility, setFacility] = useState<Facility | null>(null);
  const [issue, setIssue] = useState<Issue | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .facility(facilityId)
      .then((f) => {
        if (!cancelled) {
          setFacility(f);
          saveFacilityDetail(f);
        }
      })
      .catch(() => {
        if (!cancelled) setFacility(loadFacilityDetail(facilityId));
      });
    return () => {
      cancelled = true;
    };
  }, [facilityId]);

  const submit = async (): Promise<void> => {
    if (!issue) {
      setError(t('report.chooseIssue'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await api.createTicket({ facilityId, issue, description });
      navigate(`/ticket/${result.ticket.id}`, { replace: true });
    } catch (err) {
      setError(
        err instanceof NetworkError
          ? t('report.networkError')
          : err instanceof Error
            ? err.message
            : t('report.genericError'),
      );
      setSubmitting(false);
    }
  };

  const type = facility ? facilityTypeLabel(facility.type) : null;

  return (
    <div className="container" style={{ paddingTop: 20 }}>
      <div className="card form-card">
        <Link to={`/facility/${facilityId}`} className="btn ghost small">
          {t('report.back')}
        </Link>

        <h1 style={{ marginTop: 16 }}>
          <span aria-hidden="true">📣</span> {t('report.title')}
        </h1>
        <p style={{ marginTop: 0 }}>
          {t('report.facilityLabel')} <b>{facility ? facility.name : t('report.loadingFacility')}</b>
          {type ? (
            <>
              {' '}
              · <span aria-hidden="true">{type.glyph}</span> {type.text}
            </>
          ) : null}
        </p>

        {!online && (
          <div className="notice warn" role="status">
            <b>{t('report.offlineTitle')}</b> {t('report.offlineBody')}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <fieldset>
            <legend>{t('report.legend')}</legend>
            <div className="radio-grid">
              {ISSUES.map((option) => (
                <label className="radio-option" key={option.value}>
                  <input
                    type="radio"
                    name="issue"
                    value={option.value}
                    checked={issue === option.value}
                    onChange={() => {
                      setIssue(option.value);
                      setError(null);
                    }}
                  />
                  {t(option.labelKey)}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="field">
            <label htmlFor="desc">{t('report.descLabel')}</label>
            <textarea
              id="desc"
              maxLength={200}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('report.descPlaceholder')}
              aria-describedby="desc-hint"
            />
            <p id="desc-hint" className="hint">
              {t('report.descHint', { n: description.length })}
            </p>
          </div>

          <div className="privacy-note">
            <b>{t('report.privacyTitle')}</b> {t('report.privacyBody')}
          </div>

          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}

          <div className="form-actions">
            <button type="submit" disabled={!online || submitting}>
              {submitting ? t('report.submitting') : t('report.submit')}
            </button>
            <Link className="btn secondary" to={`/facility/${facilityId}`}>
              {t('report.cancel')}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
