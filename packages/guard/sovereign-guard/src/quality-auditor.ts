import type { Context } from '@deepseek-ai/cordis'
import type { QualityAuditResult, QualityAuditorConfig, QualityMetrics } from './types.ts'

export function calculateQualityScore(
  response: string,
  userPrompt = '',
  minPassingScore = 85,
): QualityAuditResult {
  const flags: string[] = []
  const recommendations: string[] = []

  if (!response || typeof response !== 'string') {
    return {
      metrics: { relevance: 0, accuracy: 0, completeness: 0, conciseness: 0, safety: 100, overallScore: 0 },
      passed: false,
      flags: ['EMPTY_RESPONSE'],
      recommendations: ['Provide non-empty response content'],
    }
  }

  // 1. Relevance (0-100)
  let relevance = 90
  if (userPrompt) {
    const promptKeywords = userPrompt.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    if (promptKeywords.length > 0) {
      const matched = promptKeywords.filter(k => response.toLowerCase().includes(k))
      const matchRatio = matched.length / promptKeywords.length
      relevance = Math.round(Math.min(100, Math.max(60, matchRatio * 100)))
    }
  }

  // 2. Accuracy & Syntactic Cleanliness (0-100)
  let accuracy = 95
  const codeFences = (response.match(/```/g) ?? []).length
  if (codeFences % 2 !== 0) {
    accuracy -= 20
    flags.push('UNCLOSED_CODE_BLOCK')
    recommendations.push('Ensure all markdown code blocks (```) are closed properly')
  }

  // 3. Completeness & Placeholder Detection (0-100)
  let completeness = 100
  const placeholderMatches = response.match(/\/\/\s*TODO|\/\*\s*TODO|#\s*TODO|\/\/\s*FIXME|\/\/\s*implement later|\.\.\.\s*rest of code/gi) ?? []
  if (placeholderMatches.length > 0) {
    completeness -= Math.min(40, placeholderMatches.length * 15)
    flags.push('PLACEHOLDER_DETECTED')
    recommendations.push('Eliminate // TODO or placeholder comments; provide complete production implementations')
  }

  // 4. Conciseness & Token Efficiency (0-100)
  let conciseness = 95
  const fillerMatches = response.match(/\b(as an ai language model|i hope this helps|feel free to ask|certainly!|sure, here is|let me know if you need anything else)\b/gi) ?? []
  if (fillerMatches.length > 0) {
    conciseness -= Math.min(30, fillerMatches.length * 10)
    flags.push('CONVERSATIONAL_FILLER')
    recommendations.push('Maintain dense, direct engineering style (MX); remove generic boilerplate greetings/farewells')
  }

  // 5. Safety (0-100)
  let safety = 100
  if (/ghp_[a-zA-Z0-9]{20,}|sk-[a-zA-Z0-9]{20,}|AIzaSy[a-zA-Z0-9_-]{30,}/.test(response)) {
    safety -= 50
    flags.push('POTENTIAL_SECRET_EXPOSURE')
    recommendations.push('Redact sensitive API keys or credentials before emission')
  }
  if (/\b(rm -rf \/|format c:|DROP DATABASE)\b/i.test(response)) {
    safety -= 40
    flags.push('DANGEROUS_COMMAND')
    recommendations.push('Avoid emitting unchecked catastrophic terminal commands')
  }

  // Weighted overall composite score
  const overallScore = Math.round(
    (relevance * 0.25) +
    (accuracy * 0.25) +
    (completeness * 0.25) +
    (conciseness * 0.15) +
    (safety * 0.10),
  )

  const metrics: QualityMetrics = {
    relevance,
    accuracy,
    completeness,
    conciseness,
    safety,
    overallScore,
  }

  return {
    metrics,
    passed: overallScore >= minPassingScore,
    flags,
    recommendations,
  }
}

export function registerQualityAuditor(ctx: Context, config: QualityAuditorConfig = {}): void {
  if (config.enabled === false) return

  const minPassingScore = config.minPassingScore ?? 85

  // Inspect responses on agent execution completion
  ctx.on('agent/pre-step', async (payload: any, next: any) => {
    const downstream = typeof next === 'function' ? await next() : { kind: 'enter' }
    const messages = payload?.messages ?? []

    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1]
      let text = ''
      for (const block of lastMsg?.content ?? []) {
        if (block.type === 'text') text += block.text
      }

      if (text && text.length > 50) {
        const audit = calculateQualityScore(text, '', minPassingScore)
        if (!audit.passed) {
          ctx.logger?.warn?.(`[quality-auditor] Response quality score below threshold: ${audit.metrics.overallScore}/${minPassingScore} (flags: ${audit.flags.join(', ')})`)
        }
      }
    }

    return downstream
  })
}
