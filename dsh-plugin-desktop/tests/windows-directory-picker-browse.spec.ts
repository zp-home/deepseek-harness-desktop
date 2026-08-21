import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import DesktopWindowsBrowseDirectoryPicker, {
  filterUnreadableDirectories,
  isEnterableDirectory,
} from '../src/windows-directory-picker-browse.ts'

function listing(entries: string[]) {
  return {
    path: 'C:\\Users\\tester',
    home: 'C:\\Users\\tester',
    crumbs: [],
    entries: entries.map(name => ({
      name,
      path: `C:\\Users\\tester\\${name}`,
      hidden: false,
    })),
    truncated: false,
  }
}

describe('Windows browse directory-picker adapter', () => {
  it('opens and closes candidate directories while hiding access failures', async () => {
    const close = vi.fn(async () => {})
    const open = vi.fn(async (path: string) => {
      if (path.endsWith('Start Menu')) {
        throw Object.assign(new Error('operation not permitted'), { code: 'EPERM' })
      }
      return { close }
    })

    await expect(isEnterableDirectory('C:\\Users\\tester\\Documents', undefined, open))
      .resolves.toBe(true)
    await expect(isEnterableDirectory('C:\\Users\\tester\\Start Menu', undefined, open))
      .resolves.toBe(false)
    expect(close).toHaveBeenCalledOnce()
  })

  it('filters every row with bounded concurrency and preserves upstream order', async () => {
    const value = listing(['Documents', 'My Documents', 'OneDrive', 'Start Menu'])
    let active = 0
    let maximumActive = 0
    const probe = vi.fn(async (path: string) => {
      active += 1
      maximumActive = Math.max(maximumActive, active)
      await Promise.resolve()
      active -= 1
      return !path.endsWith('My Documents') && !path.endsWith('Start Menu')
    })

    await expect(filterUnreadableDirectories(value, undefined, probe, 2)).resolves.toEqual({
      ...value,
      entries: [value.entries[0], value.entries[2]],
    })
    expect(probe).toHaveBeenCalledTimes(4)
    expect(maximumActive).toBe(2)
  })

  it('returns the original listing when every row is enterable', async () => {
    const value = listing(['Documents', 'OneDrive'])

    await expect(filterUnreadableDirectories(value, undefined, async () => true))
      .resolves.toBe(value)
  })

  it('rejects invalid concurrency and propagates caller cancellation', async () => {
    const value = listing(['Documents'])
    await expect(filterUnreadableDirectories(value, undefined, async () => true, 0))
      .rejects.toThrow('positive integer')

    const controller = new AbortController()
    controller.abort(new Error('caller left'))
    const open = vi.fn(async () => ({ close: async () => {} }))
    await expect(isEnterableDirectory(value.entries[0]!.path, controller.signal, open))
      .rejects.toThrow('caller left')
    expect(open).not.toHaveBeenCalled()
  })

  it('closes a directory handle that arrives after caller cancellation', async () => {
    let resolveOpen: ((handle: { close(): Promise<void> }) => void) | undefined
    const opening = new Promise<{ close(): Promise<void> }>((resolve) => { resolveOpen = resolve })
    const close = vi.fn(async () => {})
    const controller = new AbortController()
    const result = isEnterableDirectory(
      'C:\\Users\\tester\\Network Share',
      controller.signal,
      () => opening,
    )

    controller.abort(new Error('caller left'))
    await expect(result).rejects.toThrow('caller left')
    resolveOpen?.({ close })
    await vi.waitFor(() => { expect(close).toHaveBeenCalledOnce() })
  })

  it('retains a stable upstream browse capability and filesystem behavior', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-desktop-directory-picker-'))
    const projects = join(root, 'projects')
    await mkdir(projects)
    const ctx = new Context()
    const fiber = ctx.plugin(DesktopWindowsBrowseDirectoryPicker)
    await fiber.await()
    try {
      const capability = ctx.get('directoryPicker')!.capability()
      expect(capability.kind).toBe('browse')
      if (capability.kind !== 'browse') throw new Error('browse capability expected')
      await expect(capability.list(root)).resolves.toMatchObject({
        entries: [{ name: 'projects', path: projects }],
      })
      expect(ctx.get('directoryPicker')!.capability()).toBe(capability)
    } finally {
      await fiber.dispose()
      await rm(root, { recursive: true, force: true })
    }
  })
})
