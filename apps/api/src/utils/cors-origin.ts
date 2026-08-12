/**
 * Resolve allowed CORS origins for HTTP and Socket.IO.
 * In development, any localhost / 127.0.0.1 port is accepted so Vite
 * fallbacks (5174, 5175, …) do not break register/login.
 */
export function resolveCorsOrigin(
  configured?: string | null,
): boolean | string | RegExp | Array<string | RegExp> {
  const value = configured?.trim() || 'http://localhost:5173';

  if (value === '*') {
    return true;
  }

  const list = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    return [...list, /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];
  }

  return list.length === 1 ? list[0] : list;
}
