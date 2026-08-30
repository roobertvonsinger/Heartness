import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const STORAGE_PATH = path.resolve(process.env.USERPROFILE || 'C:\\Users\\rober', '.dsh', 'storages', 'workspace.json')

interface WorkspaceRecord {
  path: string
  title: string
  sessionIds: string[]
  createdAt: string
  updatedAt: string
}

interface WorkspaceStorage {
  unit: { name: string; version: number }
  global: {
    initialized: boolean
    workspaceIds: string[]
    archivedSessionIds: string[]
  }
  tables: {
    workspaces: Record<string, WorkspaceRecord>
  }
}

function loadStorage(): WorkspaceStorage {
  if (!fs.existsSync(STORAGE_PATH)) {
    return {
      unit: { name: 'workspace', version: 2 },
      global: { initialized: true, workspaceIds: [], archivedSessionIds: [] },
      tables: { workspaces: {} },
    }
  }
  const raw = fs.readFileSync(STORAGE_PATH, 'utf8')
  return JSON.parse(raw) as WorkspaceStorage
}

function saveStorage(storage: WorkspaceStorage): void {
  const dir = path.dirname(STORAGE_PATH)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(STORAGE_PATH, JSON.stringify(storage, null, 2), 'utf8')
}

export function listWorkspaces(): void {
  const storage = loadStorage()
  console.log('\n================ WORKSPACES REGISTRADOS EN DSH ================')
  if (storage.global.workspaceIds.length === 0) {
    console.log('No hay workspaces registrados.')
  } else {
    storage.global.workspaceIds.forEach((id, idx) => {
      const ws = storage.tables.workspaces[id]
      if (ws) {
        console.log(`[${idx + 1}] ID: ${id}`)
        console.log(`    Título: ${ws.title}`)
        console.log(`    Ruta:   ${ws.path}`)
        console.log(`    Sesiones: ${ws.sessionIds?.length || 0}`)
      }
    })
  }
  console.log('================================================================\n')
}

export function addWorkspace(targetPath: string, customTitle?: string): string {
  const normalizedPath = path.resolve(targetPath)
  if (!fs.existsSync(normalizedPath)) {
    throw new Error(`La ruta '${normalizedPath}' no existe en el sistema de archivos.`)
  }

  const storage = loadStorage()
  const title = customTitle || path.basename(normalizedPath)

  // Check if already exists
  for (const [id, ws] of Object.entries(storage.tables.workspaces)) {
    if (path.resolve(ws.path).toLowerCase() === normalizedPath.toLowerCase()) {
      console.log(`⚡ El workspace ya existe (ID: ${id}) -> ${ws.title} (${ws.path})`)
      return id
    }
  }

  const newId = crypto.randomUUID()
  const now = new Date().toISOString()

  const record: WorkspaceRecord = {
    path: normalizedPath,
    title,
    sessionIds: [],
    createdAt: now,
    updatedAt: now,
  }

  storage.tables.workspaces[newId] = record
  storage.global.workspaceIds.push(newId)
  storage.global.initialized = true

  saveStorage(storage)
  console.log(`✅ Workspace agregado exitosamente:`)
  console.log(`   ID:     ${newId}`)
  console.log(`   Título: ${title}`)
  console.log(`   Ruta:   ${normalizedPath}`)

  return newId
}

export function removeWorkspace(idOrPath: string): boolean {
  const storage = loadStorage()
  let targetId: string | null = null

  if (storage.tables.workspaces[idOrPath]) {
    targetId = idOrPath
  } else {
    for (const [id, ws] of Object.entries(storage.tables.workspaces)) {
      if (path.resolve(ws.path).toLowerCase() === path.resolve(idOrPath).toLowerCase()) {
        targetId = id
        break
      }
    }
  }

  if (!targetId) {
    console.error(`[!] No se encontró ningún workspace con ID o Ruta '${idOrPath}'.`)
    return false
  }

  const ws = storage.tables.workspaces[targetId]
  delete storage.tables.workspaces[targetId]
  storage.global.workspaceIds = storage.global.workspaceIds.filter(id => id !== targetId)

  saveStorage(storage)
  console.log(`🗑️ Workspace eliminado de DSH: ${ws?.title || targetId} (${ws?.path || ''})`)
  return true
}

// CLI handler
const action = process.argv[2] || 'list'
const arg1 = process.argv[3]
const arg2 = process.argv[4]

if (action === 'list') {
  listWorkspaces()
} else if (action === 'add' && arg1) {
  addWorkspace(arg1, arg2)
} else if (action === 'remove' && arg1) {
  removeWorkspace(arg1)
} else {
  console.log(`Uso:
  npx tsx tools/manage_workspaces.ts list
  npx tsx tools/manage_workspaces.ts add "<ruta_del_directorio>" "[titulo_opcional]"
  npx tsx tools/manage_workspaces.ts remove "<id_o_ruta>"
`)
}
