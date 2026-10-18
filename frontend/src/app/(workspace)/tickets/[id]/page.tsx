'use client';

import Link from 'next/link';
import {useParams, useRouter, useSearchParams} from 'next/navigation';
import {Suspense, useState, type FormEvent, type KeyboardEvent} from 'react';
import {
  ArrowLeft, ArrowUpRight, Check, ChevronDown, Clock3, History, LockKeyhole,
  MessageSquare, Pencil, Send, ShieldCheck, Sparkles, Trash2, X,
} from 'lucide-react';
import {useAuth} from '@/components/auth-provider';
import {Avatar, CategoryBadge, EmptyState, ErrorState, LoadingState, PriorityBadge, Spinner, StatusBadge} from '@/components/ui';
import {api, ApiError} from '@/lib/api';
import {formatDate, label, relativeTime, ticketNumber} from '@/lib/format';
import {CATEGORIES, PRIORITIES, type TicketDetail, type User} from '@/lib/types';
import {useResource} from '@/lib/use-resource';
import styles from './detail.module.css';

export default function TicketDetailPage() {
  const {id} = useParams<{id: string}>();
  return <Suspense fallback={<LoadingState rows={5}/>}><TicketDetailView key={id} id={id}/></Suspense>;
}

function TicketDetailView({id}: {id: string}) {
  const router = useRouter();
  const query = useSearchParams();
  const {user} = useAuth();
  const staff = Boolean(user && user.role !== 'CUSTOMER');
  const resource = useResource<TicketDetail>(`/tickets/${encodeURIComponent(id)}`);
  const agents = useResource<{items: User[]}>(staff ? '/users/agents' : null);
  const [tab, setTab] = useState<'conversation'|'activity'>('conversation');
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState<string|null>(null);
  const [error, setError] = useState<string|null>(null);
  const [notice, setNotice] = useState<string|null>(() => query.get('created') === '1' ? 'Ticket created. Your support request is ready.' : null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function mutate(action: string, operation: () => Promise<unknown>, success: string): Promise<boolean> {
    if (busy || resource.loading) return false;
    setBusy(action); setError(null); setNotice(null);
    try {
      await operation();
      resource.reload();
      setNotice(success);
      return true;
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 409) {
        setError(`${failure.message} The latest ticket is being loaded. Your reply draft has been kept.`);
        resource.reload();
      } else setError(failure instanceof Error ? failure.message : 'Something went wrong. Please try again.');
      return false;
    } finally {setBusy(null);}
  }

  if (!resource.data) {
    return <div className={styles.page}><Link href="/tickets" className={styles.back}><ArrowLeft size={16}/>All tickets</Link>{resource.error ? <ErrorState message={resource.error} retry={resource.reload}/> : <LoadingState rows={5}/>}</div>;
  }

  const {ticket, comments, events, allowedTransitions} = resource.data;
  const disabled = Boolean(busy) || resource.loading;
  const closed = ticket.status === 'CLOSED';
  const canEdit = staff || ticket.status === 'OPEN';
  const canDelete = user?.role === 'ADMIN' || user?.role === 'CUSTOMER' && ticket.requesterId === user.id && ticket.status === 'OPEN';
  const needsReview = ticket.ai.confidence < 0.48 || ticket.ai.explanation.some(item => /manual review|too little recognizable|scores were too close|below the confidence threshold/i.test(item));

  function navigateTabs(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'conversation' : event.key === 'End' ? 'activity' : tab === 'conversation' ? 'activity' : 'conversation';
    setTab(next);
    document.getElementById(`${next}-tab`)?.focus();
  }

  function cancelDelete() {
    setConfirmDelete(false);
    requestAnimationFrame(() => document.getElementById('delete-ticket-launch')?.focus());
  }

  function patch(changes: Record<string, unknown>, message: string) {
    return mutate('properties', () => api(`/tickets/${id}`, {method: 'PATCH', body: {...changes, version: ticket.version}}), message);
  }

  async function saveDescription(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await patch({title: editTitle.trim(), description: editDescription.trim()}, 'Ticket details updated.')) setEditing(false);
  }

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim() || disabled || closed) return;
    if (await mutate('reply', () => api(`/tickets/${id}/comments`, {method: 'POST', body: {body: body.trim(), internal: staff && internal}}), internal && staff ? 'Internal note added.' : 'Reply sent.')) setBody('');
  }

  async function deleteTicket() {
    if (busy) return;
    setBusy('delete'); setError(null); setNotice(null);
    try {
      await api(`/tickets/${id}?version=${ticket.version}`, {method: 'DELETE'});
      router.push('/tickets'); router.refresh();
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 409) {resource.reload(); setConfirmDelete(false);}
      setError(failure instanceof Error ? failure.message : 'Could not delete this ticket.');
      setBusy(null);
    }
  }

  return <div className={styles.page}>
    <div className={styles.topline}>
      <Link href="/tickets" className={styles.back}><ArrowLeft size={16}/>All tickets</Link>
      <span className={styles.updated}><Clock3 size={13}/>Updated {relativeTime(ticket.updatedAt)}</span>
    </div>

    <header className={styles.heading}>
      <div className={styles.headingMeta}><span className={styles.ticketNumber}>{ticketNumber(ticket.number)}</span><span className={styles.metaDot}/><StatusBadge status={ticket.status}/></div>
      <h1>{ticket.title}</h1>
      <div className={styles.requesterLine}><Avatar name={ticket.requester?.name ?? 'Customer'} small/><span>Opened by <strong>{ticket.requester?.name ?? 'Customer'}</strong></span><span className={styles.metaDot}/><time dateTime={ticket.createdAt}>{formatDate(ticket.createdAt)}</time></div>
    </header>

    <div className={styles.messages} aria-live="polite">
      {error && <div className="form-error" role="alert">{error}</div>}
      {notice && <div className="success-notice"><Check size={16}/>{notice}</div>}
    </div>

    <div className={styles.layout}>
      <div className={styles.main}>
        <section className={`card ${styles.descriptionCard}`} aria-labelledby="description-heading">
          <div className={styles.sectionHeading}><h2 id="description-heading">Ticket details</h2>{canEdit && !editing && <button className={styles.textButton} onClick={() => {setEditTitle(ticket.title); setEditDescription(ticket.description); setEditing(true); requestAnimationFrame(() => document.getElementById('edit-title')?.focus());}} disabled={disabled}><Pencil size={14}/>Edit</button>}</div>
          {editing && canEdit ? <form onSubmit={saveDescription} className={styles.editForm}>
            <div className="field"><label htmlFor="edit-title">Title</label><input id="edit-title" className="input" value={editTitle} onChange={event => setEditTitle(event.target.value)} minLength={5} maxLength={160} required disabled={disabled}/></div>
            <div className="field"><label htmlFor="edit-description">Description</label><textarea id="edit-description" className="textarea" rows={7} value={editDescription} onChange={event => setEditDescription(event.target.value)} minLength={15} maxLength={10000} required disabled={disabled}/></div>
            <div className={styles.formActions}><button type="button" className="btn btn-secondary btn-small" disabled={disabled} onClick={() => setEditing(false)}>Cancel</button><button className="btn btn-primary btn-small" disabled={disabled || editTitle.trim().length < 5 || editDescription.trim().length < 15}>{busy === 'properties' ? <Spinner small/> : <Check size={15}/>}Save changes</button></div>
          </form> : <p className={styles.description}>{ticket.description}</p>}
        </section>

        <section className={`card ${styles.conversationCard}`} aria-label="Conversation and activity">
          <div className={styles.tabs} role="tablist" aria-label="Ticket history" onKeyDown={navigateTabs}>
            <button id="conversation-tab" role="tab" tabIndex={tab === 'conversation' ? 0 : -1} aria-selected={tab === 'conversation'} aria-controls="conversation-panel" className={tab === 'conversation' ? styles.activeTab : ''} onClick={() => setTab('conversation')}><MessageSquare size={16}/>Conversation<span className={styles.count}>{comments.length}</span></button>
            <button id="activity-tab" role="tab" tabIndex={tab === 'activity' ? 0 : -1} aria-selected={tab === 'activity'} aria-controls="activity-panel" className={tab === 'activity' ? styles.activeTab : ''} onClick={() => setTab('activity')}><History size={16}/>Activity</button>
          </div>
          {tab === 'conversation' ? <div id="conversation-panel" role="tabpanel" tabIndex={0} aria-labelledby="conversation-tab">
            {comments.length ? <div className={styles.comments}>{comments.map(comment => <article key={comment.id} className={`${styles.comment} ${comment.internal ? styles.internalComment : ''}`}>
              <Avatar name={comment.author?.name ?? 'Team member'} small/>
              <div className={styles.commentContent}><div className={styles.commentHeader}><strong>{comment.author?.name ?? 'Team member'}</strong>{comment.internal && <span className={styles.internalBadge}><LockKeyhole size={10}/>Internal note</span>}<time dateTime={comment.createdAt} title={formatDate(comment.createdAt, {dateStyle: 'medium', timeStyle: 'short'})}>{relativeTime(comment.createdAt)}</time></div><p>{comment.body}</p></div>
            </article>)}</div> : <div className={styles.emptyConversation}><span className={styles.emptyBubble}><MessageSquare size={23}/></span><h3>Let’s get this resolved.</h3><p>{closed ? 'This conversation has no replies.' : 'Start the conversation with a reply below.'}</p></div>}

            {closed ? <div className={styles.closedNotice}><ShieldCheck size={19}/><div><strong>This ticket is closed</strong><p>Reopen it using the status menu to continue the conversation.</p></div></div> : <form onSubmit={sendReply} className={`${styles.replyForm} ${staff && internal ? styles.internalReply : ''}`}>
              <div className={styles.replyTop}>{staff ? <div className={styles.replyModes} role="group" aria-label="Reply visibility"><button type="button" aria-pressed={!internal} className={!internal ? styles.selectedMode : ''} onClick={() => setInternal(false)} disabled={disabled}><MessageSquare size={13}/>Public reply</button><button type="button" aria-pressed={internal} className={internal ? styles.selectedMode : ''} onClick={() => setInternal(true)} disabled={disabled}><LockKeyhole size={13}/>Internal note</button></div> : <span className={styles.replyLabel}><MessageSquare size={15}/>Write a reply</span>}<span className={styles.draftHint}>Your voice, your reply</span></div>
              <label className="sr-only" htmlFor="reply-body">{staff && internal ? 'Internal note' : 'Reply message'}</label>
              <textarea id="reply-body" className={styles.replyInput} rows={5} placeholder={staff && internal ? 'Leave a private note for your team…' : 'Write a thoughtful reply…'} value={body} onChange={event => setBody(event.target.value)} maxLength={5000} disabled={disabled} required/>
              <div className={styles.replyFooter}><span>{staff && internal ? <><LockKeyhole size={12}/>Visible to your team only</> : 'Visible to everyone on this ticket'}</span><button className="btn btn-primary btn-small" disabled={disabled || !body.trim()}>{busy === 'reply' ? <Spinner small/> : <Send size={14}/>} {staff && internal ? 'Add note' : 'Send reply'}</button></div>
            </form>}
          </div> : <div id="activity-panel" role="tabpanel" tabIndex={0} aria-labelledby="activity-tab" className={styles.activityPanel}>{events.length ? <ol className={styles.timeline}>{[...events].reverse().map(event => <li key={event.id}><span className={styles.timelineDot}/><div><p><strong>{event.actor?.name ?? 'Team member'}</strong><span>{label(event.action)}</span></p><div className={styles.eventDetail}>{event.detail}</div><time dateTime={event.createdAt}>{formatDate(event.createdAt, {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'})}</time></div></li>)}</ol> : <EmptyState title="No activity yet" description="Ticket changes will appear here."/>}</div>}
        </section>
      </div>

      <aside className={styles.sidebar} aria-label="Ticket properties and analysis">
        <section className={`card ${styles.properties}`} aria-labelledby="properties-heading">
          <div className={styles.sectionHeading}><h2 id="properties-heading">Properties</h2>{busy === 'properties' && <Spinner small/>}</div>
          <div className={styles.propertyFields}>
            <div className="field"><label htmlFor="ticket-status">Status</label><select id="ticket-status" className="select" value={ticket.status} disabled={disabled || !allowedTransitions.length} onChange={event => {void mutate('properties', () => api(`/tickets/${id}/status`, {method: 'PATCH', body: {status: event.target.value, version: ticket.version}}), 'Ticket status updated.');}}><option value={ticket.status}>{label(ticket.status)}</option>{allowedTransitions.map(status => <option key={status} value={status} disabled={['IN_PROGRESS', 'RESOLVED'].includes(status) && !ticket.assigneeId}>{label(status)}</option>)}</select>{staff && !ticket.assigneeId && ticket.status === 'OPEN' && <span className={styles.fieldHelp}>Assign a teammate to start work.</span>}</div>
            <div className="field"><label htmlFor={staff ? 'ticket-priority' : undefined}>Priority</label>{staff ? <select id="ticket-priority" className="select" value={ticket.priority} disabled={disabled} onChange={event => {void patch({priority: event.target.value}, 'Priority updated.');}}>{PRIORITIES.map(priority => <option key={priority} value={priority}>{label(priority)}</option>)}</select> : <div className={styles.readOnlyValue}><PriorityBadge priority={ticket.priority}/></div>}</div>
            <div className="field"><label htmlFor={staff ? 'ticket-category' : undefined}>Category</label>{staff ? <select id="ticket-category" className="select" value={ticket.category} disabled={disabled} onChange={event => {void patch({category: event.target.value}, 'Category updated.');}}>{CATEGORIES.map(category => <option key={category} value={category}>{label(category)}</option>)}</select> : <div className={styles.readOnlyValue}><CategoryBadge category={ticket.category}/></div>}</div>
            <div className="field"><label htmlFor={staff ? 'ticket-assignee' : undefined}>Assigned to</label>{staff ? <><select id="ticket-assignee" className="select" value={ticket.assigneeId ?? ''} disabled={disabled || agents.loading || Boolean(agents.error)} onChange={event => {void patch({assigneeId: event.target.value || null}, 'Assignment updated.');}}><option value="" disabled={['IN_PROGRESS', 'RESOLVED'].includes(ticket.status)}>Unassigned</option>{agents.data?.items.map(agent => <option key={agent.id} value={agent.id}>{agent.name}{agent.id === user?.id ? ' (you)' : ''}</option>)}</select>{agents.error && <span className={styles.agentError}>Couldn’t load teammates. <button type="button" onClick={agents.reload}>Try again</button></span>}</> : <div className={styles.personValue}>{ticket.assignee && <Avatar name={ticket.assignee.name} small/>}<span>{ticket.assignee?.name ?? 'Unassigned'}</span></div>}</div>
          </div>
          <div className={styles.propertyDates}><div><span>Created</span><time dateTime={ticket.createdAt}>{formatDate(ticket.createdAt)}</time></div>{ticket.resolvedAt && <div><span>Resolved</span><time dateTime={ticket.resolvedAt}>{formatDate(ticket.resolvedAt)}</time></div>}<div><span>Requester</span><span title={ticket.requester?.email}>{ticket.requester?.name ?? 'Customer'}</span></div></div>
        </section>

        <section className={`card ${styles.aiCard}`} aria-labelledby="ai-heading">
          <div className={styles.aiHeader}><div className={styles.aiIcon}><Sparkles size={17}/></div><div><h2 id="ai-heading">A little clarity, from AI</h2><p>Suggested triage</p></div></div>
          <div className={styles.aiBody}><div className={styles.aiLabels}><CategoryBadge category={ticket.ai.category}/><PriorityBadge priority={ticket.ai.priority}/></div><div className={styles.confidenceRow}><span>{needsReview ? 'Needs manual review' : 'Relative confidence'}</span><strong>{Math.round(ticket.ai.confidence * 100)}%</strong></div><div className={styles.confidenceTrack} aria-hidden="true"><span style={{width: `${Math.max(0, Math.min(100, ticket.ai.confidence * 100))}%`}}/></div><p className={styles.aiCaveat}>A model score, not a guarantee. Review suggestions before applying.</p><div className={styles.aiSummary}><span>At a glance</span><p>{ticket.ai.summary}</p></div>
            <details className={styles.reasoning}><summary>How this was suggested<ChevronDown size={14}/></summary><ul>{ticket.ai.explanation.map((item, index) => <li key={index}>{item}</li>)}</ul><span className={styles.modelVersion}>Processed locally</span></details>
            {staff && <><button type="button" className={`btn btn-secondary btn-small ${styles.fullWidth}`} disabled={disabled || closed} onClick={() => {setBody(ticket.ai.suggestedReply); setInternal(false); setTab('conversation'); setNotice('Suggested reply added to your draft. Review and edit it before sending.'); setError(null); requestAnimationFrame(() => document.getElementById('reply-body')?.focus());}}><Sparkles size={14}/>Use suggested reply<ArrowUpRight size={13}/></button><p className={styles.templateHint}>Adds an editable template to your draft.</p><div className={styles.aiActions}><button type="button" className={styles.textButton} disabled={disabled} onClick={() => {void mutate('triage', () => api(`/tickets/${id}/triage`, {method: 'POST', body: {version: ticket.version, apply: false}}), 'Analysis refreshed.');}}>{busy === 'triage' ? <Spinner small/> : <Sparkles size={13}/>}Refresh analysis</button><button type="button" className={styles.textButton} disabled={disabled} onClick={() => {void mutate('apply', () => api(`/tickets/${id}/triage`, {method: 'POST', body: {version: ticket.version, apply: true}}), 'Suggested category and priority applied.');}}>{busy === 'apply' ? <Spinner small/> : <Check size={13}/>}Apply suggestions</button></div></>}
          </div>
        </section>

        {canDelete && <div className={styles.deleteSection}>{confirmDelete ? <div className={styles.deleteConfirm} role="alertdialog" aria-labelledby="delete-title" aria-describedby="delete-description" onKeyDown={event => {if (event.key === 'Escape' && !disabled) {event.preventDefault(); cancelDelete();}}}><h3 id="delete-title">Delete {ticketNumber(ticket.number)}?</h3><p id="delete-description">This ticket will be removed from the workspace. Its conversation history is retained.</p><div><button id="cancel-ticket-delete" className="btn btn-secondary btn-small" type="button" onClick={cancelDelete} disabled={disabled}><X size={13}/>Cancel</button><button type="button" className={styles.deleteButton} disabled={disabled} onClick={() => {void deleteTicket();}}>{busy === 'delete' ? <Spinner small/> : <Trash2 size={13}/>}Delete ticket</button></div></div> : <button id="delete-ticket-launch" type="button" className={styles.deleteLink} onClick={() => {setConfirmDelete(true); requestAnimationFrame(() => document.getElementById('cancel-ticket-delete')?.focus());}} disabled={disabled}><Trash2 size={14}/>Delete ticket</button>}</div>}
      </aside>
    </div>
  </div>;
}
