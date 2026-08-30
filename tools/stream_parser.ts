import { describe, it, expect } from 'vitest'

export function isSpeakable(text: string): boolean {
  if (!text) return false
  const clean = text.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ]/g, '')
  return clean.length >= 2
}

export function cleanMarkdownForSpeech(rawText: string, maxChars = 0): string {
  if (!rawText) return ''
  let text = rawText

  // 1. Eliminar bloques de código enteros ```...```
  text = text.replace(/```[\s\S]*?```/g, ' ')

  // 2. Eliminar inline code `...`
  text = text.replace(/`([^`]+)`/g, '$1')

  // 3. Convertir enlaces markdown [Texto](url) a solo "Texto"
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

  // 4. Eliminar negritas, cursivas y tachados (**bold**, *italic*, __bold__, _italic_, ~~strike~~)
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1')
  text = text.replace(/\*([^*]+)\*/g, '$1')
  text = text.replace(/__([^_]+)__/g, '$1')
  text = text.replace(/_([^_]+)_/g, '$1')
  text = text.replace(/~~([^~]+)~~/g, '$1')

  // 5. Eliminar encabezados markdown (#, ##, ###)
  text = text.replace(/^#{1,6}\s+/gm, '')

  // 6. Eliminar viñetas y guiones de listas
  text = text.replace(/^[\s*•-]+\s+/gm, '')

  // 7. Limpiar listas numeradas (1. -> 1, )
  text = text.replace(/^\s*\d+\.\s+/gm, '')

  // 8. Eliminar tablas markdown (| col | col |) y líneas divisorias
  text = text.replace(/\|[^\n]+\|/g, ' ')
  text = text.replace(/^[-=_*]{3,}$/gm, ' ')

  // 9. Eliminar URLs crudas (http://...)
  text = text.replace(/https?:\/\/[^\s]+/g, '')

  // 10. Eliminar emojis y caracteres decorativos
  text = text.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')

  // 11. Expansión fonética en español para términos técnicos comunes
  text = text
    .replace(/100%/g, 'cien por ciento')
    .replace(/(\d+)%/g, '$1 por ciento')
    .replace(/\b0 errores\b/gi, 'cero errores')
    .replace(/\b(\d+)\/(\d+)\b/g, '$1 de $2')
    .replace(/\bDSH\b/g, 'D-S-H')
    .replace(/\bLLMs\b/gi, 'L-L-Ms')
    .replace(/\bLLM\b/gi, 'L-L-M')
    .replace(/\bTTS\b/gi, 'T-T-S')
    .replace(/\bSTT\b/gi, 'S-T-T')
    .replace(/\bAPIs\b/g, 'a-p-is')
    .replace(/\bAPI\b/g, 'a-p-i')
    .replace(/\bSQL\b/gi, 'ese-cu-ele')
    .replace(/\bTDD\b/gi, 't-d-d')
    .replace(/\bAST\b/gi, 'árbol sintáctico')
    .replace(/\bPRs\b/gi, 'pull requests')
    .replace(/\bPR\b/gi, 'pull request')
    .replace(/\bSSH\b/gi, 's-s-h')
    .replace(/\bVPS\b/gi, 'v-p-s')
    .replace(/\bHTTP\b/gi, 'h-t-t-p')
    .replace(/\bJSON\b/gi, 'jeison')
    .replace(/\bKVM4\b/gi, 'K-V-M cuatro')
    .replace(/\bv(\d+)\.(\d+)\b/gi, 'versión $1 punto $2')
    .replace(/\bv(\d+)\b/gi, 'versión $1')

  // 12. Colapsar espacios múltiples y saltos de línea
  text = text.replace(/\s+/g, ' ').trim()

  if (maxChars > 0 && text.length > maxChars) {
    const truncated = text.slice(0, maxChars)
    const lastPeriod = truncated.lastIndexOf('.')
    if (lastPeriod > 50) {
      text = truncated.slice(0, lastPeriod + 1)
    } else {
      text = `${truncated.trim()}...`
    }
  }

  return isSpeakable(text) ? text : ''
}

export class DualTrackStreamParser {
  private insideVoice = false
  private tagBuffer = ''
  private closeTagBuffer = ''
  private voiceSentenceBuffer = ''
  private markdownSentenceBuffer = ''
  private hasExplicitVoiceTag = false
  private voiceModifiers: any = {}
  private onTerminalToken: (token: string) => void
  private onVoiceSentence: (sentence: string, modifiers: any) => void
  private onMarkdownSentence: (sentence: string) => void

  constructor(options: {
    onTerminalToken: (token: string) => void
    onVoiceSentence: (sentence: string, modifiers: any) => void
    onMarkdownSentence: (sentence: string) => void
  }) {
    this.onTerminalToken = options.onTerminalToken
    this.onVoiceSentence = options.onVoiceSentence
    this.onMarkdownSentence = options.onMarkdownSentence
  }

  public feedToken(token: string) {
    for (let i = 0; i < token.length; i++) {
      const char = token[i]
      this.feedChar(char)
    }
  }

  private feedChar(char: string) {
    if (!this.insideVoice) {
      if (char === '<' || this.tagBuffer.length > 0) {
        this.tagBuffer += char

        // Check if tagBuffer is a valid prefix of <voice ...>
        if (this.tagBuffer.startsWith('<voice')) {
          if (char === '>') {
            // Full <voice ...> opening tag matched!
            this.insideVoice = true
            this.hasExplicitVoiceTag = true
            const attrMatch = this.tagBuffer.match(/<voice(?:\s+([^>]*))?>/i)
            this.voiceModifiers = attrMatch?.[1] ? this.parseAttributes(attrMatch[1]) : {}
            this.tagBuffer = ''
          }
        } else if ('<voice'.startsWith(this.tagBuffer)) {
          // Keep buffering: '<', '<v', '<vo', '<voi', '<voic'
        } else {
          // Not a voice tag! Flush tagBuffer to terminal & markdown buffer
          this.onTerminalToken(this.tagBuffer)
          this.markdownSentenceBuffer += this.tagBuffer
          this.tagBuffer = ''
          this.checkMarkdownSentences()
        }
      } else {
        this.onTerminalToken(char)
        this.markdownSentenceBuffer += char
        this.checkMarkdownSentences()
      }
    } else {
      // Inside <voice>
      if (char === '<' || this.closeTagBuffer.length > 0) {
        this.closeTagBuffer += char

        if (this.closeTagBuffer.toLowerCase() === '</voice>') {
          // Full </voice> closing tag matched!
          this.insideVoice = false
          this.closeTagBuffer = ''
          if (this.voiceSentenceBuffer.trim()) {
            const cleaned = cleanMarkdownForSpeech(this.voiceSentenceBuffer)
            if (cleaned) {
              this.onVoiceSentence(cleaned, this.voiceModifiers)
            }
            this.voiceSentenceBuffer = ''
          }
        } else if ('</voice>'.startsWith(this.closeTagBuffer.toLowerCase())) {
          // Keep buffering: '<', '</', '</v', '</vo', '</voi', '</voic'
        } else {
          // Not </voice>. Flush closeTagBuffer to voiceSentenceBuffer
          this.voiceSentenceBuffer += this.closeTagBuffer
          this.closeTagBuffer = ''
          this.checkVoiceSentences()
        }
      } else {
        this.voiceSentenceBuffer += char
        this.checkVoiceSentences()
      }
    }
  }

  private checkVoiceSentences() {
    const match = this.voiceSentenceBuffer.match(/([^\n.!?]+[.!?]+(?:\s+|\n+)|[^\n]+\n\n+)/)
    if (match && match.index === 0) {
      const sentence = match[0]
      const cleaned = cleanMarkdownForSpeech(sentence)
      if (cleaned) {
        this.onVoiceSentence(cleaned, this.voiceModifiers)
      }
      this.voiceSentenceBuffer = this.voiceSentenceBuffer.slice(match[0].length)
    }
  }

  private checkMarkdownSentences() {
    if (this.hasExplicitVoiceTag) return
    const match = this.markdownSentenceBuffer.match(/([^\n.!?]+[.!?]+(?:\s+|\n+)|[^\n]+\n\n+)/)
    if (match && match.index === 0) {
      const sentence = match[0]
      const cleaned = cleanMarkdownForSpeech(sentence)
      if (cleaned) {
        this.onMarkdownSentence(cleaned)
      }
      this.markdownSentenceBuffer = this.markdownSentenceBuffer.slice(match[0].length)
    }
  }

  public flush() {
    if (this.tagBuffer) {
      this.onTerminalToken(this.tagBuffer)
      this.markdownSentenceBuffer += this.tagBuffer
      this.tagBuffer = ''
    }
    if (this.closeTagBuffer) {
      this.voiceSentenceBuffer += this.closeTagBuffer
      this.closeTagBuffer = ''
    }

    if (this.voiceSentenceBuffer.trim()) {
      const cleaned = cleanMarkdownForSpeech(this.voiceSentenceBuffer)
      if (cleaned) {
        this.onVoiceSentence(cleaned, this.voiceModifiers)
      }
      this.voiceSentenceBuffer = ''
    }

    if (!this.hasExplicitVoiceTag && this.markdownSentenceBuffer.trim()) {
      const cleaned = cleanMarkdownForSpeech(this.markdownSentenceBuffer)
      if (cleaned) {
        this.onMarkdownSentence(cleaned)
      }
      this.markdownSentenceBuffer = ''
    }
  }

  public getHasExplicitVoiceTag(): boolean {
    return this.hasExplicitVoiceTag
  }

  private parseAttributes(attrString: string): any {
    const modifiers: any = {}
    const attrRegex = /([a-zA-Z_0-9-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g
    let match: RegExpExecArray | null
    while ((match = attrRegex.exec(attrString)) !== null) {
      const key = match[1]?.toLowerCase().replace(/-/g, '_')
      const value = match[2] ?? match[3] ?? match[4] ?? ''
      if (key === 'emotion' || key === 'mood') modifiers.emotion = value
      if (key === 'speed' || key === 'rate') modifiers.speed = Number.parseFloat(value) || 1.0
      if (key === 'provider') modifiers.provider = value
    }
    return modifiers
  }
}
