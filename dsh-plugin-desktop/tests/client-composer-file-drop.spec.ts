// @vitest-environment jsdom
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  appendDroppedPaths,
  droppedPathFiles,
  installComposerFileDrop,
  resolveDroppedPaths,
} from '../src/client/composer-file-drop.ts'

interface TransferEntryOptions {
  readonly directory?: boolean
  readonly type?: string
}

function file(name: string, type = 'application/octet-stream'): File {
  return new File([Uint8Array.of(1)], name, { type })
}

function transfer(entries: readonly [File, TransferEntryOptions?][], types: readonly string[] = ['Files']): DataTransfer {
  return {
    types,
    items: entries.map(([value, options]) => ({
      kind: 'file',
      type: options?.type ?? value.type,
      getAsFile: () => value,
      webkitGetAsEntry: () => ({ isDirectory: options?.directory === true }),
    })),
    files: entries.map(([value]) => value),
    dropEffect: 'none',
  } as unknown as DataTransfer
}

function drag(type: 'dragenter' | 'dragover' | 'drop', dataTransfer: DataTransfer): DragEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as DragEvent
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
  return event
}

afterEach(() => {
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

describe('desktop composer file drop', () => {
  it('selects only bounded ordinary-file drops and leaves images, folders, and internal drags to their owners', () => {
    const report = file('report.pdf', 'application/pdf')
    const notes = file('notes.txt', 'text/plain')
    expect(droppedPathFiles(transfer([[report], [notes]]))).toEqual([report, notes])
    expect(droppedPathFiles(transfer([[file('photo.png', 'image/png')]]))).toBeUndefined()
    expect(droppedPathFiles(transfer([[file('photo.PNG', '')]]))).toBeUndefined()
    expect(droppedPathFiles(transfer([[report], [file('photo.png', 'image/png')]]))).toBeUndefined()
    expect(droppedPathFiles(transfer([[file('workspace', ''), { directory: true }]]))).toBeUndefined()
    expect(droppedPathFiles(transfer([[report]], ['text/plain']))).toBeUndefined()
    expect(droppedPathFiles(transfer(Array.from({ length: 33 }, (_, index) => [
      file(`row-${String(index)}.txt`, 'text/plain'),
    ] as [File])))).toBeUndefined()
  })

  it('accepts only unique bounded absolute paths from the native bridge', () => {
    const first = file('first.txt')
    const second = file('second.txt')
    const bridge = {
      getPathForFile: vi.fn(() => 'C:\\Work\\first.txt'),
    }
    expect(resolveDroppedPaths([first, second], bridge)).toEqual(['C:\\Work\\first.txt'])
    expect(resolveDroppedPaths([first], { getPathForFile: () => '/Users/me/first.txt' }))
      .toEqual(['/Users/me/first.txt'])
    expect(resolveDroppedPaths([first], { getPathForFile: () => '/Users/me/first.txt ' }))
      .toEqual(['/Users/me/first.txt '])
    expect(resolveDroppedPaths([first], { getPathForFile: () => 'relative.txt' })).toBeUndefined()
    expect(resolveDroppedPaths([first], { getPathForFile: () => '/tmp/a\nfile' })).toBeUndefined()
    expect(resolveDroppedPaths([first], { getPathForFile: () => { throw new Error('unavailable') } }))
      .toBeUndefined()
  })

  it('appends paths without replacing the operator draft and rejects an oversized result', () => {
    expect(appendDroppedPaths('', ['/tmp/report.pdf'])).toBe('/tmp/report.pdf')
    expect(appendDroppedPaths('review this', ['/tmp/report.pdf', '/tmp/data.csv']))
      .toBe('review this\n/tmp/report.pdf\n/tmp/data.csv')
    expect(appendDroppedPaths('review this\n', ['/tmp/report.pdf']))
      .toBe('review this\n/tmp/report.pdf')
    expect(appendDroppedPaths('x'.repeat(256 * 1024), ['/tmp/report.pdf'])).toBeUndefined()
  })

  it('writes through the current session input, focuses the composer, and disposes capture listeners', () => {
    const composer = document.createElement('div')
    composer.dataset.composerCard = ''
    const textarea = document.createElement('textarea')
    textarea.dataset.phase = 'plain'
    composer.append(textarea)
    document.body.append(composer)

    let state = { draft: 'review', phase: 'plain' as const }
    const setDraft = vi.fn((draft: string) => {
      state = { ...state, draft }
      textarea.value = draft
    })
    const scope = {}
    const sessions = {
      list: { getSnapshot: () => ({ current: 'session-1' }) },
      scope: () => scope,
    }
    const conversation = {
      input: {
        for: (candidate: unknown) => {
          expect(candidate).toBe(scope)
          return { state: { getSnapshot: () => state }, setDraft }
        },
      },
    }
    const ctx = {
      get: (name: string) => name === 'sessions' ? sessions : name === 'conversation' ? conversation : undefined,
    } as unknown as ClientContext
    const bridge = { getPathForFile: vi.fn(() => 'C:\\Work\\report.pdf') }
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    const onInput = vi.fn()
    textarea.addEventListener('input', onInput)
    const dispose = installComposerFileDrop(ctx, { __DSH_DESKTOP_FILE_PATH__: bridge })
    const payload = transfer([[file('report.pdf', 'application/pdf')]])
    const leakedToDocument = vi.fn()
    document.addEventListener('dragenter', leakedToDocument)

    const enter = drag('dragenter', payload)
    document.body.dispatchEvent(enter)
    expect(enter.defaultPrevented).toBe(true)
    expect(leakedToDocument).not.toHaveBeenCalled()
    const over = drag('dragover', payload)
    document.body.dispatchEvent(over)
    expect(over.defaultPrevented).toBe(true)
    expect(payload.dropEffect).toBe('copy')
    const drop = drag('drop', payload)
    document.body.dispatchEvent(drop)

    expect(drop.defaultPrevented).toBe(true)
    expect(setDraft).toHaveBeenCalledWith('review\nC:\\Work\\report.pdf')
    expect(document.activeElement).toBe(textarea)
    expect(textarea.selectionStart).toBe(textarea.value.length)
    expect(onInput).toHaveBeenCalledOnce()

    dispose()
    const afterDispose = drag('drop', payload)
    document.body.dispatchEvent(afterDispose)
    expect(afterDispose.defaultPrevented).toBe(false)
    expect(setDraft).toHaveBeenCalledOnce()
  })

  it('does not claim image, directory, inert, or busy-composer drops', () => {
    const composer = document.createElement('div')
    composer.dataset.composerCard = ''
    const textarea = document.createElement('textarea')
    textarea.dataset.phase = 'plain'
    composer.append(textarea)
    document.body.append(composer)
    let phase: 'plain' | 'claimed' = 'plain'
    const setDraft = vi.fn()
    const input = { state: { getSnapshot: () => ({ draft: '', phase }) }, setDraft }
    const sessions = { list: { getSnapshot: () => ({ current: 'session-1' }) }, scope: () => ({}) }
    const conversation = { input: { for: () => input } }
    const ctx = {
      get: (name: string) => name === 'sessions' ? sessions : name === 'conversation' ? conversation : undefined,
    } as unknown as ClientContext
    let nativePath = '/tmp/report.pdf'
    const dispose = installComposerFileDrop(ctx, {
      __DSH_DESKTOP_FILE_PATH__: { getPathForFile: () => nativePath },
    })

    const imageDrop = drag('drop', transfer([[file('photo.png', 'image/png')]]))
    document.body.dispatchEvent(imageDrop)
    expect(imageDrop.defaultPrevented).toBe(false)
    const imageEnter = drag('dragenter', transfer([[file('photo.png', 'image/png')]]))
    document.body.dispatchEvent(imageEnter)
    expect(imageEnter.defaultPrevented).toBe(false)
    const directoryDrop = drag('drop', transfer([[file('workspace', ''), { directory: true }]]))
    document.body.dispatchEvent(directoryDrop)
    expect(directoryDrop.defaultPrevented).toBe(false)
    phase = 'claimed'
    const busyDrop = drag('drop', transfer([[file('report.pdf', 'application/pdf')]]))
    document.body.dispatchEvent(busyDrop)
    expect(busyDrop.defaultPrevented).toBe(false)
    textarea.dataset.phase = 'inert'
    phase = 'plain'
    const inertDrop = drag('drop', transfer([[file('report.pdf', 'application/pdf')]]))
    document.body.dispatchEvent(inertDrop)
    expect(inertDrop.defaultPrevented).toBe(false)
    textarea.dataset.phase = 'plain'
    nativePath = 'relative.pdf'
    const invalidPathDrop = drag('drop', transfer([[file('report.pdf', 'application/pdf')]]))
    document.body.dispatchEvent(invalidPathDrop)
    expect(invalidPathDrop.defaultPrevented).toBe(false)
    expect(setDraft).not.toHaveBeenCalled()
    dispose()
  })
})
