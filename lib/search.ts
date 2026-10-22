import { formatCustomerNumber } from '@/lib/format/numbers'

/** Kleinbuchstaben ohne Akzente - "Müller" findet auch "muller". */
export const normalizeSearchText = (text: string) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/** Suchwoerter einer Eingabe (leer = alles anzeigen). */
export const searchTokens = (query: string) => normalizeSearchText(query).split(/\s+/).filter(Boolean)

interface SearchableCustomer {
  name: string
  number?: number | null
  contactEmail?: string | null
  contactPhone?: string | null
  address?: string | null
}

/**
 * Kunden-Typeahead: alle Suchwoerter muessen in Nummer ("001" oder "1"),
 * Name, E-Mail, Telefon oder Adresse vorkommen.
 */
export function filterCustomers<T extends SearchableCustomer>(customers: T[], query: string): T[] {
  const tokens = searchTokens(query)
  if (tokens.length === 0) return customers
  return customers.filter((customer) => {
    const number = customer.number ? `${formatCustomerNumber(customer.number)} ${customer.number}` : ''
    const haystack = normalizeSearchText(
      [number, customer.name, customer.contactEmail, customer.contactPhone, customer.address].filter(Boolean).join(' '),
    )
    return tokens.every((token) => haystack.includes(token))
  })
}
