import { describe, expect, it } from 'vitest'
import { DEFAULT_WORK_SCHEDULE, isValidWorkSchedule, scheduleOf, suggestStartTime, workdayMinutes } from './workSchedule'

describe('workSchedule', () => {
  it('Standard 07:15-12:00, 13:00-17:00 dauert 8:45', () => {
    expect(workdayMinutes(DEFAULT_WORK_SCHEDULE)).toBe(525)
  })

  it('schlaegt Arbeitsbeginn, Nachmittagsbeginn oder direkten Anschluss vor', () => {
    const s = scheduleOf({ workMorningStart: '06:30', workMorningEnd: '11:45', workAfternoonStart: '12:30' })
    expect(suggestStartTime('', s)).toBe('06:30')
    expect(suggestStartTime('11:45', s)).toBe('12:30')
    expect(suggestStartTime('10:00', s)).toBe('10:00')
    expect(s.workAfternoonEnd).toBe('17:00')
  })

  it('prueft die Reihenfolge der Zeiten', () => {
    expect(isValidWorkSchedule(DEFAULT_WORK_SCHEDULE)).toBe(true)
    expect(isValidWorkSchedule({ ...DEFAULT_WORK_SCHEDULE, workAfternoonStart: '11:00' })).toBe(false)
    expect(isValidWorkSchedule({ ...DEFAULT_WORK_SCHEDULE, workMorningStart: '' })).toBe(false)
  })
})
