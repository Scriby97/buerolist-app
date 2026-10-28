/** Vor- und Nachname, sonst E-Mail, sonst Fallback (z.B. "?"). */
export function personName(
  person: { firstName?: string | null; lastName?: string | null; email?: string | null } | null | undefined,
  fallback = '',
): string {
  if (!person) return fallback
  const name = `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim()
  return name || person.email || fallback
}
