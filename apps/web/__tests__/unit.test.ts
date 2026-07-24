import { describe, expect, it } from 'vitest'
import { registerErrorKey } from '../src/lib/register-error'

describe('registerErrorKey', () => {
  it('classifies a wallet rejection', () => {
    expect(registerErrorKey(new Error('User rejected the request.'))).toBe('rejected')
  })

  it('classifies insufficient funds', () => {
    expect(registerErrorKey(new Error('Attempt to debit an account but found no record'))).toBe(
      'insufficient',
    )
  })

  it('classifies an expired blockhash', () => {
    expect(registerErrorKey(new Error('block height exceeded'))).toBe('expired')
  })

  it('classifies a duplicate registration', () => {
    expect(registerErrorKey(new Error('custom program error: 0x0'))).toBe('duplicate')
  })

  it('falls back to generic', () => {
    expect(registerErrorKey(new Error('network blip'))).toBe('generic')
  })
})
