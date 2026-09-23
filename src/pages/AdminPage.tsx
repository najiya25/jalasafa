import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { LocalBody, TicketStatus, TicketView } from '../../shared/types';
import { api } from '../lib/api';
import { useOnline } from '../lib/hooks';
import { badgeTone, dueDate, formatDate, issueLabel, priorityLabel, statusLabel } from '../lib/labels';
import { useI18n, type TKey } from '../lib/i18n';
import { Badge } from '../components/Badge';

/** Next-step button label per status (null = journey complete). */
const NEXT_LABEL: Record<TicketStatus, TKey | null> = {
  submitted: 'admin.assign',
  assigned: 'admin.startWork',
  in_progress: 'admin.markResolved',
  resolved: null,
};

const STATUS_ORDER: TicketStatus[] = ['submitted', 'assigned', 'in_progress', 'resolved'];

/**
 * Demo admin "ticket desk" (spec F): shows each report routed to its
 * responsible local body and lets a judge advance the status one step at a time.
 */
export function AdminPage() {
  const { t } = useI18n();
  const [tickets, setTickets] = useState<TicketView[]>([]);
  const [bodies, setBodies] = useState<LocalBody[]>([]);
  const [bodyFilter, setBodyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | TicketStatus>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const online = useOnline();

  const load = useCallback(() => {
    setLoading(true);
    api
      .tickets()
      .then((list) => {
        setTickets(list);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load tickets.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    api
      .localBodies()
      .then(setBodies)
      .catch(() => setBodies([]));
  }, [load]);

  const advance = async (id: string): Promise<void> => {
    setBusyId(id);
    try {
      const updated = await api.advanceTicket(id);
      setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status update failed.');
    } finally {
      setBusyId(null);
    }
  };

  const visible = tickets.filter(
    (t) =>
      (bodyFilter === 'all' || t.localBodyId === bodyFilter) &&
      (statusFilter === 'all' || t.status === statusFilter),
  );

  const counts = STATUS_ORDER.map((status) => ({
    status,
    n: tickets.filter((t) => t.status === status).length,
  }));

  return (
    <div className="container" style={{ paddingTop: 20 }}>
      <div className="card">
        <div className="admin-head">
          <div>
            <span className="pill sim">{t('admin.simPill')}</span>
            <h1 style={{ margin: '8px 0 4px', fontSize: 28 }}>{t('admin.title')}</h1>
            <p style={{ margin: 0, color: 'var(--ink-soft)' }}>{t('admin.intro')}</p>
          </div>
          <button type="button" className="btn secondary" onClick={load}>
            {t('admin.refresh')}
          </button>
        </div>

        <div className="flow-chain" aria-label={t('admin.flowAria')}>
          <span className="node">{t('admin.node1')}</span>
          <span className="arrow" aria-hidden="true">→</span>
          <span className="node">{t('admin.node2')}</span>
          <span className="arrow" aria-hidden="true">→</span>
          <span className="node">{t('admin.node3')}</span>
          <span className="arrow" aria-hidden="true">→</span>
          <span className="node">{t('admin.node4')}</span>
          <span className="arrow" aria-hidden="true">→</span>
          <span className="node">{t('admin.node5')}</span>
        </div>

        <div className="stat-row">
          {counts.map(({ status, n }) => {
            const label = statusLabel(status);
            return (
              <div className="stat" key={status}>
                <b>{n}</b>
                <span>
                  <span aria-hidden="true">{label.glyph}</span> {label.text}
                </span>
              </div>
            );
          })}
        </div>

        <div className="admin-filters">
          <label>
            {t('admin.filterBody')}
            <select value={bodyFilter} onChange={(e) => setBodyFilter(e.target.value)}>
              <option value="all">{t('admin.allBodies')}</option>
              {bodies.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('admin.filterStatus')}
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | TicketStatus)}>
              <option value="all">{t('admin.allStatuses')}</option>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s).text}
                </option>
              ))}
            </select>
          </label>
        </div>

        {!online && (
          <div className="notice warn" role="status">
            <b>{t('admin.offlineBold')}</b>
            {t('admin.offlineRest')}
          </div>
        )}
        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
      </div>

      <div className="ticket-list" aria-live="polite">
        {loading && <div className="card empty-state">{t('admin.loading')}</div>}

        {!loading && visible.length === 0 && (
          <div className="card empty-state">
            <p>{t('admin.noTickets')}</p>
            <Link className="btn" to="/">
              {t('admin.reportFromMap')}
            </Link>
          </div>
        )}

        {visible.map((tk) => {
          const status = statusLabel(tk.status);
          const issue = issueLabel(tk.issue);
          const priority = priorityLabel(tk.priority);
          const nextLabel = NEXT_LABEL[tk.status];
          return (
            <article className="card ticket-card" key={tk.id}>
              <div className="ticket-top">
                <span className="tid">{tk.id}</span>
                <Badge tone={badgeTone('status', tk.status)} glyph={status.glyph}>
                  {status.text}
                </Badge>
                <Badge tone={badgeTone('priority', tk.priority)} glyph={priority.glyph}>
                  {priority.text}
                </Badge>
                <Badge tone="info" glyph="🏛️">
                  {tk.localBodyName}
                </Badge>
              </div>

              <h3>
                <span aria-hidden="true">{tk.facilityType === 'toilet' ? '🚻' : '💧'}</span>{' '}
                <Link to={`/facility/${tk.facilityId}`}>{tk.facilityName}</Link>
              </h3>
              <p className="desc">
                <b>
                  {t('ticket.issuePrefix')} {issue.glyph} {issue.text}
                </b>
                {tk.description ? ` — “${tk.description}”` : ''}
              </p>

              <dl className="kv">
                <dt>{t('admin.created')}</dt>
                <dd>{formatDate(tk.createdAt)}</dd>
                <dt>{t('admin.responseDue')}</dt>
                <dd>
                  {dueDate(tk.createdAt, tk.slaHours)} ({tk.slaHours} h)
                </dd>
                <dt>{t('admin.jurisdiction')}</dt>
                <dd>{tk.jurisdiction}</dd>
                <dt>{t('admin.lastChange')}</dt>
                <dd>{formatDate(tk.updatedAt)}</dd>
              </dl>

              <div className="ticket-actions">
                {nextLabel ? (
                  <button
                    type="button"
                    className="btn small"
                    disabled={!online || busyId === tk.id}
                    onClick={() => void advance(tk.id)}
                  >
                    {busyId === tk.id ? t('admin.updating') : t(nextLabel)}
                  </button>
                ) : (
                  <span className="badge ok">
                    <span className="glyph" aria-hidden="true">
                      ✔
                    </span>
                    {t('admin.journeyComplete')}
                  </span>
                )}
                <Link className="btn small secondary" to={`/ticket/${tk.id}`}>
                  {t('admin.viewConfirmation')}
                </Link>
              </div>
            </article>
          );
        })}
      </div>

      <div className="privacy-note" style={{ marginBottom: 24 }}>
        <b>{t('admin.privacyTitle')}</b> {t('admin.privacyBody')}
      </div>
    </div>
  );
}
