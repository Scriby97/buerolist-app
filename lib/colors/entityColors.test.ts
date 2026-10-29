import { describe, expect, it } from 'vitest'
import { CUSTOMER_HUES, customerColor, employeeColors, projectColor } from './entityColors'

const parse = (oklch: string) => {
  const [l, c, h] = oklch.replace(/oklch\(|\)/g, '').split(' ').map(Number)
  return { l, c, h }
}

describe('entityColors', () => {
  it('ist deterministisch - gleiche Nummern, gleiche Farbe', () => {
    expect(projectColor(3, 7)).toEqual(projectColor(3, 7))
  })

  it('vergibt 10 Grundfarben und beginnt danach von vorne', () => {
    const hues = Array.from({ length: 10 }, (_, i) => parse(customerColor(i + 1).light).h)
    expect(hues).toEqual([...CUSTOMER_HUES])
    expect(customerColor(11)).toEqual(customerColor(1))
    expect(customerColor(23)).toEqual(customerColor(3))
  })

  it('Projekt 1 hat die Kundenfarbe, die weiteren sind Abwandlungen davon', () => {
    expect(projectColor(2, 1)).toEqual(customerColor(2))
    const variants = Array.from({ length: 10 }, (_, i) => projectColor(2, i + 1).light)
    expect(new Set(variants).size).toBe(10)
    expect(projectColor(2, 11)).toEqual(projectColor(2, 1))
    // "kleine Abaenderung": Farbton bleibt nahe an der Kundenfarbe
    for (const v of variants) {
      const diff = Math.abs(((parse(v).h - CUSTOMER_HUES[1] + 540) % 360) - 180)
      expect(diff).toBeLessThanOrEqual(30)
    }
  })

  it('bleibt in einem gut sichtbaren Helligkeitsbereich', () => {
    for (let customer = 1; customer <= 10; customer++) {
      for (let project = 1; project <= 10; project++) {
        const { light, dark } = projectColor(customer, project)
        expect(parse(light).l).toBeGreaterThanOrEqual(0.45)
        expect(parse(light).l).toBeLessThanOrEqual(0.75)
        expect(parse(dark).l).toBeGreaterThanOrEqual(0.48)
        expect(parse(dark).l).toBeLessThanOrEqual(0.74)
      }
    }
  })

  it('ist grau, solange keine Nummer bekannt ist', () => {
    expect(parse(customerColor(undefined).light).c).toBe(0)
    expect(projectColor(undefined, 3)).toEqual(customerColor(undefined))
  })

  it('vergibt Mitarbeiterfarben alphabetisch, unabhaengig von der Reihenfolge', () => {
    const anna = { id: 'a', name: 'Anna' }
    const beat = { id: 'b', name: 'Beat' }
    const colors = employeeColors([beat, anna])
    expect(colors.get('a')).toEqual(employeeColors([anna, beat]).get('a'))
    expect(colors.get('a')).not.toEqual(colors.get('b'))
  })
})
