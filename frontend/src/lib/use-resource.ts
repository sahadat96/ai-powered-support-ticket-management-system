'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
export function useResource<T>(path: string | null) {
  const [state, setState] = useState<{ key: string | null; data: T | null; error: string | null }>({
    key: null,
    data: null,
    error: null,
  });
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  const key = `${path}:${revision}`;
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    api<T>(path, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setState({ key, data, error: null });
      })
      .catch((error: Error) => {
        if (!controller.signal.aborted) setState({ key, data: null, error: error.message });
      });
    return () => controller.abort();
  }, [path, key]);
  return {
    data: state.key === key ? state.data : null,
    error: state.key === key ? state.error : null,
    loading: !!path && state.key !== key,
    reload,
  };
}
