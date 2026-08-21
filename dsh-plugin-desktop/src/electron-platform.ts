import { app, Menu } from 'electron'
import type { BrowserWindow, NativeImage } from 'electron'
import { macApplicationMenuTemplate, type MacApplicationMenuOptions } from './native-menu.ts'
import type { DesktopPlatform } from './runtime.ts'
import type { DesktopDownloadPlatform } from './update-download.ts'

export interface ElectronApplicationMenuRegistration {
  isCurrent(): boolean
  release(): void
}

function inactiveApplicationMenu(): ElectronApplicationMenuRegistration {
  return {
    isCurrent: () => true,
    release: () => {},
  }
}

/** Native presentation and capability differences selected once at startup. */
export interface ElectronPlatformStrategy {
  readonly platform: DesktopPlatform
  readonly updateDownloadPlatform: DesktopDownloadPlatform | undefined
  readonly canPickDirectory: boolean
  readonly canToggleShellMode: boolean
  configureApplication(icon: NativeImage): void
  configureWindow(window: BrowserWindow): void
  installApplicationMenu(options: MacApplicationMenuOptions): ElectronApplicationMenuRegistration
  refreshThemeMaterial(window: BrowserWindow): void
}

class WindowsPlatformStrategy implements ElectronPlatformStrategy {
  readonly platform = 'win32'
  readonly updateDownloadPlatform = 'win32'
  readonly canPickDirectory = true
  readonly canToggleShellMode = true

  configureApplication(_icon: NativeImage): void {}

  configureWindow(window: BrowserWindow): void {
    window.removeMenu()
  }

  installApplicationMenu(_options: MacApplicationMenuOptions): ElectronApplicationMenuRegistration {
    return inactiveApplicationMenu()
  }

  refreshThemeMaterial(window: BrowserWindow): void {
    window.setBackgroundMaterial('mica')
  }
}

class MacPlatformStrategy implements ElectronPlatformStrategy {
  readonly platform = 'darwin'
  readonly updateDownloadPlatform = 'darwin'
  readonly canPickDirectory = false
  readonly canToggleShellMode = true

  configureApplication(icon: NativeImage): void {
    app.dock?.setIcon(icon)
  }

  configureWindow(_window: BrowserWindow): void {}

  installApplicationMenu(options: MacApplicationMenuOptions): ElectronApplicationMenuRegistration {
    const previousMenu = Menu.getApplicationMenu()
    const menu = Menu.buildFromTemplate(macApplicationMenuTemplate(options))
    let active = true
    Menu.setApplicationMenu(menu)
    return {
      isCurrent: () => active && Menu.getApplicationMenu() === menu,
      release: () => {
        if (!active) return
        active = false
        if (Menu.getApplicationMenu() === menu) Menu.setApplicationMenu(previousMenu)
      },
    }
  }

  refreshThemeMaterial(_window: BrowserWindow): void {}
}

class LinuxPlatformStrategy implements ElectronPlatformStrategy {
  readonly platform = 'linux'
  readonly updateDownloadPlatform = undefined
  readonly canPickDirectory = false
  readonly canToggleShellMode = false

  configureApplication(_icon: NativeImage): void {}

  configureWindow(_window: BrowserWindow): void {}

  installApplicationMenu(_options: MacApplicationMenuOptions): ElectronApplicationMenuRegistration {
    return inactiveApplicationMenu()
  }

  refreshThemeMaterial(_window: BrowserWindow): void {}
}

/** Select the only platform adapter used by one Electron runtime generation. */
export function electronPlatformStrategy(platform: NodeJS.Platform = process.platform): ElectronPlatformStrategy {
  if (platform === 'win32') return new WindowsPlatformStrategy()
  if (platform === 'darwin') return new MacPlatformStrategy()
  if (platform === 'linux') return new LinuxPlatformStrategy()
  throw new Error(`dsh-plugin-desktop: unsupported Electron platform ${platform}`)
}
