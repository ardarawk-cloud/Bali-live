type ApiResult<T = any> = { data: T; status: number };

async function request<T = any>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<ApiResult<T>> {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof data === 'object' && data && 'error' in data
        ? String((data as any).error)
        : 'Request failed';
    throw new Error(message);
  }

  return { data: data as T, status: response.status };
}

export const api = {
  get<T = any>(path: string) {
    return request<T>('GET', path);
  },
  post<T = any>(path: string, body?: unknown) {
    return request<T>('POST', path, body);
  },
};
