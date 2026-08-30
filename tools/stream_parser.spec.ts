import { describe, it, expect } from 'vitest'
import { DualTrackStreamParser, cleanMarkdownForSpeech } from './stream_parser.ts'

describe('DualTrackStreamParser & Speech Cleaner', () => {
  it('cleans markdown symbols, bold, code, and tables correctly', () => {
    const raw = `
# Auditoría de Sistema
El resultado es **100% de éxito** con **0 errores**.
| Col1 | Col2 |
|---|---|
| A | B |
\`\`\`bash
npm run test
\`\`\`
1. Primer paso importante.
2. Segundo paso relevante.
`
    const cleaned = cleanMarkdownForSpeech(raw)
    expect(cleaned).not.toContain('**')
    expect(cleaned).not.toContain('|')
    expect(cleaned).not.toContain('npm run test')
    expect(cleaned).toContain('cien por ciento de éxito')
    expect(cleaned).toContain('cero errores')
    expect(cleaned).toContain('Primer paso importante')
  })

  it('correctly parses dual-track stream across arbitrary token boundaries without leaking tags', () => {
    let terminalOutput = ''
    const voiceSentences: { text: string; modifiers: any }[] = []
    const mdSentences: string[] = []

    const parser = new DualTrackStreamParser({
      onTerminalToken: (t) => { terminalOutput += t },
      onVoiceSentence: (s, m) => { voiceSentences.push({ text: s, modifiers: m }) },
      onMarkdownSentence: (s) => { mdSentences.push(s) },
    })

    // Simulate tokens arriving with split tags
    const tokens = [
      '# Hola Robert\n\n',
      'Aquí está el reporte de ',
      '**DSH**.\n\n',
      '<',
      'voi',
      'ce emotion="positivity:high" speed="1.05">',
      '¡Qué onda Robert! ',
      'Todo quedó al cien por ciento listo. ',
      'Ya no hay broncas con la latencia.',
      '</v',
      'oice>',
      '\n\nSiguiente paso: desplegar.',
    ]

    for (const token of tokens) {
      parser.feedToken(token)
    }
    parser.flush()

    expect(parser.getHasExplicitVoiceTag()).toBe(true)
    // Terminal output should NOT contain <voice...> or </voice> or speech text inside <voice>
    expect(terminalOutput).not.toContain('<voice')
    expect(terminalOutput).not.toContain('</voice>')
    expect(terminalOutput).not.toContain('¡Qué onda Robert!')
    expect(terminalOutput).toContain('# Hola Robert')
    expect(terminalOutput).toContain('Siguiente paso: desplegar.')

    // Voice sentences should be captured
    expect(voiceSentences.length).toBeGreaterThanOrEqual(2)
    expect(voiceSentences[0].text).toContain('Qué onda Robert')
    expect(voiceSentences[0].modifiers.emotion).toBe('positivity:high')
    expect(voiceSentences[0].modifiers.speed).toBe(1.05)
  })

  it('handles purely markdown responses (without voice tags) seamlessly', () => {
    let terminalOutput = ''
    const voiceSentences: { text: string; modifiers: any }[] = []
    const mdSentences: string[] = []

    const parser = new DualTrackStreamParser({
      onTerminalToken: (t) => { terminalOutput += t },
      onVoiceSentence: (s, m) => { voiceSentences.push({ text: s, modifiers: m }) },
      onMarkdownSentence: (s) => { mdSentences.push(s) },
    })

    const tokens = [
      'DeepSeek V3 es un modelo generalista excelente. ',
      'Por otro lado, DeepSeek R1 es para razonamiento matemático profundo.',
    ]

    for (const token of tokens) {
      parser.feedToken(token)
    }
    parser.flush()

    expect(parser.getHasExplicitVoiceTag()).toBe(false)
    expect(terminalOutput).toContain('DeepSeek V3')
    expect(mdSentences.length).toBe(2)
    expect(mdSentences[0]).toContain('DeepSeek V3 es un modelo generalista excelente')
    expect(mdSentences[1]).toContain('DeepSeek R1 es para razonamiento matemático profundo')
  })
})
