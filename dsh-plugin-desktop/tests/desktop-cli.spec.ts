import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import {
  blockedBuildsHint,
  clearElectronRunAsNode,
  runDesktopDshCli,
  withDefaultDesktopProfile,
} from '../src/desktop-cli.ts'
import {
  DESKTOP_INSTALL_RECOVERY_STATE_ENV,
  desktopInstallRecoveryStatePath,
} from '../src/install-recovery.ts'
import { packagedDependencyPath, unpackedAsarPath } from '../src/packaged-runtime-path.ts'

describe('packaged dsh bootstrap', () => {
  it('removes every Windows casing of Electron Node mode', () => {
    const environment = {
      ELECTRON_RUN_AS_NODE: '1',
      electron_run_as_node: 'inherited',
      Path: 'C:\\Windows',
    }

    clearElectronRunAsNode(environment)

    expect(environment).toEqual({ Path: 'C:\\Windows' })
  })

  it('clears Node mode before loading the fixed packaged CLI entry', async () => {
    const environment = {
      ELECTRON_RUN_AS_NODE: '1',
      DSH_DESKTOP_DEFAULT_PROFILE: 'desktop',
      KEEP: 'value',
    }
    const argv = ['/Applications/DSH Desktop', '/app.asar/lib/desktop-cli.js', '--dump-config']
    const load = vi.fn(async (url: string) => {
      expect(environment).toEqual({ KEEP: 'value' })
      expect(argv).toEqual([
        '/Applications/DSH Desktop',
        '/app.asar/lib/desktop-cli.js',
        '--profile',
        'desktop',
        '--dump-config',
      ])
      expect(url).toMatch(/\/node_modules\/@deepseek-ai\/dsh\/lib\/bin\.js$/u)
    })

    await runDesktopDshCli(environment, load, argv)

    expect(load).toHaveBeenCalledOnce()
  })

  it('defaults profile and plugin commands without overriding explicit or global modes', () => {
    expect(withDefaultDesktopProfile([], 'desktop')).toEqual(['--profile', 'desktop'])
    expect(withDefaultDesktopProfile(['--dump-config'], 'desktop')).toEqual([
      '--profile',
      'desktop',
      '--dump-config',
    ])
    expect(withDefaultDesktopProfile(['plugin', 'add', 'third-party'], 'desktop')).toEqual([
      'plugin',
      '--profile',
      'desktop',
      'add',
      'third-party',
    ])
    expect(withDefaultDesktopProfile(['--profile', 'web'], 'desktop')).toEqual(['--profile', 'web'])
    expect(withDefaultDesktopProfile(['--profile=web'], 'desktop')).toEqual(['--profile=web'])
    expect(withDefaultDesktopProfile(['web'], 'desktop')).toEqual(['web'])
    expect(withDefaultDesktopProfile(['--help'], 'desktop')).toEqual(['--help'])
    expect(withDefaultDesktopProfile(['--version'], 'desktop')).toEqual(['--version'])
    expect(withDefaultDesktopProfile(['plugin', 'update'], '工作 profile')).toEqual([
      'plugin',
      '--profile',
      '工作 profile',
      'update',
    ])
    expect(() => withDefaultDesktopProfile([], '../desktop')).toThrow('invalid desktop profile name')
  })

  it('snapshots plugin installs launched from the built-in DSH Terminal', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-desktop-terminal-recovery-'))
    const homeDir = join(root, 'home')
    const profileDir = join(homeDir, 'profiles', 'desktop')
    const userDataDir = join(root, 'user-data')
    const statePath = desktopInstallRecoveryStatePath(userDataDir)
    const manifestPath = join(profileDir, 'package.json')
    const originalExitCode = process.exitCode
    try {
      mkdirSync(profileDir, { recursive: true })
      writeFileSync(manifestPath, JSON.stringify({ dependencies: {} }))
      const environment = {
        DSH_HOME: homeDir,
        DSH_DESKTOP_DEFAULT_PROFILE: 'desktop',
        [DESKTOP_INSTALL_RECOVERY_STATE_ENV]: statePath,
      }
      const argv = [process.execPath, '/app/desktop-cli.js', 'plugin', 'add', 'example-plugin']

      await runDesktopDshCli(environment, async () => {
        writeFileSync(manifestPath, JSON.stringify({ dependencies: { 'example-plugin': '1.0.0' } }))
        process.exit(0)
      }, argv)

      expect(environment).toEqual({ DSH_HOME: homeDir })
      expect(argv.slice(2)).toEqual(['plugin', '--profile', 'desktop', 'add', 'example-plugin'])
      expect(JSON.parse(readFileSync(statePath, 'utf8'))).toMatchObject({
        profileName: 'desktop',
        packageName: 'manual-plugin-install',
        phase: 'awaiting-restart',
      })
    } finally {
      process.exitCode = originalExitCode
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('binds a built-in terminal snapshot to an explicitly selected profile', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-desktop-terminal-explicit-profile-'))
    const homeDir = join(root, 'home')
    const desktopDir = join(homeDir, 'profiles', 'desktop')
    const webDir = join(homeDir, 'profiles', 'web')
    const statePath = desktopInstallRecoveryStatePath(join(root, 'user-data'))
    const desktopManifest = join(desktopDir, 'package.json')
    const webManifest = join(webDir, 'package.json')
    const originalExitCode = process.exitCode
    try {
      mkdirSync(desktopDir, { recursive: true })
      mkdirSync(webDir, { recursive: true })
      writeFileSync(desktopManifest, JSON.stringify({ name: 'desktop-profile' }))
      writeFileSync(webManifest, JSON.stringify({ name: 'web-profile', dependencies: {} }))

      await runDesktopDshCli({
        DSH_HOME: homeDir,
        DSH_DESKTOP_DEFAULT_PROFILE: 'desktop',
        [DESKTOP_INSTALL_RECOVERY_STATE_ENV]: statePath,
      }, async () => {
        writeFileSync(webManifest, JSON.stringify({
          name: 'web-profile',
          dependencies: { 'example-plugin': '1.0.0' },
        }))
        process.exit(0)
      }, [process.execPath, '/app/desktop-cli.js', 'plugin', '--profile', 'web', 'add', 'example-plugin'])

      expect(JSON.parse(readFileSync(statePath, 'utf8'))).toMatchObject({
        profileName: 'web',
        phase: 'awaiting-restart',
      })
      expect(JSON.parse(readFileSync(desktopManifest, 'utf8'))).toEqual({ name: 'desktop-profile' })
    } finally {
      process.exitCode = originalExitCode
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('restores and clears a built-in terminal snapshot when plugin add fails', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-desktop-terminal-recovery-failure-'))
    const homeDir = join(root, 'home')
    const profileDir = join(homeDir, 'profiles', 'desktop')
    const statePath = desktopInstallRecoveryStatePath(join(root, 'user-data'))
    const manifestPath = join(profileDir, 'package.json')
    const originalExitCode = process.exitCode
    try {
      mkdirSync(profileDir, { recursive: true })
      const originalManifest = JSON.stringify({ dependencies: {} })
      writeFileSync(manifestPath, originalManifest)
      await runDesktopDshCli({
        DSH_HOME: homeDir,
        DSH_DESKTOP_DEFAULT_PROFILE: 'desktop',
        [DESKTOP_INSTALL_RECOVERY_STATE_ENV]: statePath,
      }, async () => {
        writeFileSync(manifestPath, JSON.stringify({ dependencies: { 'broken-plugin': '0.0.0' } }))
        process.exit(1)
      }, [process.execPath, '/app/desktop-cli.js', 'plugin', 'add', 'broken-plugin'])

      expect(readFileSync(manifestPath, 'utf8')).toBe(originalManifest)
      expect(existsSync(statePath)).toBe(false)
      expect(process.exitCode).toBe(1)
    } finally {
      process.exitCode = originalExitCode
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('builds a bounded allowBuilds hint from the parsed workspace document', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-desktop-blocked-builds-hint-'))
    try {
      writeFileSync(join(root, 'pnpm-workspace.yaml'), [
        'allowBuilds:',
        '  node-pty: set this to true or false',
        '  "@scope/native-addon": "set this to true or false"',
        '  already-reviewed: true',
        'other:',
        '  ignored: set this to true or false',
        '',
      ].join('\n'))

      const hint = await blockedBuildsHint(root)

      expect(hint).toContain('require explicit approval')
      expect(hint).toContain('After recovery, add only trusted entries')
      expect(hint).toContain(join(root, 'pnpm-workspace.yaml'))
      expect(hint).toContain('    node-pty: true')
      expect(hint).toContain('    @scope/native-addon: true')
      expect(hint).not.toContain('already-reviewed')
      expect(hint).not.toContain('ignored')
      expect(hint).toContain('Unapproved scripts remain blocked')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('does not turn malformed, unsafe, or oversized workspace data into guidance', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-desktop-blocked-builds-invalid-'))
    const workspacePath = join(root, 'pnpm-workspace.yaml')
    try {
      expect(await blockedBuildsHint(join(root, 'missing'))).toBeUndefined()

      writeFileSync(workspacePath, 'allowBuilds: [unterminated')
      expect(await blockedBuildsHint(root)).toBeUndefined()

      writeFileSync(workspacePath, [
        'allowBuilds:',
        '  "unsafe\\u001b[31m": set this to true or false',
        '  ordinary-package: false',
        '',
      ].join('\n'))
      expect(await blockedBuildsHint(root)).toBeUndefined()

      writeFileSync(workspacePath, `# ${'x'.repeat(64 * 1024)}\nallowBuilds:\n  node-pty: set this to true or false\n`)
      expect(await blockedBuildsHint(root)).toBeUndefined()
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('prints blocked-build guidance before restoring a failed terminal install', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-desktop-terminal-allowbuilds-'))
    const homeDir = join(root, 'home')
    const profileDir = join(homeDir, 'profiles', 'desktop')
    const statePath = desktopInstallRecoveryStatePath(join(root, 'user-data'))
    const manifestPath = join(profileDir, 'package.json')
    const workspacePath = join(profileDir, 'pnpm-workspace.yaml')
    const originalExitCode = process.exitCode
    const stderrWrite = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    try {
      mkdirSync(profileDir, { recursive: true })
      const originalManifest = JSON.stringify({ dependencies: {} })
      const originalWorkspace = 'packages:\n  - .\n'
      writeFileSync(manifestPath, originalManifest)
      writeFileSync(workspacePath, originalWorkspace)

      await runDesktopDshCli({
        DSH_HOME: homeDir,
        DSH_DESKTOP_DEFAULT_PROFILE: 'desktop',
        [DESKTOP_INSTALL_RECOVERY_STATE_ENV]: statePath,
      }, async () => {
        writeFileSync(manifestPath, JSON.stringify({ dependencies: { 'broken-plugin': '0.0.0' } }))
        writeFileSync(workspacePath, 'allowBuilds:\n  node-pty: set this to true or false\n')
        process.exit(1)
      }, [process.execPath, '/app/desktop-cli.js', 'plugin', 'add', 'broken-plugin'])

      expect(readFileSync(manifestPath, 'utf8')).toBe(originalManifest)
      expect(readFileSync(workspacePath, 'utf8')).toBe(originalWorkspace)
      expect(existsSync(statePath)).toBe(false)
      expect(process.exitCode).toBe(1)
      const written = stderrWrite.mock.calls.map(call => String(call[0])).join('')
      expect(written).toContain('pnpm blocked dependency build scripts')
      expect(written).toContain('    node-pty: true')
    } finally {
      stderrWrite.mockRestore()
      process.exitCode = originalExitCode
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('uses the physical unpacked dependency tree only inside an Electron package', () => {
    expect(unpackedAsarPath('/Applications/DSH Desktop.app/Contents/Resources/app.asar/node_modules/pkg'))
      .toBe('/Applications/DSH Desktop.app/Contents/Resources/app.asar.unpacked/node_modules/pkg')
    expect(unpackedAsarPath('C:\\Program Files\\DSH Desktop\\resources\\app.asar\\node_modules\\pkg'))
      .toBe('C:\\Program Files\\DSH Desktop\\resources\\app.asar.unpacked\\node_modules\\pkg')
    expect(unpackedAsarPath('/Applications/DSH Desktop.app/Contents/Resources/app.asar/package.json'))
      .toBe('/Applications/DSH Desktop.app/Contents/Resources/app.asar.unpacked/package.json')
    expect(unpackedAsarPath('/workspace/node_modules/pkg')).toBe('/workspace/node_modules/pkg')
    expect(() => packagedDependencyPath(import.meta.url, '../outside.js'))
      .toThrow('relative POSIX path')
  })

  it('maps a resolved ASAR dependency to its physical unpacked path', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-desktop-asar-profile-'))
    const desktopLib = join(root, 'app.asar', 'lib')
    const dshPackage = join(root, 'app.asar', 'node_modules', '@deepseek-ai', 'dsh')
    try {
      mkdirSync(desktopLib, { recursive: true })
      mkdirSync(join(dshPackage, 'lib'), { recursive: true })
      writeFileSync(join(dshPackage, 'package.json'), JSON.stringify({
        name: '@deepseek-ai/dsh',
        type: 'module',
      }))
      writeFileSync(join(dshPackage, 'lib', 'bin.js'), '')

      const moduleUrl = pathToFileURL(join(desktopLib, 'desktop-cli.js')).href
      expect(packagedDependencyPath(moduleUrl, '@deepseek-ai/dsh/lib/bin.js')).toBe(join(
        realpathSync(root),
        'app.asar.unpacked',
        'node_modules',
        '@deepseek-ai',
        'dsh',
        'lib',
        'bin.js',
      ))
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('resolves the DSH entry from a pnpm profile with flat package dependencies', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-desktop-flat-profile-'))
    const desktopLib = join(root, 'node_modules', 'dsh-plugin-desktop', 'lib')
    const dshPackage = join(root, 'node_modules', '@deepseek-ai', 'dsh')
    const dshEntry = join(dshPackage, 'lib', 'bin.js')
    const pnpmPackage = join(root, 'node_modules', 'pnpm')
    const pnpmEntry = join(pnpmPackage, 'bin', 'pnpm.mjs')
    try {
      mkdirSync(desktopLib, { recursive: true })
      mkdirSync(join(dshPackage, 'lib'), { recursive: true })
      mkdirSync(join(pnpmPackage, 'bin'), { recursive: true })
      writeFileSync(join(dshPackage, 'package.json'), JSON.stringify({
        name: '@deepseek-ai/dsh',
        type: 'module',
      }))
      writeFileSync(dshEntry, '')
      writeFileSync(join(pnpmPackage, 'package.json'), JSON.stringify({
        name: 'pnpm',
        exports: { '.': './package.json' },
      }))
      writeFileSync(pnpmEntry, '')

      const moduleUrl = pathToFileURL(join(desktopLib, 'desktop-cli.js')).href
      expect(packagedDependencyPath(moduleUrl, '@deepseek-ai/dsh/lib/bin.js'))
        .toBe(join(realpathSync(root), 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'))
      expect(packagedDependencyPath(moduleUrl, 'pnpm/bin/pnpm.mjs'))
        .toBe(join(realpathSync(root), 'node_modules', 'pnpm', 'bin', 'pnpm.mjs'))
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
