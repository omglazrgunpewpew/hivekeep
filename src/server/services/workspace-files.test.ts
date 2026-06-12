import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
// Sync fs API on purpose: image-tools.test.ts mock.module()s 'fs/promises'
// process-globally (mkdir becomes a no-op) and Bun cannot un-mock it — the
// sync 'node:fs' surface is not covered by that mock. See the custom-tools
// mock.module gotcha.
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, rmSync, realpathSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mock } from 'bun:test'
import { fullMockConfig } from '../../test-helpers'

// Other suites mock.module('@/server/config') and Bun's module mocks are
// process-global — pin our own full config so test order can't starve the
// service of config.workspaceFiles (same gotcha as fs/promises above).
const testConfig = JSON.parse(JSON.stringify(fullMockConfig)) as typeof fullMockConfig
mock.module('@/server/config', () => ({ config: testConfig }))

import {
  resolveInRoot,
  writeWorkspaceFile,
  normalizeRelPath,
  validateEntryName,
  WorkspaceFilesError,
} from '@/server/services/workspace-files'

/**
 * Security tests for the Files section containment helper (files.md § 7.8).
 * These are BLOCKING for P1: every vector here was identified by the
 * adversarial spec review.
 */

let root: string
let outside: string

beforeEach(() => {
  const base = mkdtempSync(join(tmpdir(), 'hivekeep-wsfiles-'))
  root = join(base, 'workspace')
  outside = join(base, 'outside')
  mkdirSync(root, { recursive: true })
  mkdirSync(outside, { recursive: true })
  writeFileSync(join(outside, 'secret.txt'), 'top secret')
  writeFileSync(join(root, 'hello.txt'), 'hello')
  mkdirSync(join(root, 'docs'))
  writeFileSync(join(root, 'docs', 'guide.md'), '# guide')
})

afterEach(() => {
  rmSync(join(root, '..'), { recursive: true, force: true })
})

const expectForbidden = async (promise: Promise<unknown>) => {
  await expect(promise).rejects.toThrow(WorkspaceFilesError)
  try {
    await promise
  } catch (err) {
    expect((err as WorkspaceFilesError).code).toBe('PATH_FORBIDDEN')
  }
}

describe('normalizeRelPath', () => {
  test('accepts normal relative paths', () => {
    expect(normalizeRelPath('docs/guide.md')).toBe('docs/guide.md')
    expect(normalizeRelPath('./docs//guide.md')).toBe('docs/guide.md')
    expect(normalizeRelPath('')).toBe('')
  })

  test('rejects traversal, absolute paths, control chars', () => {
    expect(() => normalizeRelPath('../etc/passwd')).toThrow(WorkspaceFilesError)
    expect(() => normalizeRelPath('docs/../../etc')).toThrow(WorkspaceFilesError)
    expect(() => normalizeRelPath('/etc/passwd')).toThrow(WorkspaceFilesError)
    expect(() => normalizeRelPath('C:/windows')).toThrow(WorkspaceFilesError)
    expect(() => normalizeRelPath('docs\\guide.md')).toThrow(WorkspaceFilesError)
    expect(() => normalizeRelPath('docs/\x00evil')).toThrow(WorkspaceFilesError)
    expect(() => normalizeRelPath('~/secrets')).toThrow(WorkspaceFilesError)
  })

  test('URL-decoded traversal still caught (route decodes %2e%2e to ..)', () => {
    expect(() => normalizeRelPath(decodeURIComponent('%2e%2e/etc'))).toThrow(WorkspaceFilesError)
  })
})

describe('resolveInRoot — containment', () => {
  test('resolves the root itself (ls of the workspace root must not be rejected)', async () => {
    const resolved = await resolveInRoot(root, '')
    expect(resolved.exists).toBe(true)
    expect(resolved.abs).toBe(realpathSync(root))
  })

  test('resolves a normal nested file', async () => {
    const resolved = await resolveInRoot(root, 'docs/guide.md')
    expect(resolved.exists).toBe(true)
    expect(resolved.rel).toBe('docs/guide.md')
  })

  test('nonexistent path resolves with exists=false (for writes)', async () => {
    const resolved = await resolveInRoot(root, 'new/sub/file.txt', { forWrite: true })
    expect(resolved.exists).toBe(false)
  })

  test('BLOCKS symlink LEAF pointing outside (read)', async () => {
    symlinkSync(join(outside, 'secret.txt'), join(root, 'leak'))
    await expectForbidden(resolveInRoot(root, 'leak'))
  })

  test('BLOCKS symlink leaf for WRITE even when target is inside', async () => {
    symlinkSync(join(root, 'hello.txt'), join(root, 'self-link'))
    await expectForbidden(resolveInRoot(root, 'self-link', { forWrite: true }))
  })

  test('ALLOWS reading through a symlink that stays confined', async () => {
    symlinkSync(join(root, 'hello.txt'), join(root, 'alias.txt'))
    const resolved = await resolveInRoot(root, 'alias.txt')
    expect(resolved.exists).toBe(true)
    expect(resolved.abs).toBe(realpathSync(join(root, 'hello.txt')))
  })

  test('BLOCKS symlinked PARENT directory escaping the root', async () => {
    symlinkSync(outside, join(root, 'evil-dir'))
    await expectForbidden(resolveInRoot(root, 'evil-dir/secret.txt'))
  })

  test('BLOCKS path through symlinked parent even when leaf does not exist (write)', async () => {
    symlinkSync(outside, join(root, 'evil-dir'))
    await expectForbidden(resolveInRoot(root, 'evil-dir/new-file.txt', { forWrite: true }))
  })

  test('broken symlink is forbidden, not a crash', async () => {
    symlinkSync(join(outside, 'does-not-exist'), join(root, 'dangling'))
    await expectForbidden(resolveInRoot(root, 'dangling'))
  })
})

describe('writeWorkspaceFile', () => {
  // Point the real config at the temp dir so workspaceRootFor('agent-w') = root.
  beforeEach(() => {
    ;(testConfig.workspace as { baseDir: string }).baseDir = join(root, '..')
    rmSync(root, { recursive: true, force: true })
    mkdirSync(root, { recursive: true })
  })

  const AGENT = 'workspace' // root = <base>/workspace from the shared fixture

  test('creates a file (and parents) and returns mtime', async () => {
    const result = await writeWorkspaceFile(AGENT, 'notes/new/file.txt', 'hello')
    expect(result.path).toBe('notes/new/file.txt')
    expect(result.size).toBe(5)
    expect(readFileSync(join(root, 'notes/new/file.txt'), 'utf8')).toBe('hello')
  })

  test('createOnly refuses to overwrite (DEST_EXISTS)', async () => {
    await writeWorkspaceFile(AGENT, 'a.txt', 'one')
    try {
      await writeWorkspaceFile(AGENT, 'a.txt', 'two', { createOnly: true })
      expect.unreachable()
    } catch (err) {
      expect((err as WorkspaceFilesError).code).toBe('DEST_EXISTS')
    }
    expect(readFileSync(join(root, 'a.txt'), 'utf8')).toBe('one')
  })

  test('optimistic concurrency: stale baseModifiedAt → CONFLICT', async () => {
    const first = await writeWorkspaceFile(AGENT, 'b.txt', 'v1')
    await writeWorkspaceFile(AGENT, 'b.txt', 'v2') // concurrent writer (the agent)
    // Same-millisecond writes share an mtime — bump it like a real later write.
    const bumped = new Date(first.modifiedAt + 50)
    utimesSync(join(root, 'b.txt'), bumped, bumped)
    try {
      await writeWorkspaceFile(AGENT, 'b.txt', 'v3', { baseModifiedAt: first.modifiedAt })
      expect.unreachable()
    } catch (err) {
      expect((err as WorkspaceFilesError).code).toBe('CONFLICT')
    }
    expect(readFileSync(join(root, 'b.txt'), 'utf8')).toBe('v2')
  })

  test('matching baseModifiedAt writes fine', async () => {
    const first = await writeWorkspaceFile(AGENT, 'c.txt', 'v1')
    const second = await writeWorkspaceFile(AGENT, 'c.txt', 'v2', { baseModifiedAt: first.modifiedAt })
    expect(second.size).toBe(2)
  })

  test('refuses to write through a symlink leaf', async () => {
    writeFileSync(join(outside, 'target.txt'), 'x')
    symlinkSync(join(outside, 'target.txt'), join(root, 'link.txt'))
    await expectForbidden(writeWorkspaceFile(AGENT, 'link.txt', 'pwned'))
    expect(readFileSync(join(outside, 'target.txt'), 'utf8')).toBe('x')
  })

  test('rejects invalid new-file names (INVALID_NAME)', async () => {
    try {
      await writeWorkspaceFile(AGENT, 'dir/' + 'x'.repeat(256), 'data')
      expect.unreachable()
    } catch (err) {
      expect((err as WorkspaceFilesError).code).toBe('INVALID_NAME')
    }
  })
})

describe('validateEntryName', () => {
  test('accepts normal names including spaces and accents', () => {
    expect(() => validateEntryName('Rapport final.md')).not.toThrow()
    expect(() => validateEntryName('synthèse.md')).not.toThrow()
  })

  test('rejects empty, reserved, separators, control chars, oversized', () => {
    expect(() => validateEntryName('')).toThrow(WorkspaceFilesError)
    expect(() => validateEntryName('   ')).toThrow(WorkspaceFilesError)
    expect(() => validateEntryName('.')).toThrow(WorkspaceFilesError)
    expect(() => validateEntryName('..')).toThrow(WorkspaceFilesError)
    expect(() => validateEntryName('a/b')).toThrow(WorkspaceFilesError)
    expect(() => validateEntryName('a\\b')).toThrow(WorkspaceFilesError)
    expect(() => validateEntryName('a\x00b')).toThrow(WorkspaceFilesError)
    expect(() => validateEntryName('x'.repeat(256))).toThrow(WorkspaceFilesError)
  })
})
