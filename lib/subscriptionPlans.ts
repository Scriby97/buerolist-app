import type { SubscriptionTier } from '@/lib/types/user'

/**
 * Die Tarife fuer Anzeige/Auswahl (Onboarding, Abo-Einstellungen). Muss zu
 * SUBSCRIPTION_LIMITS im Backend passen - dort werden die Limits durchgesetzt.
 * null = unbegrenzt; Kunden sind in keinem Tarif begrenzt.
 */
export interface SubscriptionPlan {
  id: SubscriptionTier
  priceChf: number
  maxProjects: number | null
  maxMembers: number | null
  /** Hervorgehoben als "Beliebt" */
  highlight?: boolean
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  { id: 'free', priceChf: 0, maxProjects: 10, maxMembers: 2 },
  { id: 'standard', priceChf: 29, maxProjects: null, maxMembers: 10, highlight: true },
  { id: 'pro', priceChf: 69, maxProjects: null, maxMembers: null },
]

/** Texte einer Tarifkarte: Preis und Leistungen, z.B. "10 Mitarbeiter". */
export function planDisplay(
  plan: SubscriptionPlan,
  t: (key: 'freeLabel' | 'unlimitedLabel' | 'perMonthSuffix' | 'projectsSuffix' | 'membersSuffix' | 'customersSuffix') => string,
) {
  const amount = (value: number | null) => (value === null ? t('unlimitedLabel') : String(value))
  return {
    price: plan.priceChf === 0 ? t('freeLabel') : `CHF ${plan.priceChf}.- ${t('perMonthSuffix')}`,
    features: [
      `${amount(plan.maxMembers)} ${t('membersSuffix')}`,
      `${amount(plan.maxProjects)} ${t('projectsSuffix')}`,
      `${t('unlimitedLabel')} ${t('customersSuffix')}`,
    ],
  }
}
