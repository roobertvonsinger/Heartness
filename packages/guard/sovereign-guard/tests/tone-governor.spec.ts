import { describe, it, expect } from 'vitest'
import { sanitizeToneOutput, getSovereignSystemDirectives } from '../src/tone-governor.ts'

describe('ToneGovernor & Anti-Sycophancy', () => {
  it('strips sycophantic openers, fluff, and empty apologies in-flight', () => {
    const raw1 = '¡Claro que sí! He modificado el archivo según tus instrucciones.'
    const res1 = sanitizeToneOutput(raw1)
    expect(res1.stripped).toBe(true)
    expect(res1.cleanedText).toBe('He modificado el archivo según tus instrucciones.')

    const raw2 = 'Disculpa la confusión, aquí está la solución correcta para el puerto 3080.'
    const res2 = sanitizeToneOutput(raw2)
    expect(res2.stripped).toBe(true)
    expect(res2.cleanedText).toBe('Aquí está la solución correcta para el puerto 3080.')

    const raw3 = 'Como modelo de lenguaje, he verificado los puertos. Espero que esto te sea de ayuda.'
    const res3 = sanitizeToneOutput(raw3)
    expect(res3.stripped).toBe(true)
    expect(res3.cleanedText).toBe('He verificado los puertos.')

    const raw4 = '¡Con mucho gusto! El servidor está activo en http://127.0.0.1:3080. Quedo a tu entera disposición.'
    const res4 = sanitizeToneOutput(raw4)
    expect(res4.stripped).toBe(true)
    expect(res4.cleanedText).toBe('El servidor está activo en http://127.0.0.1:3080.')
  })

  it('preserves clean technical text without modification', () => {
    const technicalText = 'El puerto 3080 responde con HTTP 200 OK tras la compilación del frontend.'
    const res = sanitizeToneOutput(technicalText)
    expect(res.stripped).toBe(false)
    expect(res.cleanedText).toBe(technicalText)
  })

  it('runs sanitization in microsecond range (<0.5ms)', () => {
    const sample = '¡Claro que sí! Procesando los 50 endpoints del sistema.'
    const start = performance.now()
    const iterations = 1000
    for (let i = 0; i < iterations; i++) {
      sanitizeToneOutput(sample)
    }
    const elapsed = performance.now() - start
    const avgPerCall = elapsed / iterations
    expect(avgPerCall).toBeLessThan(0.5)
  })

  it('generates immutable sovereign system directives', () => {
    const directives = getSovereignSystemDirectives()
    expect(directives).toContain('DIRECTIVA DE GOBERNANZA DE TONO')
    expect(directives).toContain('Cero Servilismo')
    expect(directives).toContain('Verificación Empírica')
    expect(directives).toContain('Español conversacional técnico directo (MX)')
  })
})
