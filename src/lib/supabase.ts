/** Configuración pública de Supabase (ver .env.example). */
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';

/** GET a una Edge Function pública. Lanza `FunctionError` si responde con error. */
export async function callFunction<T>(name: string, params: Record<string, string>, signal?: AbortSignal): Promise<T> {
  if (!SUPABASE_URL) throw new FunctionError('config', 'Falta EXPO_PUBLIC_SUPABASE_URL en .env.local');
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}?${qs}`, {
    headers: { apikey: SUPABASE_KEY },
    signal,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new FunctionError(body?.error ?? `http_${res.status}`, body?.message ?? `Error ${res.status}`);
  return body as T;
}

export class FunctionError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
