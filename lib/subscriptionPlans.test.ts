import { describe, expect, it } from 'vitest'
import { SUBSCRIPTION_PLANS, planDisplay } from './subscriptionPlans'

const labels: Record<string, string> = {
  freeLabel: 'Kostenlos',
  unlimitedLabel: 'Unlimitiert',
  perMonthSuffix: '/ Monat',
  projectsSuffix: 'aktive Projekte',
  membersSuffix: 'Mitarbeiter',
  customersSuffix: 'Kunden',
}
const t = (key: string) => labels[key]

describe('subscriptionPlans', () => {
  it('hat drei Tarife: Free, Standard, Pro', () => {
    expect(SUBSCRIPTION_PLANS.map((p) => [p.id, p.priceChf, p.maxMembers])).toEqual([
      ['free', 0, 2],
      ['standard', 29, 10],
      ['pro', 69, null],
    ])
  })

  it('beschreibt einen Tarif fuer die Karte', () => {
    expect(planDisplay(SUBSCRIPTION_PLANS[0], t)).toEqual({
      price: 'Kostenlos',
      features: ['2 Mitarbeiter', '10 aktive Projekte', 'Unlimitiert Kunden'],
    })
    expect(planDisplay(SUBSCRIPTION_PLANS[1], t).price).toBe('CHF 29.- / Monat')
    expect(planDisplay(SUBSCRIPTION_PLANS[1], t).features[1]).toBe('Unlimitiert aktive Projekte')
  })
})
