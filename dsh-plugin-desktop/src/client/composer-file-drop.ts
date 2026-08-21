import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { DesktopFilePathBridge, DesktopFilePathBridgeWindow } from '../file-path-bridge-contract.ts'

const MAX_DROPPED_FILES = 32
const MAX_NATIVE_PATH_LENGTH = 32 * 1024
const MAX_DRAFT_LENGTH = 256 * 1024
const IMAGE_FILE_PATTERN = /\.(?:avif|bmp|gif|heic|heif|ico|jpe?g|png|svg|tiff?|webp)$/iu

interface ComposerInputState {
  readonly draft: string
  readonly phase: 'plain' | 'adjudicating' | 'claimed' | 'submitting'
}

interface ComposerInput {
  readonly state: {
    getSnapshot(): ComposerInputState
  }
  setDraft(text: string): void
}

interface ConversationInput {
  readonly input: {
    for(context: unknown): ComposerInput
  }
}

interface SessionsInput {
  readonly list: {
    getSnapshot(): { readonly current: string | undefined }
  }
  scope(sessionId: string): unknown
}

function isImage(file: File): boolean {
  return file.type.toLowerCase().startsWith('image/') || IMAGE_FILE_PATTERN.test(file.name)
}

function droppedPathItems(transfer: DataTransfer): readonly DataTransferItem[] | undefined {
  if (!Array.from(transfer.types).includes('Files')) return undefined
  const items = Array.from(transfer.items).filter(item => item.kind === 'file')
  if (items.length === 0 || items.length > MAX_DROPPED_FILES) return undefined
  try {
    if (items.some(item => item.webkitGetAsEntry()?.isDirectory === true
      || item.type.toLowerCase().startsWith('image/'))) return undefined
  } catch {
    return undefined
  }
  return items
}

/** Return ordinary files that should become native path references. */
export function droppedPathFiles(transfer: DataTransfer): readonly File[] | undefined {
  const items = droppedPathItems(transfer)
  if (items === undefined) return undefined
  const files: File[] = []
  for (const item of items) {
    const file = item.getAsFile()
    if (file === null || isImage(file)) return undefined
    files.push(file)
  }
  return files.length === 0 ? undefined : files
}

function isAbsoluteNativePath(path: string): boolean {
  return path.startsWith('/') || /^[A-Za-z]:[\\/]/u.test(path) || path.startsWith('\\\\')
}

/** Resolve only bounded, absolute paths returned by Electron's native bridge. */
export function resolveDroppedPaths(
  files: readonly File[],
  bridge: DesktopFilePathBridge,
): readonly string[] | undefined {
  const paths: string[] = []
  const seen = new Set<string>()
  try {
    for (const file of files) {
      const path = bridge.getPathForFile(file)
      if (path.trim().length === 0 || path.length > MAX_NATIVE_PATH_LENGTH || /[\0\r\n]/u.test(path)
        || !isAbsoluteNativePath(path)) return undefined
      if (!seen.has(path)) {
        seen.add(path)
        paths.push(path)
      }
    }
  } catch {
    return undefined
  }
  return paths.length === 0 ? undefined : paths
}

/** Append paths without rewriting an existing operator-authored draft. */
export function appendDroppedPaths(draft: string, paths: readonly string[]): string | undefined {
  const next = `${draft}${draft.length === 0 || draft.endsWith('\n') ? '' : '\n'}${paths.join('\n')}`
  return next.length <= MAX_DRAFT_LENGTH ? next : undefined
}

function composerTextarea(documentRoot: Document): HTMLTextAreaElement | undefined {
  const candidate = documentRoot.querySelector<HTMLTextAreaElement>('[data-composer-card] textarea[data-phase]')
  if (candidate === null || candidate.disabled || candidate.readOnly
    || candidate.dataset.phase === 'inert') return undefined
  return candidate
}

function currentInput(ctx: ClientContext): ComposerInput | undefined {
  const sessions = ctx.get('sessions') as SessionsInput | undefined
  const conversation = ctx.get('conversation') as ConversationInput | undefined
  const sessionId = sessions?.list.getSnapshot().current
  if (sessions === undefined || conversation === undefined || sessionId === undefined) return undefined
  const scope = sessions.scope(sessionId)
  try {
    return conversation.input.for(scope)
  } catch {
    return undefined
  }
}

/** Install Desktop-only file-to-path intake while preserving folder and image drop owners. */
export function installComposerFileDrop(
  ctx: ClientContext,
  bridgeWindow: DesktopFilePathBridgeWindow = window as DesktopFilePathBridgeWindow,
  documentRoot: Document = document,
  windowRoot: Window = window,
): () => void {
  const claimDrag = (event: DragEvent): void => {
    const transfer = event.dataTransfer
    const input = currentInput(ctx)
    if (transfer === null || bridgeWindow.__DSH_DESKTOP_FILE_PATH__ === undefined
      || composerTextarea(documentRoot) === undefined || droppedPathItems(transfer) === undefined
      || input?.state.getSnapshot().phase !== 'plain') return
    event.preventDefault()
    event.stopImmediatePropagation()
    transfer.dropEffect = 'copy'
  }

  const onDrop = (event: DragEvent): void => {
    const transfer = event.dataTransfer
    const bridge = bridgeWindow.__DSH_DESKTOP_FILE_PATH__
    const textarea = composerTextarea(documentRoot)
    const input = currentInput(ctx)
    if (transfer === null || bridge === undefined || textarea === undefined
      || input?.state.getSnapshot().phase !== 'plain') return
    const files = droppedPathFiles(transfer)
    if (files === undefined) return
    const paths = resolveDroppedPaths(files, bridge)
    if (paths === undefined) return
    const state = input.state.getSnapshot()
    const next = appendDroppedPaths(state.draft, paths)
    if (next === undefined) return
    event.preventDefault()
    event.stopImmediatePropagation()
    input.setDraft(next)
    textarea.ownerDocument.defaultView?.requestAnimationFrame(() => {
      textarea.focus({ preventScroll: true })
      textarea.setSelectionRange(next.length, next.length)
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  windowRoot.addEventListener('dragenter', claimDrag, true)
  windowRoot.addEventListener('dragover', claimDrag, true)
  windowRoot.addEventListener('drop', onDrop, true)
  return () => {
    windowRoot.removeEventListener('dragenter', claimDrag, true)
    windowRoot.removeEventListener('dragover', claimDrag, true)
    windowRoot.removeEventListener('drop', onDrop, true)
  }
}
