import type { ReactNode } from 'react'
import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import type { MarkdownLabels } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { NS } from './locales.ts'

/** The settled result node the `result` phase carries. */
type ToolResultBlock = Extract<ToolCallViewProps, { phase: 'result' }>['block']

/** Persisted `output.presentationMeta` this card reads; replay data arrives unvalidated. */
function metaSource(meta: unknown): string | null {
  if (typeof meta !== 'object' || meta === null) return null
  const source = (meta as Record<string, unknown>).source
  return typeof source === 'string' && source.trim().length > 0 ? source : null
}

/** Flatten a settled result's text blocks under the generic Tool-row text contract. */
function resultText(node: ToolResultBlock): string | null {
  const parts: string[] = []
  for (const item of node.content) {
    if (item.type === 'text') parts.push(item.text)
  }
  const text = parts.join('\n')
  return text.trim().length === 0 ? null : text
}

/**
 * The Markdown the shared renderer draws: its Mermaid fence support consumes a
 * fenced block, while `presentationMeta` carries the bare diagram source and
 * the generic result text is already fenced.
 */
function markdownSource(node: ToolResultBlock): string | null {
  const source = metaSource(node.meta) ?? resultText(node)
  if (source === null) return null
  return source.includes('```') ? source : `\`\`\`mermaid\n${source.trimEnd()}\n\`\`\``
}

/**
 * Keyed `tool.call.toolview` card for `mermaid_render`: it hands the settled
 * fenced source to the shared Markdown renderer, whose Mermaid fence support
 * draws the diagram (and, where the client exposes it, the zoom viewport).
 */
export function MermaidCard(props: ToolCallViewProps & PropsLocale<typeof NS>): ReactNode {
  const { t, phase } = props
  // The client's Mermaid fence support reads `labels.mermaid`; the published
  // MarkdownLabels type predates that field, so the object is asserted.
  const labels = {
    code: { copyLabel: t('copy'), copiedLabel: t('copied') },
    footnotes: t('footnotes'),
    mermaid: { zoomIn: t('zoomIn'), zoomOut: t('zoomOut'), reset: t('reset') },
  } as MarkdownLabels
  if (phase === 'preparing') return <div>{t('preparing')}</div>
  if (phase === 'start') return <div>{t('running')}</div>
  const source = markdownSource(props.block)
  if (source === null) return null
  return <MarkdownText text={source} labels={labels} />
}
