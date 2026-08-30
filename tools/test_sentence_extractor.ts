import { cleanMarkdownForSpeech, isSpeakable } from '../packages/guard/sovereign-guard/src/voice-gateway.ts'

function extractNextSentence(buffer: string): { sentence: string; rest: string } | null {
  const trimmed = buffer.trimStart()
  if (!trimmed) return null

  const match = trimmed.match(/^([^\n.!?]+[.!?]+(?:\s+|\n*)|[^\n]+\n\n+)/)
  if (match) {
    const rawSentence = match[0]
    const consumedLength = buffer.indexOf(rawSentence) + rawSentence.length
    return {
      sentence: rawSentence.trim(),
      rest: buffer.slice(consumedLength),
    }
  }
  return null
}

const testText = '\n¡Hola! Todo bien por aquí, listo para ayudarte. ¿Y tú, qué tal? Cuéntame en qué puedo echarte una mano.'
let buf = testText
const extracted: string[] = []

while (true) {
  const result = extractNextSentence(buf)
  if (!result) break
  extracted.push(result.sentence)
  buf = result.rest
}
if (buf.trim()) extracted.push(buf.trim())

console.log('Extracted sentences:', extracted)
for (const s of extracted) {
  const cleaned = cleanMarkdownForSpeech(s)
  console.log(`- "${cleaned}" (speakable: ${isSpeakable(cleaned)})`)
}
