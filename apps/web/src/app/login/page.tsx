'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Eye,
  EyeOff,
  Layers2,
  LoaderCircle,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { ErrorMessage } from '@/components/ui';

export default function LoginPage() {
  const { user, loading, signIn } = useAuth();
  const router = useRouter();
  const [register, setRegister] = useState(false);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [user, loading, router]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      await signIn(
        {
          email: String(data.get('email')),
          password: String(data.get('password')),
          ...(register ? { name: String(data.get('name')) } : {}),
        },
        register,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-story">
        <Link href="/" className="brand">
          <span className="brand-icon">
            <Layers2 size={23} />
          </span>
          relay<span className="brand-period">.</span>
        </Link>
        <div className="auth-story-content">
          <span className="eyebrow light">
            <span className="live-dot" /> A LITTLE CLARITY. A LOT OF PROGRESS.
          </span>
          <h1>
            Great support
            <br />
            starts with
            <br />
            <span>being in sync.</span>
          </h1>
          <p>
            One calm workspace for every conversation.
            <br />
            Turn incoming issues into moving-forward moments.
          </p>
          <div className="story-card">
            <div className="story-card-top">
              <span className="ai-orb">
                <Sparkles size={19} />
              </span>
              <strong>A head start on every ticket</strong>
              <ArrowUpRight size={18} />
            </div>
            <p>
              AI-assisted triage finds the right category and helps your team
              focus on what matters.
            </p>
            <div className="story-card-footer">
              <span>
                <Check size={13} /> Local classification
              </span>
              <span>
                <Check size={13} /> Human decisions
              </span>
            </div>
          </div>
        </div>
        <div className="auth-story-bottom">
          BUILT FOR PEOPLE. POWERED BY CLARITY.<span>01 — 03</span>
        </div>
      </section>
      <section className="auth-form-area">
        <div className="auth-form-wrap">
          <span className="eyebrow">YOUR SUPPORT WORKSPACE</span>
          <h2>
            {register ? 'Make room for better support.' : 'Welcome back.'}
          </h2>
          <p className="muted">
            {register
              ? 'Create an account and let’s get your first issue sorted.'
              : 'Good to see you. Let’s get things moving.'}
          </p>
          <form onSubmit={submit} className="auth-form">
            {error && <ErrorMessage message={error} />}
            {register && (
              <label>
                Full name
                <input
                  name="name"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={80}
                  placeholder="Your name"
                />
              </label>
            )}
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                placeholder="you@company.com"
              />
            </label>
            <label>
              Password
              <div className="password-input">
                <input
                  name="password"
                  type={show ? 'text' : 'password'}
                  autoComplete={register ? 'new-password' : 'current-password'}
                  required
                  minLength={register ? 10 : 8}
                  maxLength={64}
                  pattern={register ? '(?=.*[A-Za-z])(?=.*[0-9]).+' : undefined}
                  title={
                    register
                      ? 'At least 10 characters, including a letter and number'
                      : undefined
                  }
                  placeholder={
                    register
                      ? 'At least 10 characters, a letter and number'
                      : 'Enter your password'
                  }
                />
                <button
                  type="button"
                  aria-label={show ? 'Hide password' : 'Show password'}
                  onClick={() => setShow(!show)}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            <button
              className="button primary auth-submit"
              disabled={busy || loading}
            >
              {busy ? (
                <LoaderCircle size={18} className="spin" />
              ) : (
                <>
                  {register ? 'Create account' : 'Sign in to your workspace'}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
          <p className="auth-switch">
            {register ? 'Already have an account?' : 'New around here?'}{' '}
            <button
              onClick={() => {
                setRegister(!register);
                setError('');
              }}
            >
              {register ? 'Sign in' : 'Create an account'}{' '}
              <ArrowUpRight size={13} />
            </button>
          </p>
          <div className="demo-note">
            <span className="small-label">EXPLORING THE DEMO?</span>
            <p>
              Use <strong>admin@support.local</strong>,{' '}
              <strong>agent@support.local</strong>, or{' '}
              <strong>customer@support.local</strong> with the demo password
              from your project setup.
            </p>
          </div>
        </div>
        <div className="auth-legal">
          A clearer way to care for your customers.
          <span>© {new Date().getFullYear()} Relay</span>
        </div>
      </section>
    </main>
  );
}
