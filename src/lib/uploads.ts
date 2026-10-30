import { api } from './api'

export async function uploadImage(file: File) {
  const body = new FormData()
  body.append('file', file)
  const res = await api<{ url: string }>('/api/uploads', { method: 'POST', body })
  if (!res.ok) throw new Error(res.error)
  return res.url
}
