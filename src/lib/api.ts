/** Tiny API client. Reports network failures so the UI can switch to cached data. */

export class NetworkError extends Error {
  constructor(message = 'Network unavailable') {
    super(message);
    this.name = 'NetworkError';
  }
}

/** An HTTP-level failure (4xx/5xx). Carries the status so callers can react
 *  (e.g. auth treats 401 as "token invalid", everything else as transient). */
export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function announce(online: boolean): void {
  window.dispatchEvent(new CustomEvent('jalsafa:net', { detail: { online } }));
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    const { headers: extraHeaders, ...rest } = init ?? {};
    response = await fetch(path, {
      ...rest,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(extraHeaders ?? {}),
      },
    });
  } catch {
    announce(false);
    throw new NetworkError();
  }
  // A "successful" response can still come from the offline cache (service
  // worker), so never claim online unless the browser itself believes it is.
  // Otherwise offline mode would report "live data" while serving cached copy.
  announce(navigator.onLine);
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* keep default message */
    }
    throw new ApiError(message, response.status);
  }
  return (await response.json()) as T;
}

export const api = {
  facilities: () => request<import('../../shared/types').Facility[]>('/api/facilities'),
  facility: (id: string) => request<import('../../shared/types').Facility>(`/api/facilities/${encodeURIComponent(id)}`),
  localBodies: () => request<import('../../shared/types').LocalBody[]>('/api/local-bodies'),
  createTicket: (body: { facilityId: string; issue: string; description?: string }) =>
    request<import('../../shared/types').CreateTicketResponse>('/api/tickets', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  ticket: (id: string) =>
    request<{ ticket: import('../../shared/types').TicketView; workflow: import('../../shared/types').WorkflowStep[] }>(
      `/api/tickets/${encodeURIComponent(id)}`,
    ),
  tickets: (filter: { status?: string; localBodyId?: string } = {}) => {
    const params = new URLSearchParams();
    if (filter.status) params.set('status', filter.status);
    if (filter.localBodyId) params.set('localBodyId', filter.localBodyId);
    const qs = params.toString();
    return request<import('../../shared/types').TicketView[]>(`/api/tickets${qs ? `?${qs}` : ''}`);
  },
  advanceTicket: (id: string) =>
    request<import('../../shared/types').TicketView>(`/api/tickets/${encodeURIComponent(id)}/advance`, {
      method: 'PATCH',
    }),
  workflowRules: () => request<import('../../shared/types').WorkflowRule[]>('/api/workflow-rules'),
  // ── prototype auth (login / sign-up) ──
  authSignup: (body: { name: string; email: string; password: string }) =>
    request<import('../../shared/types').AuthResponse>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  authLogin: (body: { email: string; password: string }) =>
    request<import('../../shared/types').AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  authMe: (token: string) =>
    request<import('../../shared/types').AuthUser>('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    }),
};
