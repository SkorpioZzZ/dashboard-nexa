const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000'

export async function api(path, options = {}) {
  const response = await fetch(`${API_URL}/api${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })

  if (!response.ok) {
    const result = response.status === 204 ? {} : await response.json().catch(() => ({}))
    throw new Error(result.error || 'Impossible de contacter le serveur.')
  }

  return response.status === 204 ? null : response.json()
}
