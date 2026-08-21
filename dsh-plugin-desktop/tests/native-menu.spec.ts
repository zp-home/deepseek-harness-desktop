import type { MenuItemConstructorOptions } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import { macApplicationMenuTemplate } from '../src/native-menu.ts'

function submenu(item: MenuItemConstructorOptions): MenuItemConstructorOptions[] {
  if (!Array.isArray(item.submenu)) throw new Error('expected an array submenu')
  return item.submenu
}

describe('native macOS application menu', () => {
  it('localizes the complete Simplified Chinese menu while retaining native roles', () => {
    const showDesktop = vi.fn()
    const template = macApplicationMenuTemplate({
      productName: 'DSH Desktop',
      locale: 'zh',
      openDesktopLabel: '打开 DSH Desktop',
      showDesktop,
    })

    expect(template.map(item => item.label)).toEqual([
      'DSH Desktop', '文件', '编辑', '显示', '窗口',
    ])
    expect(submenu(template[0]!).map(item => item.label).filter(Boolean)).toEqual([
      '关于 DSH Desktop',
      '打开 DSH Desktop',
      '服务',
      '隐藏 DSH Desktop',
      '隐藏其他',
      '全部显示',
      '退出 DSH Desktop',
    ])
    expect(submenu(template[1]!)).toEqual([
      expect.objectContaining({ label: '关闭窗口', role: 'close' }),
    ])
    expect(submenu(template[2]!)).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: '拷贝', role: 'copy' }),
      expect.objectContaining({ label: '粘贴', role: 'paste' }),
      expect.objectContaining({ label: '全选', role: 'selectAll' }),
    ]))
    expect(submenu(template[3]!)).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: '实际大小', role: 'resetZoom' }),
      expect.objectContaining({ label: '放大', role: 'zoomIn' }),
      expect.objectContaining({ label: '缩小', role: 'zoomOut' }),
    ]))

    submenu(template[0]!).find(item => item.label === '打开 DSH Desktop')?.click?.(
      {} as never,
      undefined,
      {} as never,
    )
    expect(showDesktop).toHaveBeenCalledOnce()
  })

  it('keeps the English menu complete', () => {
    const template = macApplicationMenuTemplate({
      productName: 'DSH Desktop',
      locale: 'en',
      openDesktopLabel: 'Open DSH Desktop',
      showDesktop: vi.fn(),
    })

    expect(template.map(item => item.label)).toEqual([
      'DSH Desktop', 'File', 'Edit', 'View', 'Window',
    ])
    expect(submenu(template[0]!)).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'About DSH Desktop', role: 'about' }),
      expect.objectContaining({ label: 'Open DSH Desktop' }),
      expect.objectContaining({ label: 'Quit DSH Desktop', role: 'quit' }),
    ]))
  })
})
