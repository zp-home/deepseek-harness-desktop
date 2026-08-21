// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { afterEach, describe, expect, it } from 'vitest'
import { installPromptHistory } from '../src/client/prompt-history.ts'

Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, writable: true })

type Submission = 'accept' | 'reject' | 'candidate' | 'ime' | 'safari-composition-end'

type HistoryNode = {
  readonly kind: 'user'
  readonly content: readonly { readonly type: 'text'; readonly text: string }[]
}

interface ComposerFixture {
  readonly button: HTMLButtonElement
  readonly textarea: HTMLTextAreaElement
  readonly nodes: Map<string, HistoryNode[]>
  dispose(): void
  setDraft(draft: string): void
  setSession(sessionId: string): void
  setSubmission(submission: Submission): void
  swapSessionOnSubmit(): void
}

function press(
  textarea: HTMLTextAreaElement,
  key: string,
  init: KeyboardEventInit & { keyCode?: number } = {},
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key, ...init })
  if (init.keyCode !== undefined) Object.defineProperty(event, 'keyCode', { value: init.keyCode })
  act(() => { textarea.dispatchEvent(event) })
  return event
}

function createFixture(): ComposerFixture {
  const nodes = new Map<string, HistoryNode[]>([
    ['session-a', []],
    ['session-b', []],
  ])
  let currentSession = 'session-a'
  let submission: Submission = 'accept'
  let swapOnSubmit = false
  let setComposerDraft: ((draft: string) => void) | undefined
  const scopes = new Map([
    ['session-a', { id: 'session-a' }],
    ['session-b', { id: 'session-b' }],
  ])
  const sessions = {
    list: { getSnapshot: () => ({ current: currentSession }) },
    scope: (sessionId: string) => scopes.get(sessionId),
    binding: (sessionId: string) => {
      const sessionNodes = nodes.get(sessionId)
      return sessionNodes === undefined ? undefined : { session: { getSnapshot: () => ({ nodes: sessionNodes }) } }
    },
  }
  const conversation = {
    input: {
      for: () => ({
        setDraft: (draft: string) => { setComposerDraft?.(draft) },
      }),
    },
  }
  const ctx = {
    get: (name: string) => name === 'sessions' ? sessions : name === 'conversation' ? conversation : undefined,
  } as unknown as ClientContext
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

  function Composer(): JSX.Element {
    const [draft, setDraft] = useState('')
    setComposerDraft = setDraft
    return (
      <div data-composer-card="">
        <textarea
          value={draft}
          onChange={event => { setDraft(event.target.value) }}
          onKeyDown={event => {
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
              if (submission === 'candidate') event.preventDefault()
              return
            }
            if (event.key !== 'Enter' || event.shiftKey) return
            if (submission === 'candidate') {
              event.preventDefault()
              return
            }
            if (submission === 'ime' || submission === 'safari-composition-end' || event.nativeEvent.isComposing) return
            // keyCode 229 is the legacy IME-composition signal used by the real composer.
            // oxlint-disable-next-line typescript/no-deprecated
            if (event.nativeEvent.keyCode === 229) return
            event.preventDefault()
            if (submission === 'reject') return
            const submittedSession = currentSession
            if (swapOnSubmit) currentSession = 'session-b'
            nodes.get(submittedSession)?.push({
              kind: 'user',
              content: [{ type: 'text', text: draft }],
            })
            setDraft('')
          }}
        />
        <button
          type="button"
          onClick={() => {
            if (submission !== 'accept') return
            const submittedSession = currentSession
            if (swapOnSubmit) currentSession = 'session-b'
            nodes.get(submittedSession)?.push({
              kind: 'user',
              content: [{ type: 'text', text: draft }],
            })
            setDraft('')
          }}
        >
          Send
        </button>
      </div>
    )
  }

  act(() => { root.render(<Composer />) })
  const textarea = container.querySelector('textarea')
  const button = container.querySelector('button')
  if (textarea === null || button === null) throw new Error('fixture did not render a composer')
  const disposeHistory = installPromptHistory(ctx)

  return {
    button,
    textarea,
    nodes,
    dispose: () => {
      disposeHistory()
      act(() => { root.unmount() })
      container.remove()
    },
    setDraft: draft => { act(() => { setComposerDraft?.(draft) }) },
    setSession: sessionId => { currentSession = sessionId },
    setSubmission: next => { submission = next },
    swapSessionOnSubmit: () => { swapOnSubmit = true },
  }
}

let activeFixture: ComposerFixture | undefined

afterEach(() => {
  activeFixture?.dispose()
  activeFixture = undefined
})

describe('desktop prompt-history composer integration', () => {
  it('recalls only a message that the composer committed into the session snapshot', () => {
    activeFixture = createFixture()
    activeFixture.setDraft('accepted prompt')

    press(activeFixture.textarea, 'Enter')

    expect(activeFixture.textarea.value).toBe('')
    expect(press(activeFixture.textarea, 'ArrowUp').defaultPrevented).toBe(true)
    expect(activeFixture.textarea.value).toBe('accepted prompt')
    expect(press(activeFixture.textarea, 'ArrowDown').defaultPrevented).toBe(true)
    expect(activeFixture.textarea.value).toBe('')

    activeFixture.setDraft('button prompt')
    act(() => { activeFixture?.button.click() })

    expect(activeFixture.nodes.get('session-a')).toHaveLength(2)
    expect(press(activeFixture.textarea, 'ArrowUp').defaultPrevented).toBe(true)
    expect(activeFixture.textarea.value).toBe('button prompt')
  })

  it('does not record rejected prompt or command submissions', () => {
    activeFixture = createFixture()
    activeFixture.setSubmission('reject')
    activeFixture.setDraft('rejected prompt')

    press(activeFixture.textarea, 'Enter')
    activeFixture.setDraft('')

    expect(press(activeFixture.textarea, 'ArrowUp').defaultPrevented).toBe(false)
    expect(activeFixture.textarea.value).toBe('')

    activeFixture.setDraft('/failing-command')
    press(activeFixture.textarea, 'Enter')
    activeFixture.setDraft('')

    expect(press(activeFixture.textarea, 'ArrowUp').defaultPrevented).toBe(false)
  })

  it('lets the React candidate menu consume arrows before history navigation', () => {
    activeFixture = createFixture()
    activeFixture.nodes.get('session-a')?.push({
      kind: 'user',
      content: [{ type: 'text', text: 'existing prompt' }],
    })
    activeFixture.setSubmission('candidate')

    expect(press(activeFixture.textarea, 'ArrowUp').defaultPrevented).toBe(true)
    expect(activeFixture.textarea.value).toBe('')

    activeFixture.setSubmission('accept')
    expect(press(activeFixture.textarea, 'ArrowUp').defaultPrevented).toBe(true)
    expect(activeFixture.textarea.value).toBe('existing prompt')
  })

  it('does not infer IME and Safari composition-closing Enter as a submission', () => {
    activeFixture = createFixture()
    activeFixture.setSubmission('ime')
    activeFixture.setDraft('ime draft')
    press(activeFixture.textarea, 'Enter', { isComposing: true })
    activeFixture.setDraft('')

    expect(press(activeFixture.textarea, 'ArrowUp').defaultPrevented).toBe(false)

    activeFixture.setSubmission('accept')
    activeFixture.setDraft('legacy ime draft')
    press(activeFixture.textarea, 'Enter', { keyCode: 229 })
    activeFixture.setDraft('')

    expect(press(activeFixture.textarea, 'ArrowUp').defaultPrevented).toBe(false)

    activeFixture.setSubmission('safari-composition-end')
    activeFixture.setDraft('safari draft')
    press(activeFixture.textarea, 'Enter')
    activeFixture.setDraft('')

    expect(press(activeFixture.textarea, 'ArrowUp').defaultPrevented).toBe(false)
  })

  it('uses the durable initiating session when selection changes during submission', () => {
    activeFixture = createFixture()
    activeFixture.swapSessionOnSubmit()
    activeFixture.setDraft('session-a prompt')

    press(activeFixture.textarea, 'Enter')

    expect(press(activeFixture.textarea, 'ArrowUp').defaultPrevented).toBe(false)
    activeFixture.setSession('session-a')
    expect(press(activeFixture.textarea, 'ArrowUp').defaultPrevented).toBe(true)
    expect(activeFixture.textarea.value).toBe('session-a prompt')
  })
})
