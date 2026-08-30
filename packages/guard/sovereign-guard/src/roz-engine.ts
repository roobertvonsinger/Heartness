import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { RozEngineConfig } from './types.ts'

export class RozRecycleEngine {
  private stagingDir: string
  private retentionMs: number

  constructor(stagingDir = '_archive/staging', retentionHours = 48) {
    this.stagingDir = stagingDir
    this.retentionMs = retentionHours * 60 * 60 * 1000
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

  /** Back up a file before modification or deletion to 48h recycle buffer */
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
      return targetPath
    } catch {
      return undefined
    }
  }

  /** Back up conversational context messages or summary data */
  public backupContextData(contextId: string, data: any): string | undefined {
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

  /** Restore contextual data from backup */
  public restoreContextData(filePath: string): any | undefined {
    try {
      if (existsSync(filePath)) {
        const content = readFileSync(filePath, 'utf-8')
        return JSON.parse(content)
      }
      return undefined
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
            scanAndClean(fullPath)
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
}

export function registerRozEngine(_ctx: Context, config: RozEngineConfig): RozRecycleEngine | undefined {
  if (config.enabled === false) return undefined

  const stagingDir = config.stagingDir ?? '_archive/staging'
  const retentionHours = config.retentionHours ?? 48
  const engine = new RozRecycleEngine(stagingDir, retentionHours)

  // Run initial cleanup
  engine.purgeExpired()

  return engine
}
