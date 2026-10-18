'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  LoaderCircle,
  MessageSquare,
  Pencil,
  Send,
  Sparkles,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { Badge, ErrorMessage, Spinner } from '@/components/ui';
import { api, json } from '@/lib/api';
import {
  CATEGORIES,
  dateTime,
  initials,
  label,
  PRIORITIES,
  Status,
  TicketDetail,
  ticketNumber,
  transitions,
  User,
} from '@/lib/types';
import { useQuery } from '@/lib/use-query';

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const {
    data: ticket,
    loading,
    error: loadError,
    refresh,
    setData,
  } = useQuery<TicketDetail>(`/tickets/${id}`);
  const [staff, setStaff] = useState<User[]>([]);
  const [staffLoaded, setStaffLoaded] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState('');
  const [editing, setEditing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const isStaff = user?.role !== 'CUSTOMER';
  const isAdmin = user?.role === 'ADMIN';
  async function loadStaff() {
    if (staffLoaded) return;
    try {
      setStaff(await api<User[]>('/auth/staff'));
      setStaffLoaded(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function mutate(
    action: string,
    operation: () => Promise<unknown>,
    success: string,
  ) {
    setBusy(action);
    setError('');
    setMessage('');
    try {
      await operation();
      setData(await api<TicketDetail>(`/tickets/${id}`));
      setMessage(success);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy('');
    }
  }
  async function update(fields: object, success = 'Ticket updated.') {
    if (!ticket) return false;
    return mutate(
      'update',
      () =>
        api(
          `/tickets/${id}`,
          json('PATCH', { version: ticket.version, ...fields }),
        ),
      success,
    );
  }
  if (loading && !ticket) return <Spinner text="Opening your conversation…" />;
  if (loadError) return <ErrorMessage message={loadError} retry={refresh} />;
  if (!ticket || !user) return null;
  const analysis =
    ticket.aiAnalysis && !ticket.aiAnalysis.stale && ticket.aiAnalysis.category
      ? ticket.aiAnalysis
      : null;
  const allowedStatuses = isStaff
    ? transitions[ticket.status]
    : ticket.status === 'RESOLVED'
      ? (['OPEN', 'CLOSED'] as Status[])
      : [];
  const canEdit = isStaff || ticket.status === 'OPEN';
  return (
    <>
      <Link className="back-link" href="/tickets">
        <ArrowLeft size={12} />
        Back to tickets
      </Link>
      <div className="detail-header">
        <span className="ticket-id">{ticketNumber(ticket.number)}</span>
        <h1>{ticket.title}</h1>
        <div className="detail-meta">
          <Badge value={ticket.status} />
          <Badge value={ticket.priority} kind="priority" />
          <Badge value={ticket.category} kind="category" />
          <span className="muted">Created {dateTime(ticket.createdAt)}</span>
        </div>
      </div>
      {error && (
        <div style={{ marginBottom: 18 }}>
          <ErrorMessage
            message={error}
            retry={() => {
              setError('');
              refresh();
            }}
          />
        </div>
      )}
      {message && (
        <div
          className="success-message"
          role="status"
          style={{ marginBottom: 18 }}
        >
          <Check size={14} />
          {message}
        </div>
      )}
      <div className="detail-layout">
        <div className="detail-main">
          <section className="panel">
            <div className="panel-heading">
              <h2>The issue</h2>
              {canEdit && (
                <button
                  className="text-button"
                  disabled={!!busy}
                  onClick={() => setEditing(!editing)}
                >
                  <Pencil size={11} />
                  {editing ? 'Cancel editing' : 'Edit ticket'}
                </button>
              )}
            </div>
            <div className="detail-section">
              <div className="requester-line">
                <span className="avatar">
                  {initials(ticket.requester.name)}
                </span>
                <strong>{ticket.requester.name}</strong>
                <span>Requester</span>
                <span>{dateTime(ticket.createdAt)}</span>
              </div>
              {editing ? (
                <form
                  className="ticket-form"
                  key={ticket.version}
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const data = new FormData(e.currentTarget);
                    if (
                      await update(
                        {
                          title: String(data.get('title')),
                          description: String(data.get('description')),
                        },
                        'Ticket content updated. Run AI triage again for fresh suggestions.',
                      )
                    )
                      setEditing(false);
                  }}
                >
                  <label>
                    Subject
                    <input
                      name="title"
                      defaultValue={ticket.title}
                      required
                      minLength={5}
                      maxLength={160}
                    />
                  </label>
                  <label>
                    Description
                    <textarea
                      name="description"
                      defaultValue={ticket.description}
                      rows={6}
                      required
                      minLength={20}
                      maxLength={10000}
                    />
                  </label>
                  <div>
                    <button className="button primary small" disabled={!!busy}>
                      {busy === 'update' ? (
                        <LoaderCircle className="spin" size={13} />
                      ) : (
                        <Check size={13} />
                      )}
                      Save changes
                    </button>
                  </div>
                </form>
              ) : (
                <p className="description">{ticket.description}</p>
              )}
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <h2>
                Conversation
                <span className="count-chip">{ticket.comments.length}</span>
              </h2>
              <MessageSquare size={14} className="muted" />
            </div>
            <div className="detail-section">
              {ticket.comments.length === 0 && (
                <p className="comment-empty">
                  The conversation starts here. Add a reply to keep things
                  moving.
                </p>
              )}
              {ticket.comments.map((comment) => (
                <article className="comment" key={comment.id}>
                  <span className="avatar purple">
                    {initials(comment.author.name)}
                  </span>
                  <div className="comment-content">
                    <div className="comment-meta">
                      <strong>
                        {comment.author.name}
                        {comment.author.id === user.id ? ' (you)' : ''}
                      </strong>
                      <time>{dateTime(comment.createdAt)}</time>
                    </div>
                    <p className="comment-body">{comment.body}</p>
                  </div>
                </article>
              ))}
              {ticket.status !== 'CLOSED' ? (
                <form
                  className="comment-form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (
                      await mutate(
                        'reply',
                        () =>
                          api(
                            `/tickets/${id}/comments`,
                            json('POST', { body: reply }),
                          ),
                        'Your reply has been added.',
                      )
                    )
                      setReply('');
                  }}
                >
                  <label htmlFor="reply" style={{ marginBottom: 9 }}>
                    Add your reply
                  </label>
                  <textarea
                    id="reply"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Keep the conversation moving…"
                    rows={4}
                    required
                    maxLength={5000}
                  />
                  <div className="comment-actions">
                    <span>Visible to everyone on this ticket.</span>
                    <button
                      className="button primary small"
                      disabled={!!busy || !reply.trim()}
                    >
                      {busy === 'reply' ? (
                        <LoaderCircle size={13} className="spin" />
                      ) : (
                        <Send size={12} />
                      )}
                      Send reply
                    </button>
                  </div>
                </form>
              ) : (
                <p
                  className="comment-empty"
                  style={{
                    borderTop: '1px solid var(--line)',
                    marginTop: 20,
                    paddingTop: 20,
                  }}
                >
                  This conversation is closed.{' '}
                  {isStaff
                    ? 'Reopen the ticket to continue.'
                    : 'Contact your support team to reopen it.'}
                </p>
              )}
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <h2>Activity</h2>
              <span className="muted" style={{ fontSize: 9 }}>
                A shared history of progress
              </span>
            </div>
            <div className="detail-section">
              <ol className="activity-list">
                {ticket.activities.map((activity) => (
                  <li key={activity.id}>
                    <strong>
                      {activity.actor.name} · {label(activity.action)}
                    </strong>
                    <p>{activity.detail}</p>
                    <time>{dateTime(activity.createdAt)}</time>
                  </li>
                ))}
              </ol>
            </div>
          </section>
          {isAdmin && (
            <>
              {deleteConfirm ? (
                <div className="delete-confirm" role="alert">
                  <p>
                    Delete this ticket and all its replies and activity? This
                    cannot be undone.
                  </p>
                  <div>
                    <button
                      className="button danger small"
                      disabled={!!busy}
                      onClick={async () => {
                        setBusy('delete');
                        setError('');
                        try {
                          await api(
                            `/tickets/${id}`,
                            json('DELETE', { version: ticket.version }),
                          );
                          router.push('/tickets');
                        } catch (e) {
                          setError((e as Error).message);
                          setBusy('');
                        }
                      }}
                    >
                      {busy === 'delete'
                        ? 'Deleting…'
                        : 'Yes, delete permanently'}
                    </button>
                    <button
                      className="button small"
                      disabled={!!busy}
                      onClick={() => setDeleteConfirm(false)}
                    >
                      Keep ticket
                    </button>
                  </div>
                </div>
              ) : (
                <div className="danger-zone">
                  <span>Only admins can permanently remove a ticket.</span>
                  <button
                    className="text-button"
                    style={{ color: '#c69298', fontSize: 10 }}
                    onClick={() => setDeleteConfirm(true)}
                  >
                    <Trash2 size={11} />
                    Delete ticket
                  </button>
                </div>
              )}
            </>
          )}
        </div>
        <aside className="detail-sidebar">
          <section className="panel properties">
            <h2>Ticket details</h2>
            <label>
              Status
              <select
                aria-label="Ticket status"
                value={ticket.status}
                disabled={!!busy || !allowedStatuses.length}
                onChange={(e) =>
                  update({ status: e.target.value }, 'Ticket status updated.')
                }
              >
                <option value={ticket.status}>{label(ticket.status)}</option>
                {allowedStatuses.map((status) => (
                  <option key={status} value={status}>
                    {label(status)}
                  </option>
                ))}
              </select>
            </label>
            {isStaff ? (
              <>
                <label>
                  Priority
                  <select
                    aria-label="Ticket priority"
                    value={ticket.priority}
                    disabled={!!busy}
                    onChange={(e) => update({ priority: e.target.value })}
                  >
                    {PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {label(priority)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Category
                  <select
                    aria-label="Ticket category"
                    value={ticket.category}
                    disabled={!!busy}
                    onChange={(e) => update({ category: e.target.value })}
                  >
                    {CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {label(category)}
                      </option>
                    ))}
                  </select>
                </label>
                {isAdmin ? (
                  <label>
                    Assignee
                    <select
                      aria-label="Ticket assignee"
                      onFocus={loadStaff}
                      value={ticket.assigneeId ?? ''}
                      disabled={!!busy}
                      onChange={(e) =>
                        update(
                          { assigneeId: e.target.value || null },
                          'Assignment updated.',
                        )
                      }
                    >
                      <option value="">Unassigned</option>
                      {ticket.assignee &&
                        !staff.some((s) => s.id === ticket.assigneeId) && (
                          <option value={ticket.assignee.id}>
                            {ticket.assignee.name}
                          </option>
                        )}
                      {staff.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <>
                    <div className="property-read">
                      <span>Assignee</span>
                      <strong>{ticket.assignee?.name ?? 'Unassigned'}</strong>
                    </div>
                    {!ticket.assigneeId && (
                      <button
                        className="button small"
                        disabled={!!busy}
                        onClick={() =>
                          update(
                            { assigneeId: user.id },
                            'This ticket is now assigned to you.',
                          )
                        }
                      >
                        <UserRound size={12} />
                        Assign to me
                      </button>
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                <div className="property-read">
                  <span>Priority</span>
                  <strong>{label(ticket.priority)}</strong>
                </div>
                <div className="property-read">
                  <span>Category</span>
                  <strong>{label(ticket.category)}</strong>
                </div>
                <div className="property-read">
                  <span>Assignee</span>
                  <strong>{ticket.assignee?.name ?? 'Unassigned'}</strong>
                </div>
              </>
            )}
            <div className="form-divider" style={{ margin: '15px 0 9px' }} />
            <div className="property-read">
              <span>Last updated</span>
              <strong>{dateTime(ticket.updatedAt)}</strong>
            </div>
            {ticket.resolvedAt && (
              <div className="property-read">
                <span>Resolved</span>
                <strong>{dateTime(ticket.resolvedAt)}</strong>
              </div>
            )}
          </section>
          <section className="ai-panel">
            <div className="ai-panel-heading">
              <Sparkles size={15} />
              <h2>A thoughtful head start</h2>
              <span className="model-tag">AI TRIAGE</span>
            </div>
            {analysis ? (
              <>
                <p>{analysis.summary}</p>
                <div className="analysis-item">
                  <span className="small-label">
                    SUGGESTED CATEGORY & PRIORITY
                  </span>
                  <div className="analysis-tags">
                    <Badge value={analysis.category} kind="category" />
                    <Badge value={analysis.priority} kind="priority" />
                  </div>
                </div>
                <div className="analysis-item">
                  <span className="small-label">
                    MODEL SCORE · {Math.round(analysis.confidence * 100)}%
                  </span>
                  <div className="confidence-bar">
                    <span style={{ width: `${analysis.confidence * 100}%` }} />
                  </div>
                </div>
                <p className="analysis-disclaimer">{analysis.reasons[0]}</p>
                {isStaff && (
                  <>
                    <button
                      className="button secondary"
                      disabled={!!busy}
                      onClick={() =>
                        update(
                          {
                            category: analysis.category,
                            priority: analysis.priority,
                          },
                          'AI suggestions reviewed and applied.',
                        )
                      }
                    >
                      <Check size={12} />
                      Apply suggestions
                    </button>
                    {ticket.status !== 'CLOSED' && (
                      <button
                        className="button"
                        disabled={!!busy}
                        onClick={() => {
                          setReply((current) =>
                            current.trim()
                              ? `${current}\n\n${analysis.suggestedReply}`
                              : analysis.suggestedReply,
                          );
                          setMessage(
                            'Draft added to the reply box. Review it before sending.',
                          );
                          document.getElementById('reply')?.focus();
                        }}
                      >
                        <MessageSquare size={12} />
                        Use reply draft
                      </button>
                    )}
                  </>
                )}
              </>
            ) : (
              <p>
                {ticket.aiAnalysis?.stale
                  ? 'The ticket content changed. Run triage again for current suggestions.'
                  : 'A little clarity before the next step. Get a suggested category, priority, and reply.'}
              </p>
            )}
            {isStaff && (
              <button
                className="button"
                disabled={!!busy}
                onClick={() =>
                  mutate(
                    'analyze',
                    () =>
                      api(
                        `/tickets/${id}/analysis`,
                        json('POST', { version: ticket.version }),
                      ),
                    'AI analysis is ready for your review.',
                  )
                }
              >
                {busy === 'analyze' ? (
                  <LoaderCircle size={12} className="spin" />
                ) : (
                  <Sparkles size={12} />
                )}
                {analysis ? 'Refresh analysis' : 'Analyze ticket'}
              </button>
            )}
            <p className="analysis-disclaimer">
              Local model · Suggestions need human review. Scores are not
              calibrated probabilities.
              <br />
              <Link
                href="/guide#ai"
                className="text-button"
                style={{ fontSize: 9, marginTop: 5 }}
              >
                How it works
                <ChevronRight size={10} />
              </Link>
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
