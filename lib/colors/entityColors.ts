import type { CSSProperties } from 'react'

/*
 * Erkennungsfarben fuer Kunden und Projekte - rein aus den Nummern
 * abgeleitet, damit ein Projekt bei jedem Benutzer/Geraet dieselbe Farbe hat
 * (nichts wird gespeichert):
 *
 * - Kunde  -> eine von 10 Grundfarben:  (Kundennummer - 1) % 10
 * - Projekt -> eine von 10 Abwandlungen dieser Grundfarbe (etwas heller/
 *   dunkler, leicht verschobener Farbton): (Projektnummer - 1) % 10
 *
 * Die Farben sind nur dezente Markierungen (Streifen, Punkte) - Nummer und
 * Name stehen immer daneben, die Farbe ist eine Zusatzhilfe.
 *
 * Die Reihenfolge der Grundfarben ist mit dem dataviz-Palettenvalidator
 * gesucht und geprueft: aufeinanderfolgende Kunden (inkl. 010 -> 011) sind
 * auch bei Rot-Gruen-Schwaeche deutlich unterscheidbar (hell: CVD-dE 19.8,
 * Normalsicht-dE 25.4; dunkel: 17.3 / 22.5 - Ziel >= 8 bzw. >= 15). Die
 * Helligkeit wechselt dazu zwischen benachbarten Kunden ab.
 */

/** Farbtoene (OKLCH-Hue) der 10 Grundfarben in Vergabereihenfolge. */
export const CUSTOMER_HUES = [150, 330, 120, 290, 85, 180, 55, 205, 25, 250] as const

const CHROMA = 0.13

/** Grundhelligkeit je Modus, abwechselnd fuer benachbarte Kunden. */
const BASE_LIGHTNESS = { light: [0.5, 0.68], dark: [0.52, 0.66] } as const

/** Zulaessiges Helligkeitsband je Modus (gut sichtbar auf der Flaeche). */
const LIGHTNESS_BAND = { light: [0.45, 0.75], dark: [0.48, 0.74] } as const

/**
 * Abwandlungen fuer die Projekte eines Kunden: [Helligkeits-Delta, Hue-Delta].
 * Index 0 = Grundfarbe des Kunden.
 */
const PROJECT_SHADES: readonly (readonly [number, number])[] = [
  [0, 0],
  [0.1, -6],
  [-0.08, 8],
  [0.05, 18],
  [-0.04, -18],
  [0.12, 10],
  [-0.1, -10],
  [0.02, -28],
  [0.08, 28],
  [-0.06, 0],
]

export interface EntityColor {
  light: string
  dark: string
}

const NEUTRAL: EntityColor = { light: 'oklch(0.7 0 0)', dark: 'oklch(0.55 0 0)' }

const clamp = (value: number, [min, max]: readonly [number, number]) => Math.min(max, Math.max(min, value))
const mod10 = (n: number) => (((n - 1) % 10) + 10) % 10

function color(customerNumber: number, shadeIndex: number): EntityColor {
  const slot = mod10(customerNumber)
  const [deltaL, deltaH] = PROJECT_SHADES[shadeIndex]
  const hue = (CUSTOMER_HUES[slot] + deltaH + 360) % 360
  const make = (mode: 'light' | 'dark') => {
    const lightness = clamp(BASE_LIGHTNESS[mode][slot % 2] + deltaL, LIGHTNESS_BAND[mode])
    return `oklch(${lightness.toFixed(3)} ${CHROMA} ${hue})`
  }
  return { light: make('light'), dark: make('dark') }
}

/** Grundfarbe eines Kunden (grau, solange keine Nummer bekannt ist). */
export function customerColor(customerNumber?: number | null): EntityColor {
  return customerNumber ? color(customerNumber, 0) : NEUTRAL
}

/** Farbe eines Projekts: Abwandlung der Kundenfarbe je nach Projektnummer. */
export function projectColor(customerNumber?: number | null, projectNumber?: number | null): EntityColor {
  return customerNumber && projectNumber ? color(customerNumber, mod10(projectNumber)) : customerColor(customerNumber)
}

/**
 * Setzt die Farbe als CSS-Variablen; zusammen mit den Klassen unten
 * waehlt Tailwind je nach Hell/Dunkel die passende Variante.
 */
export function colorVars(entityColor: EntityColor): CSSProperties {
  return { '--entity-color-light': entityColor.light, '--entity-color-dark': entityColor.dark } as CSSProperties
}

/** Hintergrund in Erkennungsfarbe (fuer Punkte/Streifen). */
export const ENTITY_BG = 'bg-[color:var(--entity-color-light)] dark:bg-[color:var(--entity-color-dark)]'

/** Linker Rand in Erkennungsfarbe (fuer Karten). */
export const ENTITY_BORDER_LEFT = 'border-l-[color:var(--entity-color-light)] dark:border-l-[color:var(--entity-color-dark)]'
