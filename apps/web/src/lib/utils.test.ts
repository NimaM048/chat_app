import { describe, expect, it } from 'vitest'
import { getInitials } from '@/lib/utils'

describe('getInitials', () => {
  it('returns up to two initials from a display name', () => {
    expect(getInitials('Sara Developer')).toBe('SD')
  })
})
