/** Localized macOS application menu owned by one native shell generation. */

import type { MenuItemConstructorOptions } from 'electron'
import type { DesktopLocale } from './runtime.ts'

interface NativeMenuLabels {
  readonly about: string
  readonly closeWindow: string
  readonly copy: string
  readonly cut: string
  readonly delete: string
  readonly edit: string
  readonly file: string
  readonly forceReload: string
  readonly hide: string
  readonly hideOthers: string
  readonly minimize: string
  readonly paste: string
  readonly pasteAndMatchStyle: string
  readonly quit: string
  readonly redo: string
  readonly reload: string
  readonly resetZoom: string
  readonly selectAll: string
  readonly services: string
  readonly showAll: string
  readonly toggleDevTools: string
  readonly toggleFullScreen: string
  readonly undo: string
  readonly view: string
  readonly window: string
  readonly windowFront: string
  readonly windowZoom: string
  readonly zoomIn: string
  readonly zoomOut: string
}

const LABELS: Readonly<Record<DesktopLocale, NativeMenuLabels>> = {
  en: {
    about: 'About',
    closeWindow: 'Close Window',
    copy: 'Copy',
    cut: 'Cut',
    delete: 'Delete',
    edit: 'Edit',
    file: 'File',
    forceReload: 'Force Reload',
    hide: 'Hide',
    hideOthers: 'Hide Others',
    minimize: 'Minimize',
    paste: 'Paste',
    pasteAndMatchStyle: 'Paste and Match Style',
    quit: 'Quit',
    redo: 'Redo',
    reload: 'Reload',
    resetZoom: 'Actual Size',
    selectAll: 'Select All',
    services: 'Services',
    showAll: 'Show All',
    toggleDevTools: 'Developer Tools',
    toggleFullScreen: 'Enter Full Screen',
    undo: 'Undo',
    view: 'View',
    window: 'Window',
    windowFront: 'Bring All to Front',
    windowZoom: 'Zoom',
    zoomIn: 'Zoom In',
    zoomOut: 'Zoom Out',
  },
  zh: {
    about: '关于',
    closeWindow: '关闭窗口',
    copy: '拷贝',
    cut: '剪切',
    delete: '删除',
    edit: '编辑',
    file: '文件',
    forceReload: '强制重新载入',
    hide: '隐藏',
    hideOthers: '隐藏其他',
    minimize: '最小化',
    paste: '粘贴',
    pasteAndMatchStyle: '粘贴并匹配样式',
    quit: '退出',
    redo: '重做',
    reload: '重新载入',
    resetZoom: '实际大小',
    selectAll: '全选',
    services: '服务',
    showAll: '全部显示',
    toggleDevTools: '开发者工具',
    toggleFullScreen: '进入全屏幕',
    undo: '撤销',
    view: '显示',
    window: '窗口',
    windowFront: '前置全部窗口',
    windowZoom: '缩放',
    zoomIn: '放大',
    zoomOut: '缩小',
  },
}

export interface MacApplicationMenuOptions {
  readonly productName: string
  readonly locale: DesktopLocale
  readonly openDesktopLabel: string
  readonly showDesktop: () => void
}

/** Build the complete menu with explicit copy while preserving Electron roles. */
export function macApplicationMenuTemplate(
  options: MacApplicationMenuOptions,
): MenuItemConstructorOptions[] {
  const label = LABELS[options.locale]
  return [
    {
      label: options.productName,
      submenu: [
        { label: `${label.about} ${options.productName}`, role: 'about' },
        { type: 'separator' },
        { label: options.openDesktopLabel, click: options.showDesktop },
        { type: 'separator' },
        { label: label.services, role: 'services' },
        { type: 'separator' },
        { label: `${label.hide} ${options.productName}`, role: 'hide' },
        { label: label.hideOthers, role: 'hideOthers' },
        { label: label.showAll, role: 'unhide' },
        { type: 'separator' },
        { label: `${label.quit} ${options.productName}`, role: 'quit' },
      ],
    },
    {
      label: label.file,
      submenu: [{ label: label.closeWindow, role: 'close' }],
    },
    {
      label: label.edit,
      submenu: [
        { label: label.undo, role: 'undo' },
        { label: label.redo, role: 'redo' },
        { type: 'separator' },
        { label: label.cut, role: 'cut' },
        { label: label.copy, role: 'copy' },
        { label: label.paste, role: 'paste' },
        { label: label.pasteAndMatchStyle, role: 'pasteAndMatchStyle' },
        { label: label.delete, role: 'delete' },
        { label: label.selectAll, role: 'selectAll' },
      ],
    },
    {
      label: label.view,
      submenu: [
        { label: label.reload, role: 'reload' },
        { label: label.forceReload, role: 'forceReload' },
        { label: label.toggleDevTools, role: 'toggleDevTools' },
        { type: 'separator' },
        { label: label.resetZoom, role: 'resetZoom' },
        { label: label.zoomIn, role: 'zoomIn' },
        { label: label.zoomOut, role: 'zoomOut' },
        { type: 'separator' },
        { label: label.toggleFullScreen, role: 'togglefullscreen' },
      ],
    },
    {
      label: label.window,
      submenu: [
        { label: label.minimize, role: 'minimize' },
        { label: label.windowZoom, role: 'zoom' },
        { type: 'separator' },
        { label: label.windowFront, role: 'front' },
      ],
    },
  ]
}
