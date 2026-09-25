import { describe, it, expect } from 'vitest'
import SalonLocationFilter from './admin/SalonLocationFilter'

describe('SalonLocationFilter', () => {
  it('is defined and is a valid React component', () => {
    expect(SalonLocationFilter).toBeDefined()
    expect(typeof SalonLocationFilter).toBe('function')
  })
})
