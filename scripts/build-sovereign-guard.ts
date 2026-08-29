import * as fs from 'node:fs'
import * as path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const srcDir = path.join(root, 'packages/guard/sovereign-guard/src')
const outDir = path.join(root, 'packages/guard/sovereign-guard/lib')

fs.mkdirSync(outDir, { recursive: true })

for (const file of fs.readdirSync(srcDir)) {
  if (file.endsWith('.ts')) {
    const code = fs.readFileSync(path.join(srcDir, file), 'utf8')
    const res = ts.transpileModule(code, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    })
    const outFile = path.join(outDir, file.replace(/\.ts$/, '.js'))
    // Map .ts import specifiers to .js
    const output = res.outputText.replace(/from\s+['"](\.\/[^'"]+)\.ts['"]/g, "from '$1.js'")
    fs.writeFileSync(outFile, output, 'utf8')
    console.log(`Transpiled ${file} -> ${path.relative(root, outFile)}`)
  }
}
console.log('Build complete.')
