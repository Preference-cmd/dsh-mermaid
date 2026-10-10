import type { ReactNode } from 'react'
import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import type { MarkdownLabels } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { NS } from './locales.ts'

/** Persisted `output.presentationMeta` this card reads; replay data arrives unvalidated. */
function metaSource(meta: unknown): string | null {
  if (typeof meta !== 'object' || meta === null) return null
  const source = (meta as Record<string, unknown>).source
  return typeof source === 'string' && source.length > 0 ? source : null
}

/**
 * Flatten a settled result's text blocks under the generic Tool-row text
 * contract, keeping the fenced `mermaid` block the Host rendered.
 */
function resultText(block: ToolCallViewProps['block']): string | null {
  if (block.phase !== 'result') return null
  const parts: string[] = []
  for (const item of block.block.content) {
    if (item.type === 'text') parts.push(item.text)
  }
  const text = parts.join('\n')
  return text.length === 0 ? null : text
}

/** The diagram source: persisted metadata first, the rendered result text otherwise. */
function diagramSource(block: ToolCallViewProps['block']): string | null {
  if (block.phase !== 'result') return null
  return metaSource(block.block.meta) ?? resultText(block)
}

/**
 * Keyed `tool.call.toolview` card for `mermaid_render`: it hands the settled
 * fenced source to the shared Markdown renderer, whose Mermaid fence support
 * draws the diagram (and, where the client exposes it, the zoom viewport).
 */
export function MermaidCard(props: ToolCallViewProps & PropsLocale<typeof NS>): ReactNode {
  const { t, phase } = props
  const labels: MarkdownLabels = {
    code: { copyLabel: t('copy'), copiedLabel: t('copied') },
    footnotes: t('footnotes'),
    mermaid: { zoomIn: t('zoomIn'), zoomOut: t('zoomOut'), reset: t('reset') },
  }
  if (phase === 'preparing') return <div>{t('preparing')}</div>
  if (phase === 'start') return <div>{t('running')}</div>
  const source = diagramSource(props.block)
  if (source === null) return null
  return <MarkdownText text={source} labels={labels} />
}
