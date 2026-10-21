// Anzeige der fortlaufenden Nummern: Kunde "001", Projekt "001-02"
// (Kundennummer + Projektnummer pro Kunde). Fehlt eine Nummer (z.B. alte
// Daten waehrend eines Deploys), wird nichts angezeigt statt "undefined".

const pad = (n: number, width: number) => String(n).padStart(width, '0')

export function formatCustomerNumber(customerNumber?: number | null): string {
  return customerNumber ? pad(customerNumber, 3) : ''
}

export function formatProjectNumber(customerNumber?: number | null, projectNumber?: number | null): string {
  return customerNumber && projectNumber ? `${pad(customerNumber, 3)}-${pad(projectNumber, 2)}` : ''
}

/** "001-02 Kunde – Projekt" bzw. ohne Nummer "Kunde – Projekt". */
export function projectDisplayName(
  project: { title: string; number?: number | null },
  customer?: { name: string; number?: number | null } | null,
): string {
  const number = formatProjectNumber(customer?.number, project.number)
  const name = customer?.name ? `${customer.name} – ${project.title}` : project.title
  return number ? `${number} ${name}` : name
}
