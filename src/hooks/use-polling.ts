import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

export type PollingState<T> = {
  data: T | null;
  error: Error | null;
  /** true solo durante la primera carga (sin datos previos). */
  loading: boolean;
  updatedAt: number | null;
};

/**
 * Llama a `load` al montar y cada `intervalMs` mientras la app está en primer plano.
 * Conserva el último dato bueno si una actualización falla. `key` reinicia el ciclo.
 */
export function usePolling<T>(key: string | null, load: (signal: AbortSignal) => Promise<T>, intervalMs: number): PollingState<T> {
  const [state, setState] = useState<PollingState<T> & { key: string | null }>({
    key,
    data: null,
    error: null,
    loading: !!key,
    updatedAt: null,
  });

  // Al cambiar de clave, reiniciamos el estado durante el render (patrón recomendado por React).
  if (state.key !== key) setState({ key, data: null, error: null, loading: !!key, updatedAt: null });

  useEffect(() => {
    if (!key) return;
    let controller: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let active = AppState.currentState === 'active' || AppState.currentState == null;

    const tick = async () => {
      controller?.abort();
      controller = new AbortController();
      try {
        const data = await load(controller.signal);
        setState((s) => ({ ...s, data, error: null, loading: false, updatedAt: Date.now() }));
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        setState((s) => ({ ...s, error: e as Error, loading: false }));
      }
      if (active) timer = setTimeout(tick, intervalMs);
    };

    const sub = AppState.addEventListener('change', (next) => {
      const nowActive = next === 'active';
      if (nowActive && !active) {
        active = true;
        clearTimeout(timer);
        tick();
      } else if (!nowActive) {
        active = false;
        clearTimeout(timer);
      }
    });

    tick();
    return () => {
      sub.remove();
      clearTimeout(timer);
      controller?.abort();
    };
    // `load` se recrea en cada render; el ciclo depende solo de la clave.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, intervalMs]);

  return { data: state.data, error: state.error, loading: state.loading, updatedAt: state.updatedAt };
}
