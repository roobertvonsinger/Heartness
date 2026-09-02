import z from '@deepseek-ai/schemastery'

export interface ModelRule {
  pattern: string
  maxTurns?: number
  maxInputChars?: number
}

export interface AdaptiveContextConfig {
  enabled?: boolean
  warningThresholds?: number[]
  autoSaveToRoz?: boolean
  complexityWeighting?: boolean
  stagingDir?: string
}

export interface ContextIsolatorConfig {
  enabled?: boolean
  rules?: ModelRule[]
  adaptive?: AdaptiveContextConfig
}

export const ModelRuleSchema: z<ModelRule> = z.object({
  pattern: z.string().description('Glob / regex pattern matching model name (e.g. *venice*, *mistral*, *gemini*)'),
  maxTurns: z.number().description('Maximum conversational turn history preserved for this model class'),
  maxInputChars: z.number().description('Maximum character budget allowed before aggressive compaction'),
})

export const AdaptiveContextConfigSchema: z<AdaptiveContextConfig> = z.object({
  enabled: z.boolean().default(true).description('Enable dynamic multiplier adjustments based on context pressure'),
  warningThresholds: z.array(z.number()).default([0.5, 0.75, 0.9]).description('Capacity ratios triggering proactive warning notices'),
  autoSaveToRoz: z.boolean().default(true).description('Automatically archive omitted conversational turns to disk staging'),
  complexityWeighting: z.boolean().default(true).description('Calculate syntactic complexity bonus for technical prompts'),
  stagingDir: z.string().default('_archive/staging/contexts').description('Disk path for archived conversational snapshots'),
})

export const ContextIsolatorConfigSchema: z<ContextIsolatorConfig> = z.object({
  enabled: z.boolean().default(true).description('Enable adaptive context isolation and turn pruning'),
  rules: z.array(ModelRuleSchema).default([
    { pattern: '*venice*', maxTurns: 4, maxInputChars: 4000 },
    { pattern: '*mistral*', maxTurns: 12, maxInputChars: 16000 },
    { pattern: '*codestral*', maxTurns: 16, maxInputChars: 64000 },
    { pattern: '*gemini*', maxTurns: 60, maxInputChars: 1000000 },
  ]).description('Model-specific token and turn budget rules'),
  adaptive: AdaptiveContextConfigSchema.default({}),
})
