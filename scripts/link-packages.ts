import * as fs from 'node:fs'
import * as path from 'node:path'

const root = process.cwd()
const targetDir = path.join(root, 'node_modules/@deepseek-ai')
fs.mkdirSync(targetDir, { recursive: true })

function scanDirs(dir: string) {
  for (const group of fs.readdirSync(dir)) {
    const groupPath = path.join(dir, group)
    if (!fs.statSync(groupPath).isDirectory()) continue
    for (const pkg of fs.readdirSync(groupPath)) {
      const pkgPath = path.join(groupPath, pkg)
      const manifestPath = path.join(pkgPath, 'package.json')
      if (fs.existsSync(manifestPath)) {
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
          if (manifest.name && manifest.name.startsWith('@deepseek-ai/')) {
            const shortName = manifest.name.replace('@deepseek-ai/', '')
            const dest = path.join(targetDir, shortName)
            if (!fs.existsSync(dest)) {
              fs.symlinkSync(pkgPath, dest, 'junction')
              console.log(`Linked ${shortName} -> ${pkgPath}`)
            }
          }
        } catch (e) {
          // ignore
        }
      }
    }
  }
}

// Vendor
for (const vendorPkg of fs.readdirSync(path.join(root, 'vendor'))) {
  const vPath = path.join(root, 'vendor', vendorPkg)
  const mPath = path.join(vPath, 'package.json')
  if (fs.existsSync(mPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(mPath, 'utf8'))
      if (manifest.name && manifest.name.startsWith('@deepseek-ai/')) {
        const shortName = manifest.name.replace('@deepseek-ai/', '')
        const dest = path.join(targetDir, shortName)
        if (!fs.existsSync(dest)) {
          fs.symlinkSync(vPath, dest, 'junction')
          console.log(`Linked vendor ${shortName} -> ${vPath}`)
        }
      }
    } catch {}
  }
}

scanDirs(path.join(root, 'packages'))
console.log('Linking complete.')
