// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithIntl as render } from '../../test/renderWithIntl'
import userEvent from '@testing-library/user-event'
import CalendarView from './CalendarView'

// Mittwoch, 16.09.2026 - Monatsraster September 2026: Mo 31.08. bis So 04.10.
const NOW = new Date(2026, 8, 16, 12, 0)

const local = (y: number, m: number, d: number, h = 0, min = 0, s = 0, ms = 0) =>
  new Date(y, m - 1, d, h, min, s, ms).getTime()

describe('CalendarView', () => {
  beforeEach(() => {
    // Nur Date faken - userEvent braucht echte Timer.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('onVisibleRangeChange', () => {
    it('reports the whole month grid (incl. adjacent days) on mount', () => {
      const onRange = vi.fn()
      render(<CalendarView events={[]} onVisibleRangeChange={onRange} />)

      expect(onRange).toHaveBeenCalledTimes(1)
      const { start, end } = onRange.mock.calls[0][0] as { start: Date; end: Date }
      expect(start.getTime()).toBe(local(2026, 8, 31))
      expect(end.getTime()).toBe(local(2026, 10, 4, 23, 59, 59, 999))
    })

    it('reports the new grid when paging to the next and previous month', async () => {
      const onRange = vi.fn()
      render(<CalendarView events={[]} onVisibleRangeChange={onRange} />)
      onRange.mockClear()

      await userEvent.click(screen.getByRole('button', { name: 'Weiter' }))
      let { start, end } = onRange.mock.calls.at(-1)![0] as { start: Date; end: Date }
      expect(start.getTime()).toBe(local(2026, 9, 28))
      expect(end.getTime()).toBe(local(2026, 11, 1, 23, 59, 59, 999))

      await userEvent.click(screen.getByRole('button', { name: 'Zurück' }))
      await userEvent.click(screen.getByRole('button', { name: 'Zurück' }))
      ;({ start, end } = onRange.mock.calls.at(-1)![0] as { start: Date; end: Date })
      expect(start.getTime()).toBe(local(2026, 7, 27))
      expect(end.getTime()).toBe(local(2026, 9, 6, 23, 59, 59, 999))
    })

    it('reports only the current week in week mode', async () => {
      const onRange = vi.fn()
      render(<CalendarView events={[]} onVisibleRangeChange={onRange} />)

      await userEvent.click(screen.getByRole('button', { name: 'Woche' }))

      const { start, end } = onRange.mock.calls.at(-1)![0] as { start: Date; end: Date }
      expect(start.getTime()).toBe(local(2026, 9, 14))
      expect(end.getTime()).toBe(local(2026, 9, 20, 23, 59, 59, 999))
    })

    it('jumps back to the current month with "Heute"', async () => {
      const onRange = vi.fn()
      render(<CalendarView events={[]} onVisibleRangeChange={onRange} />)
      await userEvent.click(screen.getByRole('button', { name: 'Weiter' }))

      await userEvent.click(screen.getByRole('button', { name: 'Heute' }))

      const { start } = onRange.mock.calls.at(-1)![0] as { start: Date }
      expect(start.getTime()).toBe(local(2026, 8, 31))
    })

    it('does not report again when only the callback identity changes', () => {
      const first = vi.fn()
      const second = vi.fn()
      const { rerender } = render(<CalendarView events={[]} onVisibleRangeChange={first} />)
      expect(first).toHaveBeenCalledTimes(1)

      rerender(<CalendarView events={[]} onVisibleRangeChange={second} />)

      expect(first).toHaveBeenCalledTimes(1)
      expect(second).not.toHaveBeenCalled()
    })

    it('works without the optional callback', () => {
      expect(() => render(<CalendarView events={[]} />)).not.toThrow()
    })
  })

  describe('Tage', () => {
    const event = (id: string, start: Date, end: Date) => ({
      id,
      title: id,
      start: start.toISOString(),
      end: end.toISOString(),
    })
    const dayButton = (label: RegExp) => screen.getByRole('button', { name: label })

    it('zeigt pro Tag Anzahl und Total - auch bei vielen Eintraegen', () => {
      // 7 Eintraege a 1 h am 16.09.
      const events = Array.from({ length: 7 }, (_, i) =>
        event(`e${i}`, new Date(2026, 8, 16, 7 + i, 0), new Date(2026, 8, 16, 8 + i, 0)),
      )
      render(<CalendarView events={events} />)

      expect(dayButton(/16\. September: 7 Einträge, 7.00 h/)).toBeInTheDocument()
      expect(dayButton(/15\. September: keine Einträge/)).toBeInTheDocument()
      expect(screen.getByText('7.00')).toBeInTheDocument()
    })

    it('meldet den angetippten Tag und hebt den gewaehlten Tag hervor', async () => {
      const onSelectDate = vi.fn()
      const { rerender } = render(<CalendarView events={[]} onSelectDate={onSelectDate} />)

      await userEvent.click(dayButton(/18\. September/))
      expect(onSelectDate).toHaveBeenCalledWith(new Date(2026, 8, 18))

      rerender(<CalendarView events={[]} selectedDate={new Date(2026, 8, 18)} onSelectDate={onSelectDate} />)
      expect(dayButton(/18\. September/)).toHaveAttribute('aria-pressed', 'true')
      expect(dayButton(/17\. September/)).toHaveAttribute('aria-pressed', 'false')
    })

    it('"Heute" waehlt den heutigen Tag', async () => {
      const onSelectDate = vi.fn()
      render(<CalendarView events={[]} onSelectDate={onSelectDate} />)

      await userEvent.click(screen.getByRole('button', { name: 'Heute' }))

      expect(onSelectDate).toHaveBeenCalledWith(new Date(2026, 8, 16))
    })
  })
})
