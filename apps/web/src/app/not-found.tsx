import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="standalone-state">
      <span className="eyebrow">404 · LOST IN THE QUEUE</span>
      <h1>This page isn’t here.</h1>
      <p>Let’s get you back to your workspace.</p>
      <Link className="button primary" href="/dashboard">
        Back to dashboard
      </Link>
    </main>
  );
}
