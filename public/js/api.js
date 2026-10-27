export class ApiError extends Error {
  constructor(status, message, payload = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fields = payload.fields || {};
    this.payload = payload;
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(path, {
      method,
      headers: body === undefined ? { accept: 'application/json' } : {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError(0, 'Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi.');
  }

  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { error: text.slice(0, 200) };
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload.error ||
        (response.status === 401
          ? 'Sesi berakhir. Silakan masuk kembali.'
          : `Permintaan gagal (HTTP ${response.status}).`),
      payload,
    );
  }
  return payload;
}
