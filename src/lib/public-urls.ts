function normalizeBaseUrl(value: string | undefined) {
  return value?.trim().replace(/\/+$/, '') || null
}

export function getFrontendUrl() {
  return normalizeBaseUrl(process.env.FRONTEND_URL)
}

export function getApiPublicUrl() {
  return normalizeBaseUrl(process.env.API_PUBLIC_URL)
}

export function getSocketPublicUrl() {
  return normalizeBaseUrl(
    process.env.SOCKET_PUBLIC_URL ??
      process.env.API_PUBLIC_URL
  )
}

export function buildPublicUrl(baseUrl: string | null, path: string) {
  if (!baseUrl) {
    return null
  }

  return `${baseUrl}/${path.replace(/^\/+/, '')}`
}
