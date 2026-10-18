'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, FileText, Lightbulb, ShieldCheck, Sparkles } from 'lucide-react';
import { PageHeading, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { label } from '@/lib/format';
import { CATEGORIES, PRIORITIES, type Category, type Priority, type Ticket } from '@/lib/types';
import styles from '@/components/ticket-form.module.css';

function titleError(value: string) {
  if (value.trim().length < 5) return 'Add a clear title with at least 5 characters.';
  if (value.trim().length > 160) return 'Keep the title within 160 characters.';
  return '';
}

function descriptionError(value: string) {
  if (value.trim().length < 15) return 'Describe the issue in at least 15 characters so we can help.';
  if (value.trim().length > 10000) return 'Keep the description within 10,000 characters.';
  return '';
}

export default function NewTicketPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category | ''>('');
  const [priority, setPriority] = useState<Priority | ''>('');
  const [errors, setErrors] = useState({ title: '', description: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const nextErrors = { title: titleError(title), description: descriptionError(description) };
    setErrors(nextErrors);
    if (nextErrors.title || nextErrors.description) {
      if (nextErrors.title) titleRef.current?.focus();
      else descriptionRef.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const ticket = await api<Ticket>('/tickets', {
        method: 'POST', body: {
          title: title.trim(), description: description.trim(),
          ...(category ? { category } : {}), ...(priority ? { priority } : {}),
        },
      });
      router.push(`/tickets/${ticket.id}?created=1`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'We could not create your ticket. Please try again.');
      setBusy(false);
    }
  }

  return <>
    <Link href="/tickets" className={styles.backLink}><ArrowLeft size={15} />Back to tickets</Link>
    <PageHeading title="Create a ticket" description="Tell us what’s happening. We’ll help you take the next step." />
    <div className={styles.layout}>
      <form className={`card ${styles.formCard}`} noValidate onSubmit={submit} aria-busy={busy}>
        <div className={styles.formHeading}><span className={styles.formIcon}><FileText size={19} /></span><div><h2>Ticket details</h2><p>A few details help us find the right solution.</p></div></div>
        <div className={styles.fields}>
          <div className="field">
            <label htmlFor="ticket-title">Subject <span className={styles.required} aria-hidden="true">*</span></label>
            <input id="ticket-title" ref={titleRef} className="input" type="text" required minLength={5} maxLength={160} disabled={busy}
              placeholder="A short, clear summary of the issue" value={title} aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? 'title-error title-hint' : 'title-hint'}
              onChange={event => { setTitle(event.target.value); if (errors.title) setErrors(previous => ({ ...previous, title: titleError(event.target.value) })); }}
              onBlur={() => setErrors(previous => ({ ...previous, title: title ? titleError(title) : '' }))} />
            <div className={styles.fieldMeta}><span id="title-hint">For example, “Unable to download my invoice”</span><span>{title.length}/160</span></div>
            {errors.title && <p id="title-error" className="form-error" role="alert">{errors.title}</p>}
          </div>
          <div className="field">
            <label htmlFor="ticket-description">Description <span className={styles.required} aria-hidden="true">*</span></label>
            <textarea id="ticket-description" ref={descriptionRef} className={`textarea ${styles.description}`} rows={8} required minLength={15} maxLength={10000} disabled={busy}
              placeholder={'Describe what happened and what you expected instead.\n\nInclude any error messages or steps we can follow to understand the issue.'}
              value={description} aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? 'description-error description-hint' : 'description-hint'}
              onChange={event => { setDescription(event.target.value); if (errors.description) setErrors(previous => ({ ...previous, description: descriptionError(event.target.value) })); }}
              onBlur={() => setErrors(previous => ({ ...previous, description: description ? descriptionError(description) : '' }))} />
            <div className={styles.fieldMeta}><span id="description-hint">Be as specific as you can. At least 15 characters.</span><span>{description.length.toLocaleString()}/10,000</span></div>
            {errors.description && <p id="description-error" className="form-error" role="alert">{errors.description}</p>}
          </div>
          <div className={styles.divider} />
          <div className={styles.preferencesHeading}><h3>Routing preferences</h3><span>Optional</span></div>
          <p className={styles.preferencesDescription}>Let smart triage choose, or set your own preferences.</p>
          <div className={styles.selectRow}>
            <div className="field"><label htmlFor="ticket-category">Category</label>
              <select id="ticket-category" className="select" value={category} disabled={busy} onChange={event => setCategory(event.target.value as Category | '')}>
                <option value="">Automatic suggestion</option>{CATEGORIES.map(value => <option key={value} value={value}>{label(value)}</option>)}
              </select>
            </div>
            <div className="field"><label htmlFor="ticket-priority">Priority</label>
              <select id="ticket-priority" className="select" value={priority} disabled={busy} onChange={event => setPriority(event.target.value as Priority | '')}>
                <option value="">Automatic suggestion</option>{PRIORITIES.map(value => <option key={value} value={value}>{label(value)}</option>)}
              </select>
            </div>
          </div>
          <div className={styles.triageHint}><Sparkles size={16} /><p>Smart triage suggests a category and priority. You stay in control.</p></div>
          {error && <div className={styles.apiError} role="alert"><strong>Your ticket hasn’t been created yet.</strong><p>{error}</p></div>}
        </div>
        <div className={styles.formFooter}><span><ShieldCheck size={14} />Only you and our support team can view this ticket.</span>
          <div className={styles.actions}><Link className="btn btn-secondary" href="/tickets" aria-disabled={busy} onClick={event => { if (busy) event.preventDefault(); }}>Cancel</Link>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? <><Spinner small />Creating ticket…</> : <>Create ticket<ArrowRight size={16} /></>}</button>
          </div>
        </div>
      </form>
      <aside className={styles.sidebar} aria-label="Tips for creating a ticket">
        <div className={`card ${styles.tipsCard}`}><span className={styles.tipsIcon}><Lightbulb size={20} /></span><h2>A little detail goes a long way</h2><p>Help us understand your issue so we can get you back on track sooner.</p>
          <ul><li><Check size={15} /><span>Tell us what you were trying to do.</span></li><li><Check size={15} /><span>Describe what happened, including any error messages.</span></li><li><Check size={15} /><span>Share the steps you have already tried.</span></li></ul>
        </div>
        <div className={styles.aiCard}><div className={styles.aiHeading}><Sparkles size={19} /><span>A smarter starting point</span></div><p>Our local model reads your ticket to suggest a category, priority, and short summary.</p><p>Suggestions can be reviewed and changed by the support team.</p><span className={styles.localPill}><span />Processed locally · No external AI service</span></div>
        <p className={styles.privacyNote}><ShieldCheck size={16} /><span>Please keep passwords, payment card details, and other sensitive information out of your ticket.</span></p>
      </aside>
    </div>
  </>;
}
