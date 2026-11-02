// Anzeige der fortlaufenden Nummern: Kunde "001", Projekt "001-26-02"
// (Kundennummer + Jahr + Projektnummer pro Kunde und Jahr). Fehlt eine Nummer (z.B. alte
// Daten waehrend eines Deploys), wird nichts angezeigt statt "undefined".

const pad = (n: number, width: number) => String(n).padStart(width, '0')

/** Nummer einer Material-/Spesen-Vorlage: Material M-001, Spesen S-001. */
export function formatPresetNumber(type: 'material' | 'expense', number: number): string {
  return `${type === 'material' ? 'M' : 'S'}-${pad(number, 3)}`
}

/** Abwesenheitsgrund: A-001, A-002, ... */
export function formatAbsenceReasonNumber(number: number): string {
  return `A-${pad(number, 3)}`
}

/** "A-001 Krankheit" bzw. ein eigener Grund ohne Nummer. */
export function absenceReasonLabel(reason: { number: number | null; name: string }): string {
  return reason.number ? `${formatAbsenceReasonNumber(reason.number)} ${reason.name}` : reason.name
}

export function formatCustomerNumber(customerNumber?: number | null): string {
  return customerNumber ? pad(customerNumber, 3) : ''
}

/** Kunde-Jahr-Nummer, z.B. (16, 1, 2026) -> "016-26-01". Ohne Jahr (aelteres Backend) "016-01". */
export function formatProjectNumber(
  customerNumber?: number | null,
  projectNumber?: number | null,
  year?: number | null,
): string {
  if (!customerNumber || !projectNumber) return ''
  const yearPart = year ? `-${pad(year % 100, 2)}` : ''
  return `${pad(customerNumber, 3)}${yearPart}-${pad(projectNumber, 2)}`
}

/** "001-26-02 Kunde – Projekt" bzw. ohne Nummer "Kunde – Projekt". */
export function projectDisplayName(
  project: { title: string; number?: number | null; year?: number | null },
  customer?: { name: string; number?: number | null } | null,
): string {
  const number = formatProjectNumber(customer?.number, project.number, project.year)
  const name = customer?.name ? `${customer.name} – ${project.title}` : project.title
  return number ? `${number} ${name}` : name
}
