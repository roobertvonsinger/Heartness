/**
 * Script de Verificación y Prueba Empírica del Voice Gateway de DeepSick Hardness (DSH).
 * Ejecuta pruebas de extracción, normalización, modulación por modelo y síntesis real a disco.
 */

import { writeFileSync, statSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  extractDualTrackPayload,
  cleanMarkdownForSpeech,
  parseVoiceTagAttributes,
  normalizeCartesiaEmotion,
  buildCartesiaWebSocketPayload,
  buildElevenLabsPayload,
} from '../packages/guard/sovereign-guard/src/voice-gateway.ts'

async function runVoiceVerification() {
  console.log('======================================================================')
  console.log(' 👑 PRUEBA EMPÍRICA — DUAL-TRACK VOICE GATEWAY & EXPRESSIVENESS (DSH) ')
  console.log('======================================================================\n')

  // 1. Simulación de respuesta de LLM con etiqueta enriquecida de expresividad
  const testMessage = `
# Auditoría de Sistema DSH
Se ejecutó la validación con **100% de éxito** y **0 errores**.
\`\`\`bash
npm run test -> 100/100 passed
\`\`\`
<voice emotion="positivity:high" speed="1.05" style="0.75" provider="elevenlabs">
¡Todo quedó en verde, Robert! Pasaron los cien tests de DeepSick Hardness sin bronca y la modulación de voz está lista.
</voice>
`

  console.log('🔍 [1] Extrayendo canal Dual-Track del mensaje...')
  const result = extractDualTrackPayload(testMessage, {
    provider: 'auto_failover',
    elevenlabs: {
      modelId: 'eleven_turbo_v2_5',
      voiceId: process.env.ELEVENLABS_VOICE_ID || '4xkUqaR9MYOJHoaC1Nak',
      stability: 0.4,
      similarityBoost: 0.8,
    },
  })

  console.log('   -> Has explicit voice tag:', result.hasExplicitVoiceTag)
  console.log('   -> Provider seleccionado:', result.provider)
  console.log('   -> Modificadores parseados:', JSON.stringify(result.modifiers, null, 2))
  console.log('   -> Texto oral limpio (es-MX):', `"${result.speechText}"`)
  console.log('   -> Payload Cartesia WS:', JSON.stringify(result.cartesiaPayload, null, 2))
  console.log('   -> Payload ElevenLabs REST:', JSON.stringify(result.elevenlabsPayload, null, 2))

  // 2. Prueba de Síntesis Real (si existe API key de ElevenLabs)
  const apiKey = process.env.ELEVENLABS_API_KEY
  const voiceId = process.env.ELEVENLABS_VOICE_ID || '4xkUqaR9MYOJHoaC1Nak'

  if (apiKey && apiKey.startsWith('sk_')) {
    console.log('\n🎙️ [2] Enviando petición de síntesis real a ElevenLabs...')
    const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`
    const payload = result.elevenlabsPayload || buildElevenLabsPayload(result.speechText)

    try {
      const startTime = Date.now()
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text: payload.text,
          model_id: payload.model_id,
          voice_settings: payload.voice_settings,
        }),
      })

      const elapsed = Date.now() - startTime
      console.log(`   -> Respuesta HTTP: ${response.status} ${response.statusText} (${elapsed}ms)`)

      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const outputPath = resolve(process.cwd(), 'preview_voice.mp3')
        writeFileSync(outputPath, buffer)

        const fileStats = statSync(outputPath)
        console.log(`   ✅ Audio sintetizado guardado con éxito: ${outputPath}`)
        console.log(`   -> Tamaño de archivo: ${(fileStats.size / 1024).toFixed(2)} KB`)
        console.log(`   -> Latencia de generación: ${elapsed}ms`)
      } else {
        const errorText = await response.text()
        console.log(`   ⚠️ Error de API ElevenLabs: ${errorText}`)
      }
    } catch (err: any) {
      console.log(`   ❌ Error de conexión: ${err.message}`)
    }
  } else {
    console.log('\n⚠️ No se encontró ELEVENLABS_API_KEY en variables de entorno para prueba real de audio.')
  }

  console.log('\n======================================================================')
  console.log(' ✨ VALIDACIÓN EMPÍRICA CONCLUIDA')
  console.log('======================================================================')
}

runVoiceVerification().catch(console.error)
