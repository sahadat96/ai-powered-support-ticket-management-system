import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="standalone-state">
      <span className="eyebrow">404 · Lost in the queue</span>
      <h1>This page isn’t here.</h1>
      <p>Let’s get you back to your workspace.</p>
      <Link className="btn btn-primary" href="/dashboard">
        Back to overview
      </Link>
    </main>
  );
}
