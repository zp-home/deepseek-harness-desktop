import { describe, expect, it } from 'vitest'
import { PromptHistory } from '../src/client/prompt-history.ts'

describe('desktop prompt history', () => {
  it('walks backward and forward while restoring the draft that preceded navigation', () => {
    const history = new PromptHistory()
    history.sync('session-1', ['first prompt', '/status'])

    expect(history.previous('session-1', 'unfinished draft')).toBe('/status')
    expect(history.previous('session-1', '/status')).toBe('first prompt')
    expect(history.previous('session-1', 'first prompt')).toBe('first prompt')
    expect(history.next('session-1')).toBe('/status')
    expect(history.next('session-1')).toBe('unfinished draft')
    expect(history.next('session-1')).toBeUndefined()
  })

  it('replaces entries from the latest loaded durable history', () => {
    const history = new PromptHistory()
    history.sync('session-1', ['earlier prompt', '/status'])
    history.sync('session-1', ['earlier prompt', '/status', 'new prompt'])

    expect(history.previous('session-1', '')).toBe('new prompt')
    expect(history.previous('session-1', 'new prompt')).toBe('/status')
    expect(history.previous('session-1', '/status')).toBe('earlier prompt')
  })

  it('keeps histories isolated by session and ignores empty submissions', () => {
    const history = new PromptHistory()
    history.sync('session-1', ['one', '   '])
    history.sync('session-2', ['two'])

    expect(history.previous('session-1', '')).toBe('one')
    expect(history.previous('session-2', '')).toBe('two')
  })

  it('collapses consecutive durable duplicates and leaves navigation after edits', () => {
    const history = new PromptHistory()
    history.sync('session-1', ['same', 'same'])

    expect(history.previous('session-1', '')).toBe('same')
    history.reset('session-1')
    expect(history.isNavigating('session-1')).toBe(false)
    expect(history.next('session-1')).toBeUndefined()
  })
})
