/** Windows browse picker that hides child directories the current user cannot enter. */

import { opendir } from 'node:fs/promises'
import type { Context } from '@deepseek-ai/cordis'
import type {
  DirectoryListing,
  DirectoryPickerBrowseCapability,
  DirectoryPickerCapability,
} from '@deepseek-ai/dsh-host-directory-picker'
import BrowseDirectoryPicker, {
  raceAbort,
  type Config as BrowseDirectoryPickerConfig,
} from '@deepseek-ai/dsh-host-directory-picker-browse'

const DIRECTORY_PROBE_CONCURRENCY = 8

interface OpenDirectoryHandle {
  close(): Promise<void>
}

export type OpenDirectoryProbe = (path: string) => Promise<OpenDirectoryHandle>
export type DirectoryEntryProbe = (path: string, signal?: AbortSignal) => Promise<boolean>

function swallowCloseFailure(): void {}

/** Return whether one candidate directory can actually be opened for enumeration. */
export async function isEnterableDirectory(
  path: string,
  signal?: AbortSignal,
  openPath: OpenDirectoryProbe = async value => await opendir(value),
): Promise<boolean> {
  signal?.throwIfAborted()
  let opening: Promise<OpenDirectoryHandle>
  try {
    opening = openPath(path)
  } catch {
    signal?.throwIfAborted()
    return false
  }

  let directory: OpenDirectoryHandle
  try {
    directory = await raceAbort(opening, signal)
  } catch {
    void opening.then(handle => handle.close().catch(swallowCloseFailure), () => {})
    signal?.throwIfAborted()
    return false
  }

  const closing = directory.close()
  try {
    await raceAbort(closing, signal)
  } catch {
    void closing.catch(swallowCloseFailure)
    signal?.throwIfAborted()
  }
  return true
}

/** Filter inaccessible rows with bounded concurrency while preserving upstream order. */
export async function filterUnreadableDirectories(
  listing: DirectoryListing,
  signal?: AbortSignal,
  probe: DirectoryEntryProbe = isEnterableDirectory,
  concurrency = DIRECTORY_PROBE_CONCURRENCY,
): Promise<DirectoryListing> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error('dsh-plugin-desktop: directory probe concurrency must be a positive integer')
  }
  const accepted = new Array<boolean>(listing.entries.length)
  let nextIndex = 0
  const worker = async (): Promise<void> => {
    for (;;) {
      signal?.throwIfAborted()
      const index = nextIndex
      nextIndex += 1
      if (index >= listing.entries.length) return
      accepted[index] = await probe(listing.entries[index]!.path, signal)
    }
  }
  await Promise.all(Array.from(
    { length: Math.min(concurrency, listing.entries.length) },
    worker,
  ))
  const entries = listing.entries.filter((_entry, index) => accepted[index])
  return entries.length === listing.entries.length ? listing : { ...listing, entries }
}

/** Windows provider that retains upstream browse semantics and filters unreadable children. */
export class DesktopWindowsBrowseDirectoryPicker extends BrowseDirectoryPicker {
  private readonly desktopCapability: DirectoryPickerBrowseCapability

  constructor(ctx: Context, config: BrowseDirectoryPickerConfig) {
    super(ctx, config)
    const upstream = super.capability()
    if (upstream.kind !== 'browse') {
      throw new Error('dsh-plugin-desktop: upstream directory picker did not provide browse capability')
    }
    this.desktopCapability = {
      ...upstream,
      list: async (path, signal) => await filterUnreadableDirectories(
        await upstream.list(path, signal),
        signal,
      ),
    }
  }

  /** @inheritdoc */
  override capability(): DirectoryPickerCapability {
    return this.desktopCapability ?? super.capability()
  }
}

export default DesktopWindowsBrowseDirectoryPicker
