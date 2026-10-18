'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="standalone-state">
      <h1>Something went wrong.</h1>
      <p>Try loading this page again.</p>
      <button className="btn btn-primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
