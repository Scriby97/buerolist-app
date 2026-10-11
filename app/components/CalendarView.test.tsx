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

  describe('events', () => {
    const event = (id: string, title: string, day: string) => ({
      id,
      title,
      start: day,
      end: day,
    })

    it('shows an event on its day and reports clicks with the event id', async () => {
      const onEventClick = vi.fn()
      render(
        <CalendarView
          events={[event('u1', 'Chalet Mittaghorn - Holzwerk', new Date(2026, 8, 16, 8, 0).toISOString())]}
          onEventClick={onEventClick}
        />,
      )

      await userEvent.click(screen.getByText('Chalet Mittaghorn - Holzwerk'))

      expect(onEventClick).toHaveBeenCalledWith('u1')
    })

    it('collapses more than two events per day into a "+N" hint in month view', () => {
      const day = new Date(2026, 8, 16, 8, 0).toISOString()
      render(
        <CalendarView
          events={[event('a', 'A', day), event('b', 'B', day), event('c', 'C', day)]}
        />,
      )

      expect(screen.getByText('A')).toBeInTheDocument()
      expect(screen.getByText('B')).toBeInTheDocument()
      expect(screen.queryByText('C')).not.toBeInTheDocument()
      expect(screen.getByText('+1')).toBeInTheDocument()
    })

    it('lists all events of a day in week view', async () => {
      const day = new Date(2026, 8, 16, 8, 0).toISOString()
      render(
        <CalendarView
          events={[event('a', 'A', day), event('b', 'B', day), event('c', 'C', day)]}
        />,
      )

      await userEvent.click(screen.getByRole('button', { name: 'Woche' }))

      expect(screen.getByText('A')).toBeInTheDocument()
      expect(screen.getByText('B')).toBeInTheDocument()
      expect(screen.getByText('C')).toBeInTheDocument()
    })
  })
})
