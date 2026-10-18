'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import {
  ArrowRight, Check, CheckCheck, Eye, EyeOff, Headphones,
  Layers2, MessageSquare, ShieldCheck, Sparkles, UserRound,
} from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { Spinner } from '@/components/ui';
import styles from './auth-form.module.css';

type Field = 'name' | 'email' | 'password';
type Fields = Record<Field, string>;
type FieldErrors = Partial<Record<Field, string>>;
type Mode = 'login' | 'register';

const demoPassword = process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? '';
const showDemo = process.env.NEXT_PUBLIC_SHOW_DEMO === 'true' && Boolean(demoPassword);
const demoRoles = [
  { label: 'Customer', email: 'customer@support.local', icon: UserRound },
  { label: 'Agent', email: 'agent@support.local', icon: Headphones },
  { label: 'Admin', email: 'admin@support.local', icon: ShieldCheck },
] as const;

function validate(values: Fields, mode: Mode): FieldErrors {
  const errors: FieldErrors = {};
  if (mode === 'register' && (!values.name.trim() || Array.from(values.name.trim()).length > 100)) {
    errors.name = 'Enter your name using 1–100 characters.';
  }
  if (values.email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }
  if (Array.from(values.password).length < 10) {
    errors.password = 'Use at least 10 characters for your password.';
  } else if (new TextEncoder().encode(values.password).length > 72) {
    errors.password = 'Use a shorter password. Some symbols take up more space.';
  }
  return errors;
}

function Brand({ compact = false }: { compact?: boolean }) {
  return <span className={`${styles.brand} ${compact ? styles.compactBrand : ''}`}>
    <span className={styles.brandIcon}><Layers2 size={23} strokeWidth={1.8} aria-hidden="true" /></span>
    <span>relay<span className={styles.brandDot}>.</span></span>
  </span>;
}

function StoryPanel() {
  return <aside className={styles.story} aria-label="Welcome to Relay">
    <Brand />
    <div className={styles.storyBody}>
      <p className={styles.storyEyebrow}><span /> SUPPORT, IN SYNC</p>
      <h2>Less friction.<br />More connection.</h2>
      <p className={styles.storyDescription}>A calmer place for your support conversations. Bring your team together, find the next step, and keep things moving.</p>
      <div className={styles.illustration} aria-hidden="true">
        <div className={styles.orbitOne} />
        <div className={styles.orbitTwo} />
        <div className={styles.previewCard}>
          <div className={styles.previewTop}><span className={styles.previewId}>REL-1042</span><span className={styles.previewStatus}><Check size={11} />Resolved</span></div>
          <h3>Back to business.</h3>
          <p>Your workspace is ready to go.</p>
          <div className={styles.previewDivider} />
          <div className={styles.previewBottom}><span className={styles.previewAvatar}>JL</span><div><strong>Jordan Lee</strong><span>Here to help</span></div><span className={styles.previewMessage}><MessageSquare size={14} />3</span></div>
        </div>
        <div className={styles.aiChip}><span><Sparkles size={17} /></span><div><strong>A little help from AI</strong><span>Clear context. Thoughtful next steps.</span></div></div>
        <div className={styles.connectionDot}><CheckCheck size={21} /></div>
      </div>
      <div className={styles.storyFeatures}><span><Check size={14} />Shared context</span><span><Check size={14} />Clear ownership</span><span><Check size={14} />Smarter triage</span></div>
    </div>
    <p className={styles.storyFooter}>Good support starts with a little clarity.</p>
  </aside>;
}

export function AuthForm({ mode }: { mode: Mode }) {
  const registering = mode === 'register';
  const auth = useAuth();
  const router = useRouter();
  const formId = useId();
  const [values, setValues] = useState<Fields>({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (auth.user && !auth.loading) router.replace('/dashboard');
  }, [auth.user, auth.loading, router]);

  function update(field: Field, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
    setServerError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || auth.loading) return;
    const nextErrors = validate(values, mode);
    setErrors(nextErrors);
    setServerError(null);
    const firstError = (['name', 'email', 'password'] as Field[]).find((field) => nextErrors[field]);
    if (firstError) {
      ({ name: nameRef, email: emailRef, password: passwordRef })[firstError].current?.focus();
      return;
    }
    setSubmitting(true);
    try {
      const email = values.email.trim().toLowerCase();
      if (registering) await auth.register(values.name.trim(), email, values.password);
      else await auth.login(email, values.password);
    } catch (error: unknown) {
      setServerError(error instanceof Error ? error.message : 'We couldn’t complete that request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const visibleError = serverError ?? auth.error;
  const openingWorkspace = auth.loading || Boolean(auth.user);

  return <main className={styles.shell}>
    <StoryPanel />
    <section className={styles.formSection} aria-label={registering ? 'Create your account' : 'Sign in to your account'}>
      <div className={styles.mobileBrand}><Brand compact /></div>
      <div className={styles.accountPrompt}>
        <span>{registering ? 'Already have an account?' : 'New to Relay?'}</span>
        <Link href={registering ? '/login' : '/register'}>{registering ? 'Sign in' : 'Create an account'}<ArrowRight size={14} aria-hidden="true" /></Link>
      </div>
      <div className={styles.formWrap}>
        {openingWorkspace ? <div className={styles.opening} role="status"><Spinner /><p>{auth.user ? 'Opening your workspace…' : 'Getting things ready…'}</p></div> : <>
          <div className={styles.formHeading}>
            <span className={styles.headingIcon}>{registering ? <UserRound size={22} aria-hidden="true" /> : <Layers2 size={22} aria-hidden="true" />}</span>
            <p className={styles.formEyebrow}>YOUR SUPPORT WORKSPACE</p>
            <h1>{registering ? 'Make room for better support.' : 'Welcome back.'}</h1>
            <p>{registering ? 'Create your account and keep every conversation in one place.' : 'Sign in to bring your support conversations into focus.'}</p>
          </div>
          <form onSubmit={submit} noValidate aria-busy={submitting} className={styles.form}>
            {visibleError && <div className={`form-error ${styles.error}`} role="alert">{visibleError}</div>}
            {registering && <div className="field">
              <label htmlFor={`${formId}-name`}>Full name</label>
              <input ref={nameRef} className="input" id={`${formId}-name`} name="name" type="text" autoComplete="name" placeholder="Alex Morgan" value={values.name} onChange={(event) => update('name', event.target.value)} maxLength={100} required disabled={submitting} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? `${formId}-name-error` : undefined} />
              {errors.name && <p className={styles.fieldError} id={`${formId}-name-error`}>{errors.name}</p>}
            </div>}
            <div className="field">
              <label htmlFor={`${formId}-email`}>Email address</label>
              <input ref={emailRef} className="input" id={`${formId}-email`} name="email" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} placeholder="you@example.com" value={values.email} onChange={(event) => update('email', event.target.value)} maxLength={254} required disabled={submitting} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? `${formId}-email-error` : undefined} />
              {errors.email && <p className={styles.fieldError} id={`${formId}-email-error`}>{errors.email}</p>}
            </div>
            <div className="field">
              <label htmlFor={`${formId}-password`}>Password</label>
              <div className={styles.passwordWrap}>
                <input ref={passwordRef} className="input" id={`${formId}-password`} name="password" type={passwordVisible ? 'text' : 'password'} autoComplete={registering ? 'new-password' : 'current-password'} placeholder={registering ? 'Create a strong password' : 'Enter your password'} value={values.password} onChange={(event) => update('password', event.target.value)} minLength={10} maxLength={72} required disabled={submitting} aria-invalid={Boolean(errors.password)} aria-describedby={`${formId}-password-${errors.password ? 'error' : 'hint'}`} />
                <button type="button" className={styles.passwordToggle} onClick={() => setPasswordVisible((visible) => !visible)} aria-label={passwordVisible ? 'Hide password' : 'Show password'} aria-controls={`${formId}-password`} disabled={submitting}>{passwordVisible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button>
              </div>
              {errors.password ? <p className={styles.fieldError} id={`${formId}-password-error`}>{errors.password}</p> : <p className={styles.fieldHint} id={`${formId}-password-hint`}>{registering ? 'At least 10 characters. Make it something only you know.' : 'Your conversations are just a sign-in away.'}</p>}
            </div>
            <button className={`btn btn-primary ${styles.submit}`} type="submit" disabled={submitting}>{submitting ? <><Spinner small />{registering ? 'Creating your account…' : 'Signing in…'}</> : <>{registering ? 'Create account' : 'Sign in'}<ArrowRight size={17} aria-hidden="true" /></>}</button>
          </form>
          {!registering && showDemo && <div className={styles.demo}>
            <div className={styles.demoDivider}><span />Explore the demo<span /></div>
            <div className={styles.demoButtons}>{demoRoles.map(({ label, email, icon: Icon }) => <button key={email} className={styles.demoButton} type="button" disabled={submitting} onClick={() => {
              setValues((previous) => ({ ...previous, email, password: demoPassword }));
              setErrors({});
              setServerError(null);
              emailRef.current?.focus();
            }} aria-pressed={values.email === email}><Icon size={16} aria-hidden="true" />{label}</button>)}</div>
            <p className={styles.demoHint}>Choose a role to fill the form, then sign in.</p>
          </div>}
          <p className={styles.formFooter}><ShieldCheck size={15} aria-hidden="true" />A little less busy. A lot more together.</p>
        </>}
      </div>
      <p className={styles.pageFooter}>Relay · Support, in sync</p>
    </section>
  </main>;
}
