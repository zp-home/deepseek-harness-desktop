// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DesktopSettingsSection,
  type DesktopNotificationSettings,
  type DesktopSettingsSectionProps,
  type DesktopShellSettings,
} from '../src/client/DesktopSettingsSection.tsx'
import type { DesktopSettingsApi, DesktopSettingsView } from '../src/client/desktop-settings-api.ts'
import { en } from '../src/client/desktop-settings-locales.ts'

Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, writable: true })

const VIEW: DesktopSettingsView = {
  current: 'desktop',
  profiles: [{ name: 'desktop', exists: true, webCapable: true, selectable: true }],
  market: { requested: 'disabled', effective: 'disabled', legacyDefaulted: false },
  updates: { status: 'idle', currentVersion: '2.0.2', canInstall: true },
}

function scope<T>(value: T): SettingsScope<T> {
  const snapshot = {
    status: 'ready' as const,
    value,
    base: value,
    user: undefined,
    revision: 1,
    writable: true,
    mode: 'host' as const,
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
    set: async () => {},
    unset: async () => {},
  }
}

let root: Root | undefined
let container: HTMLDivElement | undefined

afterEach(() => {
  if (root !== undefined) act(() => { root?.unmount() })
  container?.remove()
  root = undefined
  container = undefined
})

function button(label: string): HTMLButtonElement {
  const match = [...(container?.querySelectorAll('button') ?? [])]
    .find(candidate => candidate.textContent === label)
  if (match === undefined) throw new Error(`button ${JSON.stringify(label)} was not rendered`)
  return match
}

describe('Desktop settings update controls', () => {
  it('checks and installs only the version returned by the safe settings API', async () => {
    const installUpdate = vi.fn(async () => {})
    const api: DesktopSettingsApi = {
      read: async () => VIEW,
      createProfile: async () => VIEW,
      selectProfile: async () => ({ accepted: true, restartRequired: false }),
      selectMarket: async () => ({ accepted: true, restartRequired: false }),
      openTerminal: async () => {},
      checkUpdates: async () => ({
        status: 'update-available',
        currentVersion: '2.0.2',
        latestVersion: '2.1.0',
        canInstall: true,
      }),
      installUpdate,
    }
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    const props = {
      t: (key: keyof typeof en) => en[key],
      api,
      platform: 'win32',
      initialMode: 'compatibility',
      desktopSettings: scope<DesktopShellSettings>({
        mode: 'compatibility', port: 43120, logLevel: 'info',
      }),
      notificationSettings: scope<DesktopNotificationSettings>({
        enabled: true,
        notifyOnTurnCompletion: true,
        notifyOnTurnFailure: true,
        notifyOnJobCompletion: true,
        notifyOnJobFailure: true,
      }),
    } as unknown as DesktopSettingsSectionProps

    await act(async () => { root?.render(<DesktopSettingsSection {...props} />) })
    expect(container.textContent).toContain('Installed version 2.0.2')

    await act(async () => { button('Check for updates').click() })
    expect(container.textContent).toContain('New version available 2.1.0')

    await act(async () => { button('Download and install').click() })
    expect(installUpdate).toHaveBeenCalledOnce()
    expect(installUpdate).toHaveBeenCalledWith('2.1.0')
  })
})
