export function normalizePhone(phone?: string | null): string | null {
  if (!phone) {
    return null
  }

  const normalized = phone.replace(/\D/g, '')

  return normalized || null
}

export function normalizeEmail(email?: string | null): string | null {
  if (!email) {
    return null
  }

  const normalized = email.trim().toLowerCase()

  return normalized || null
}

export function normalizeDocument(document?: string | null): string | null {
  if (!document) {
    return null
  }

  const normalized = document.replace(/[^\p{L}\p{N}]/gu, '')

  return normalized || null
}

export function normalizeInterestKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
