import { z } from 'zod'

function normalizeBaseUrl(url: string | undefined) {
  if (!url) {
    return null
  }

  return url.replace(/\/+$/, '')
}

const r2PublicBaseUrl =
  normalizeBaseUrl(process.env.R2_PUBLIC_URL)

export const r2UrlSchema = z.string()
  .url()
  .refine(value => {
    if (!r2PublicBaseUrl) {
      return true
    }

    return value.startsWith(`${r2PublicBaseUrl}/`)
  }, {
    message: 'A URL deve apontar para o Cloudflare R2 configurado'
  })
