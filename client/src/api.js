let csrfToken = '';

export function setCsrfToken(token) {
  csrfToken = token ?? '';
}

export async function apiRequest(path, options = {}) {
  const method = (options.method ?? 'GET').toUpperCase();
  const headers = new Headers(options.headers ?? {});
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken) headers.set('X-CSRF-Token', csrfToken);

  let response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      method,
      headers,
      credentials: 'include',
    });
  } catch {
    throw new Error('API belum tersambung. Pastikan backend dan MySQL sedang berjalan.');
  }

  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message ?? 'Permintaan gagal.');
  return payload;
}

export function get(path) {
  return apiRequest(path);
}

export function post(path, body) {
  return apiRequest(path, { method: 'POST', body: JSON.stringify(body) });
}

export function put(path, body) {
  return apiRequest(path, { method: 'PUT', body: JSON.stringify(body) });
}

export function remove(path) {
  return apiRequest(path, { method: 'DELETE' });
}
