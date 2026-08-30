import { describe, it, expect } from 'vitest'
import { generateStepPill, MidTurnSteeringQueue } from '../src/step-feedback.ts'

describe('StepFeedback & Mid-Turn Steering', () => {
  it('generates high-level semantic status pills for various tool types', () => {
    // 1. File Read / View
    const readPill = generateStepPill('view_file', { AbsolutePath: '/src/server/index.ts' })
    expect(readPill.category).toBe('read')
    expect(readPill.pill).toContain('Inspeccionando index.ts')

    // 2. File Write / Replace
    const writePill = generateStepPill('replace_file_content', { TargetFile: 'config.json' })
    expect(writePill.category).toBe('write')
    expect(writePill.pill).toContain('Aplicando cambios en config.json')

    // 3. Search / Grep
    const searchPill = generateStepPill('grep_search', { Query: 'getUserById' })
    expect(searchPill.category).toBe('search')
    expect(searchPill.pill).toContain("Buscando 'getUserById'")

    // 4. Command Execution (Tests)
    const testCmdPill = generateStepPill('run_command', { CommandLine: 'npx vitest run' })
    expect(testCmdPill.category).toBe('exec')
    expect(testCmdPill.pill).toContain('Ejecutando suite de pruebas')

    // 5. Command Execution (Git)
    const gitCmdPill = generateStepPill('run_command', { CommandLine: 'git status -s' })
    expect(gitCmdPill.category).toBe('exec')
    expect(gitCmdPill.pill).toContain('Gestionando repositorio git (status)')

    // 6. Error handling
    const errorPill = generateStepPill('run_command', {}, new Error('Command failed: 127'))
    expect(errorPill.category).toBe('error')
    expect(errorPill.pill).toContain('Falló la acción')
  })

  it('executes pill generation in microsecond range (<0.1ms average)', () => {
    const start = performance.now()
    const iterations = 1000
    for (let i = 0; i < iterations; i++) {
      generateStepPill('run_command', { CommandLine: 'npx vitest run packages/guard' })
    }
    const elapsed = performance.now() - start
    const avgPerCall = elapsed / iterations
    expect(avgPerCall).toBeLessThan(0.1) // Under 0.1ms per call
  })

  it('manages atomic mid-turn steering queue seamlessly', () => {
    const queue = new MidTurnSteeringQueue()
    const session = 'session-123'

    expect(queue.hasPending(session)).toBe(false)

    // User pushes a directive in mid-execution
    queue.push(session, 'Usa el puerto 8080 en vez de 3000')
    queue.push(session, 'Asegúrate de no borrar el log')

    expect(queue.hasPending(session)).toBe(true)

    // Injected into prompt for next step
    const injection = queue.formatContextInjection(session)
    expect(injection).toContain('Intervención del Usuario en Caliente')
    expect(injection).toContain('Usa el puerto 8080')
    expect(injection).toContain('no borrar el log')

    // Queue is consumed and empty
    expect(queue.hasPending(session)).toBe(false)
  })
})
