import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { TicketView, WorkflowStep } from '../../shared/types';
import { api } from '../lib/api';
import { badgeTone, dueDate, formatDate, issueLabel, priorityLabel, statusLabel } from '../lib/labels';
import { useI18n } from '../lib/i18n';
import { Badge } from '../components/Badge';
import { Stepper } from '../components/Stepper';

/** Confirmation screen after a report is filed (spec E.7 + F). */
export function TicketPage() {
  const { id = '' } = useParams();
  const { t } = useI18n();
  const [ticket, setTicket] = useState<TicketView | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowStep[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .ticket(id)
      .then((res) => {
        if (!cancelled) {
          setTicket(res.ticket);
          setWorkflow(res.workflow);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Ticket could not be loaded.');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <div className="container" style={{ paddingTop: 24 }}>
        <div className="card empty-state">
          <p role="alert">{error}</p>
          <Link className="btn" to="/">
            {t('ticket.backToMap')}
          </Link>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="container" style={{ paddingTop: 24 }}>
        <div className="card empty-state">{t('ticket.loading')}</div>
      </div>
    );
  }

  const status = statusLabel(ticket.status);
  const issue = issueLabel(ticket.issue);
  const priority = priorityLabel(ticket.priority);

  return (
    <div className="container" style={{ paddingTop: 20 }}>
      <div className="card form-card">
        <div className="notice ok" role="status">
          <b>{t('ticket.receivedTitle')}</b> {t('ticket.receivedBody')}
        </div>

        <p className="hint" style={{ marginTop: 18, marginBottom: 4, fontWeight: 800, color: 'var(--ink-soft)' }}>
          {t('ticket.idLabel')}
        </p>
        <h1 className="ticket-id">{ticket.id}</h1>

        <div className="badge-row">
          <Badge tone={badgeTone('status', ticket.status)} glyph={status.glyph}>
            {t('ticket.statusPrefix')} {status.text}
          </Badge>
          <Badge tone={badgeTone('condition', ticket.issue === 'other' ? 'locked' : ticket.issue)} glyph={issue.glyph}>
            {t('ticket.issuePrefix')} {issue.text}
          </Badge>
          <Badge tone={badgeTone('priority', ticket.priority)} glyph={priority.glyph}>
            {priority.text}
          </Badge>
        </div>

        <h2 style={{ fontSize: 20 }}>{t('ticket.journeyHeading')}</h2>
        <p className="map-note" style={{ marginTop: 0 }}>
          <span className="pill sim">{t('ticket.simPill')}</span> {t('ticket.simNote')}
        </p>
        <Stepper steps={workflow} currentStatus={ticket.status} />

        <div className="detail-grid">
          <div className="card" style={{ boxShadow: 'none' }}>
            <h3 style={{ marginTop: 0, fontSize: 17 }}>{t('ticket.routedTo')}</h3>
            <p style={{ margin: 0 }}>
              <b>{ticket.localBodyName}</b>
              <br />
              {ticket.jurisdiction}
            </p>
          </div>
          <div className="card" style={{ boxShadow: 'none' }}>
            <h3 style={{ marginTop: 0, fontSize: 17 }}>{t('ticket.responseTarget')}</h3>
            <p style={{ margin: 0 }}>
              <b>{priority.text}</b> — {t('ticket.responseWithin', { h: ticket.slaHours })}
              <br />
              <span style={{ fontSize: 15 }}>{t('ticket.by', { when: dueDate(ticket.createdAt, ticket.slaHours) })}</span>
            </p>
          </div>
          <div className="card" style={{ boxShadow: 'none' }}>
            <h3 style={{ marginTop: 0, fontSize: 17 }}>{t('ticket.submittedHeading')}</h3>
            <p style={{ margin: 0 }}>{formatDate(ticket.createdAt)}</p>
          </div>
        </div>

        <div className="card" style={{ marginTop: 14, boxShadow: 'none' }}>
          <h3 style={{ marginTop: 0, fontSize: 17 }}>{t('ticket.facilityHeading')}</h3>
          <p style={{ margin: '0 0 8px' }}>
            <Link to={`/facility/${ticket.facilityId}`}>
              <b>{ticket.facilityName}</b>
            </Link>{' '}
            · <span className={`pill ${ticket.facilityType}`}>{ticket.facilityType === 'toilet' ? '🚻' : '💧'}{' '}
            {ticket.facilityType === 'toilet' ? t('label.publicToilet') : t('label.drinkingWater')}</span>
          </p>
          {ticket.description && (
            <p className="desc" style={{ margin: 0, color: 'var(--ink-soft)' }}>
              “{ticket.description}”
            </p>
          )}
        </div>

        <div className="privacy-note">
          <b>{t('ticket.privacyTitle')}</b> {t('ticket.privacyBody')}
        </div>

        <div className="form-actions">
          <Link className="btn" to="/admin">
            {t('ticket.watchDesk')}
          </Link>
          <Link className="btn secondary" to="/">
            {t('ticket.backToMap')}
          </Link>
        </div>
      </div>
    </div>
  );
}
