/**
 * Roz Recycle & State Versioning Engine for RITA Suite.
 * Provides file snapshots, state rollbacks, and conversational backup buffers.
 * @module @deepseek-ai/dsh-rita-suite/roz-engine
 */

import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { copyFile, mkdir, readFile, readdir, stat, unlink, writeFile, access } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { FileVersionInfo, RozEngineConfig } from './types.ts'

export class RozRecycleEngine {
  private stagingDir: string
  private retentionMs: number
  private versioningEnabled: boolean
  private maxVersionsPerFile: number
  private manifestPath: string

  constructor(stagingDir = '_archive/staging', retentionHours = 48, versioningEnabled = true, maxVersionsPerFile = 50) {
    this.stagingDir = stagingDir
    this.retentionMs = retentionHours * 60 * 60 * 1000
    this.versioningEnabled = versioningEnabled
    this.maxVersionsPerFile = maxVersionsPerFile
    this.manifestPath = join(stagingDir, 'versions', 'manifest.json')
    this.ensureStaging()
  }

  private ensureStaging(): void {
    if (!existsSync(this.stagingDir)) {
      try {
        mkdirSync(this.stagingDir, { recursive: true })
      } catch {
        // best effort
      }
    }
  }

  public async ensureStagingAsync(): Promise<void> {
    try {
      await mkdir(this.stagingDir, { recursive: true })
    } catch {
      // best effort
    }
  }

  private loadManifest(): Record<string, FileVersionInfo[]> {
    try {
      if (existsSync(this.manifestPath)) {
        const raw = readFileSync(this.manifestPath, 'utf-8')
        return JSON.parse(raw)
      }
    } catch {
      // fallback
    }
    return {}
  }

  private async loadManifestAsync(): Promise<Record<string, FileVersionInfo[]>> {
    try {
      const raw = await readFile(this.manifestPath, 'utf-8')
      return JSON.parse(raw)
    } catch {
      return {}
    }
  }

  private saveManifest(manifest: Record<string, FileVersionInfo[]>): void {
    try {
      const dir = join(this.stagingDir, 'versions')
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      writeFileSync(this.manifestPath, JSON.stringify(manifest, null, 2), 'utf-8')
    } catch {
      // best effort
    }
  }

  private async saveManifestAsync(manifest: Record<string, FileVersionInfo[]>): Promise<void> {
    try {
      const dir = join(this.stagingDir, 'versions')
      await mkdir(dir, { recursive: true })
      await writeFile(this.manifestPath, JSON.stringify(manifest, null, 2), 'utf-8')
    } catch {
      // best effort
    }
  }

  /** Back up a file before modification or deletion to 48h recycle buffer (Sync fallback) */
  public backupFile(filePath: string): string | undefined {
    if (!existsSync(filePath)) return undefined
    try {
      const today = new Date().toISOString().slice(0, 10)
      const dayDir = join(this.stagingDir, today)
      if (!existsSync(dayDir)) {
        mkdirSync(dayDir, { recursive: true })
      }
      const timestamp = Date.now()
      const base = basename(filePath)
      const targetName = `${base}.${timestamp}.bak`
      const targetPath = join(dayDir, targetName)
      copyFileSync(filePath, targetPath)

      if (this.versioningEnabled) {
        this.createFileVersion(filePath, 'auto-backup')
      }

      return targetPath
    } catch {
      return undefined
    }
  }

  /** Back up a file before modification or deletion to 48h recycle buffer (Async non-blocking) */
  public async backupFileAsync(filePath: string): Promise<string | undefined> {
    try {
      await access(filePath)
      const today = new Date().toISOString().slice(0, 10)
      const dayDir = join(this.stagingDir, today)
      await mkdir(dayDir, { recursive: true })

      const timestamp = Date.now()
      const base = basename(filePath)
      const targetName = `${base}.${timestamp}.bak`
      const targetPath = join(dayDir, targetName)
      await copyFile(filePath, targetPath)

      if (this.versioningEnabled) {
        await this.createFileVersionAsync(filePath, 'auto-backup')
      }

      return targetPath
    } catch {
      return undefined
    }
  }

  /** Create an immutable versioned snapshot with parent checksum tracking (Sync) */
  public createFileVersion(filePath: string, author = 'rita'): FileVersionInfo | undefined {
    if (!existsSync(filePath)) return undefined
    try {
      const rawContent = readFileSync(filePath, 'utf-8')
      const content = rawContent.replace(/\r\n/g, '\n')
      const checksum = createHash('sha256').update(content, 'utf-8').digest('hex')
      const normalizedPath = resolve(filePath)

      const manifest = this.loadManifest()
      const history = manifest[normalizedPath] ?? []
      const latest = history[history.length - 1]
      const parentChecksum = latest?.checksum

      // If checksum is identical to latest version, skip redundant duplicate
      if (parentChecksum === checksum && history.length > 0) {
        return latest
      }

      const timestamp = Date.now()
      const versionId = `v${history.length + 1}_${timestamp}`
      const versionsDir = join(this.stagingDir, 'versions', 'snapshots')
      if (!existsSync(versionsDir)) mkdirSync(versionsDir, { recursive: true })

      const base = basename(filePath)
      const targetName = `${base}.${versionId}.snapshot`
      const targetPath = join(versionsDir, targetName)
      writeFileSync(targetPath, content, 'utf-8')

      // Calculate diff summary against parent
      let diffSummary = `Initial version (${content.split('\n').length} lines)`
      if (latest && existsSync(latest.stagedPath)) {
        const oldContent = readFileSync(latest.stagedPath, 'utf-8').replace(/\r\n/g, '\n')
        const oldLines = oldContent.split('\n').length
        const newLines = content.split('\n').length
        diffSummary = `Diff: ${newLines - oldLines >= 0 ? '+' : ''}${newLines - oldLines} lines (parent ${latest.checksum.slice(0, 8)})`
      }

      const versionInfo: FileVersionInfo = {
        versionId,
        filePath: normalizedPath,
        timestamp,
        checksum,
        parentChecksum,
        stagedPath: targetPath,
        diffSummary,
        author,
      }

      history.push(versionInfo)
      if (history.length > this.maxVersionsPerFile) {
        history.shift()
      }
      manifest[normalizedPath] = history
      this.saveManifest(manifest)

      return versionInfo
    } catch {
      return undefined
    }
  }

  /** Create an immutable versioned snapshot with parent checksum tracking (Async non-blocking) */
  public async createFileVersionAsync(filePath: string, author = 'rita'): Promise<FileVersionInfo | undefined> {
    try {
      const rawContent = await readFile(filePath, 'utf-8')
      const content = rawContent.replace(/\r\n/g, '\n')
      const checksum = createHash('sha256').update(content, 'utf-8').digest('hex')
      const normalizedPath = resolve(filePath)

      const manifest = await this.loadManifestAsync()
      const history = manifest[normalizedPath] ?? []
      const latest = history[history.length - 1]
      const parentChecksum = latest?.checksum

      if (parentChecksum === checksum && history.length > 0) {
        return latest
      }

      const timestamp = Date.now()
      const versionId = `v${history.length + 1}_${timestamp}`
      const versionsDir = join(this.stagingDir, 'versions', 'snapshots')
      await mkdir(versionsDir, { recursive: true })

      const base = basename(filePath)
      const targetName = `${base}.${versionId}.snapshot`
      const targetPath = join(versionsDir, targetName)
      await writeFile(targetPath, content, 'utf-8')

      let diffSummary = `Initial version (${content.split('\n').length} lines)`
      if (latest) {
        try {
          const oldContent = (await readFile(latest.stagedPath, 'utf-8')).replace(/\r\n/g, '\n')
          const oldLines = oldContent.split('\n').length
          const newLines = content.split('\n').length
          diffSummary = `Diff: ${newLines - oldLines >= 0 ? '+' : ''}${newLines - oldLines} lines (parent ${latest.checksum.slice(0, 8)})`
        } catch {}
      }

      const versionInfo: FileVersionInfo = {
        versionId,
        filePath: normalizedPath,
        timestamp,
        checksum,
        parentChecksum,
        stagedPath: targetPath,
        diffSummary,
        author,
      }

      history.push(versionInfo)
      if (history.length > this.maxVersionsPerFile) {
        history.shift()
      }
      manifest[normalizedPath] = history
      await this.saveManifestAsync(manifest)

      return versionInfo
    } catch {
      return undefined
    }
  }

  /** List version history for a file */
  public listFileVersions(filePath: string): FileVersionInfo[] {
    const normalizedPath = resolve(filePath)
    const manifest = this.loadManifest()
    return manifest[normalizedPath] ?? []
  }

  /** List version history for a file (Async) */
  public async listFileVersionsAsync(filePath: string): Promise<FileVersionInfo[]> {
    const normalizedPath = resolve(filePath)
    const manifest = await this.loadManifestAsync()
    return manifest[normalizedPath] ?? []
  }

  /** Rollback file to a specific historical version (Sync) */
  public rollbackFileVersion(filePath: string, versionId: string): boolean {
    const versions = this.listFileVersions(filePath)
    const target = versions.find(v => v.versionId === versionId)
    if (!target || !existsSync(target.stagedPath)) return false

    try {
      const content = readFileSync(target.stagedPath, 'utf-8').replace(/\r\n/g, '\n')
      writeFileSync(filePath, content, 'utf-8')
      this.createFileVersion(filePath, `rollback-to-${versionId}`)
      return true
    } catch {
      return false
    }
  }

  /** Rollback file to a specific historical version (Async) */
  public async rollbackFileVersionAsync(filePath: string, versionId: string): Promise<boolean> {
    const versions = await this.listFileVersionsAsync(filePath)
    const target = versions.find(v => v.versionId === versionId)
    if (!target) return false

    try {
      const content = (await readFile(target.stagedPath, 'utf-8')).replace(/\r\n/g, '\n')
      await writeFile(filePath, content, 'utf-8')
      await this.createFileVersionAsync(filePath, `rollback-to-${versionId}`)
      return true
    } catch {
      return false
    }
  }

  /** Back up conversational context messages or summary data (Sync) */
  public backupContextData(contextId: string, data: unknown): string | undefined {
    try {
      const today = new Date().toISOString().slice(0, 10)
      const contextDir = join(this.stagingDir, 'contexts', today)
      if (!existsSync(contextDir)) {
        mkdirSync(contextDir, { recursive: true })
      }
      const timestamp = Date.now()
      const cleanId = contextId.replace(/[^a-zA-Z0-9_-]/g, '_')
      const targetName = `context_${cleanId}_${timestamp}.json`
      const targetPath = join(contextDir, targetName)
      writeFileSync(targetPath, JSON.stringify({ contextId, timestamp, data }, null, 2), 'utf-8')
      return targetPath
    } catch {
      return undefined
    }
  }

  /** Back up conversational context messages or summary data (Async) */
  public async backupContextDataAsync(contextId: string, data: unknown): Promise<string | undefined> {
    try {
      const today = new Date().toISOString().slice(0, 10)
      const contextDir = join(this.stagingDir, 'contexts', today)
      await mkdir(contextDir, { recursive: true })
      const timestamp = Date.now()
      const cleanId = contextId.replace(/[^a-zA-Z0-9_-]/g, '_')
      const targetName = `context_${cleanId}_${timestamp}.json`
      const targetPath = join(contextDir, targetName)
      await writeFile(targetPath, JSON.stringify({ contextId, timestamp, data }, null, 2), 'utf-8')
      return targetPath
    } catch {
      return undefined
    }
  }

  /** Restore contextual data from backup (Sync) */
  public restoreContextData(filePath: string): Record<string, unknown> | undefined {
    try {
      if (existsSync(filePath)) {
        const content = readFileSync(filePath, 'utf-8')
        return JSON.parse(content) as Record<string, unknown>
      }
      return undefined
    } catch {
      return undefined
    }
  }

  /** Restore contextual data from backup (Async) */
  public async restoreContextDataAsync(filePath: string): Promise<Record<string, unknown> | undefined> {
    try {
      const content = await readFile(filePath, 'utf-8')
      return JSON.parse(content) as Record<string, unknown>
    } catch {
      return undefined
    }
  }

  /** Purge backup files older than configured retention (default 48h) */
  public purgeExpired(): number {
    let purged = 0
    if (!existsSync(this.stagingDir)) return purged
    const now = Date.now()

    const scanAndClean = (dir: string): void => {
      try {
        const entries = readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          const fullPath = join(dir, entry.name)
          if (entry.isDirectory()) {
            if (entry.name !== 'versions') {
              scanAndClean(fullPath)
            }
          } else if (entry.isFile()) {
            const stat = statSync(fullPath)
            if (now - stat.mtimeMs > this.retentionMs) {
              unlinkSync(fullPath)
              purged++
            }
          }
        }
      } catch {
        // ignore errors during background cleanup
      }
    }

    scanAndClean(this.stagingDir)
    return purged
  }

  /** Purge backup files older than configured retention asynchronously */
  public async purgeExpiredAsync(): Promise<number> {
    let purged = 0
    try {
      await access(this.stagingDir)
    } catch {
      return purged
    }
    const now = Date.now()

    const scanAndClean = async (dir: string): Promise<void> => {
      try {
        const entries = await readdir(dir, { withFileTypes: true })
        for (const entry of entries) {
          const fullPath = join(dir, entry.name)
          if (entry.isDirectory()) {
            if (entry.name !== 'versions') {
              await scanAndClean(fullPath)
            }
          } else if (entry.isFile()) {
            try {
              const s = await stat(fullPath)
              if (now - s.mtimeMs > this.retentionMs) {
                await unlink(fullPath)
                purged++
              }
            } catch {}
          }
        }
      } catch {}
    }

    await scanAndClean(this.stagingDir)
    return purged
  }
}

export function registerRozEngine(_ctx: Context, config: RozEngineConfig = {}): RozRecycleEngine | undefined {
  if (config.enabled === false) return undefined

  const stagingDir = config.stagingDir ?? '_archive/staging'
  const retentionHours = config.retentionHours ?? 48
  const versioningEnabled = config.versioningEnabled !== false
  const maxVersions = config.maxVersionsPerFile ?? 50
  const engine = new RozRecycleEngine(stagingDir, retentionHours, versioningEnabled, maxVersions)

  // Run initial cleanup
  engine.purgeExpired()

  return engine
}
