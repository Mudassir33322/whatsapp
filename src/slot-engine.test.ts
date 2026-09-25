import { describe, it, expect } from 'vitest'
import { timeToMinutes } from '../utils'

function generateTimeSlots(startTime: string, endTime: string, slotDuration: number, buffer: number = 5): { start: string, end: string }[] {
  const slots: { start: string, end: string }[] = []
  const [startH, startM] = startTime.split(':').map(Number)
  const [endH, endM] = endTime.split(':').map(Number)
  let currentMinutes = startH * 60 + startM
  const endMinutes = endH * 60 + endM
  while (currentMinutes + slotDuration <= endMinutes) {
    const slotStart = currentMinutes
    const slotEnd = currentMinutes + slotDuration
    const startStr = `${String(Math.floor(slotStart / 60)).padStart(2, '0')}:${String(slotStart % 60).padStart(2, '0')}`
    const endStr = `${String(Math.floor(slotEnd / 60)).padStart(2, '0')}:${String(slotEnd % 60).padStart(2, '0')}`
    slots.push({ start: startStr, end: endStr })
    currentMinutes = slotEnd + buffer
  }
  return slots
}

describe('timeToMinutes', () => {
  it('converts time string to minutes', () => {
    expect(timeToMinutes('00:00')).toBe(0)
    expect(timeToMinutes('01:00')).toBe(60)
    expect(timeToMinutes('09:30')).toBe(570)
    expect(timeToMinutes('23:59')).toBe(1439)
  })
})

describe('generateTimeSlots', () => {
  it('generates 30-min slots with 5 min buffer from 9AM to 5PM', () => {
    const slots = generateTimeSlots('09:00', '17:00', 30)
    // 8 hours × 60 = 480 mins → each slot is 35 mins (30 + 5 buffer) → 13 slots + 1 partial
    expect(slots.length).toBe(13)
    expect(slots[0]).toEqual({ start: '09:00', end: '09:30' })
    // 09:00 + 13 * 35 = 09:00 + 455 = 16:35
    const last = slots[slots.length - 1]
    expect(last.end).toBe('16:30')
  })

  it('generates 0 slots when start equals end', () => {
    expect(generateTimeSlots('09:00', '09:00', 30)).toHaveLength(0)
  })

  it('generates 1 slot for tight window matching duration exactly', () => {
    const slots = generateTimeSlots('09:00', '09:30', 30)
    expect(slots).toHaveLength(1)
    expect(slots[0]).toEqual({ start: '09:00', end: '09:30' })
  })

  it('includes correct buffer between slots', () => {
    const slots = generateTimeSlots('09:00', '10:00', 20)
    // 09:00-09:20, buffer → 09:25-09:45, buffer → only 2 slots fit
    expect(slots).toHaveLength(2)
    expect(slots[0]).toEqual({ start: '09:00', end: '09:20' })
    expect(slots[1]).toEqual({ start: '09:25', end: '09:45' })
  })

  it('handles 0 buffer correctly', () => {
    const slots = generateTimeSlots('09:00', '10:00', 30, 0)
    expect(slots).toHaveLength(2)
    expect(slots[0]).toEqual({ start: '09:00', end: '09:30' })
    expect(slots[1]).toEqual({ start: '09:30', end: '10:00' })
  })

  it('handles various slot durations', () => {
    const fifteenMin = generateTimeSlots('09:00', '10:00', 15)
    expect(fifteenMin.length).toBeGreaterThan(0)
    // all slots should be exactly 15 min
    for (const slot of fifteenMin) {
      const start = timeToMinutes(slot.start)
      const end = timeToMinutes(slot.end)
      expect(end - start).toBe(15)
    }
  })
})

describe('available slot filtering logic', () => {
  it('filters out booked slots', () => {
    const allSlots = generateTimeSlots('09:00', '12:00', 30)
    const bookedSlots = ['09:00', '10:00'].map(t => timeToMinutes(t))

    const available = allSlots.filter(slot => {
      const start = timeToMinutes(slot.start)
      return !bookedSlots.some(booked => {
        const bookedEnd = booked + 30
        return start >= booked && start < bookedEnd
      })
    })

    expect(available.length).toBeLessThan(allSlots.length)
    expect(available.every(s => s.start !== '09:00')).toBe(true)
    expect(available.every(s => s.start !== '10:00')).toBe(true)
  })

  it('removes past slots for today', () => {
    const allSlots = generateTimeSlots('09:00', '17:00', 30)
    const currentMinutes = 14 * 60 // 2:00 PM
    const future = allSlots.filter(s => timeToMinutes(s.start) > currentMinutes)
    expect(future.length).toBeGreaterThan(0)
    expect(future.every(s => timeToMinutes(s.start) > 840)).toBe(true)
  })
})
