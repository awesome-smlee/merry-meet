export function isAllowedRequestOrigin(req) {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  const url = new URL(req.url);
  if (origin === url.origin) return true;
  // Next dev may construct req.url with its bind address (0.0.0.0).
  // The browser's Host still identifies the address actually requested.
  if (process.env.NODE_ENV !== 'development') return false;
  const host = req.headers.get('host');
  if (!host || /[\s/@\\?#]/.test(host)) return false;
  try {
    const requested = new URL(`${url.protocol}//${host}`);
    return requested.port === url.port && origin === requested.origin;
  } catch {
    return false;
  }
}
