async function call(method: string, url: string, body?: unknown) {
  try {
    const r = await fetch('/api' + url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
    const d = await r.json().catch(() => null)
    if (!r.ok) throw new Error(d?.error || 'Something went wrong. Please try again.')
    return d
  } catch (e: any) {
    if (e instanceof TypeError) throw new Error("Can't reach the server. Check your connection and try again.")
    throw e
  }
}
export const api = { get: (u: string) => call('GET', u), post: (u: string, b: unknown) => call('POST', u, b), put: (u: string, b: unknown) => call('PUT', u, b), del: (u: string) => call('DELETE', u) }
