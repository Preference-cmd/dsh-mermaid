/**
 * Keyed `tool.call.toolview` card for `mermaid_render`.
 *
 * The card prefers the surrounding client's fence renderer: a client that draws
 * ```mermaid fences turns the source into a diagram and lends its own zoom and
 * pan viewport. A client that renders the fence as an ordinary code block —
 * upstream DSH does — gets the diagram from {@link DiagramView} instead. Which
 * one applies is only observable after the render settles, so the card watches
 * its own output for the client's diagram and falls back when none appears.
 */
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import type { MarkdownLabels } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { DiagramView } from './diagram.tsx'
import { NS } from './locales.ts'

/** The settled result node the `result` phase carries. */
type ToolResultBlock = Extract<ToolCallViewProps, { phase: 'result' }>['block']

/** Fence the shared Markdown renderer consumes. */
const FENCE = '```mermaid'

/** The id the client's own fence renderer mints for a settled diagram. */
const DIAGRAM_SELECTOR = 'svg[id^="dsh-mermaid-"]'

/** How long the client's fence renderer gets to settle a diagram before the card draws it. */
const CLIENT_DRAW_GRACE_MS = 1_200

/**
 * Whether the surrounding client draws Mermaid fences, once some card has seen
 * one settle. Undefined until then, so the first card pays the grace period and
 * every later card reuses the verdict.
 */
let clientDrawsFences: boolean | undefined

/**
 * Debug switch, read when this plugin loads: `'card'` pins the card's own
 * renderer, `'client'` pins the surrounding client's fence renderer, and
 * anything else leaves the card to observe which one draws.
 */
const PINNED_RENDERER = (globalThis as { __DSH_MERMAID_RENDERER__?: unknown })
  .__DSH_MERMAID_RENDERER__

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
 * The bare diagram source: `presentationMeta.source` when the host published
 * it, otherwise the result text with its own ```mermaid fence removed.
 */
function bareSource(node: ToolResultBlock): string | null {
  const meta = metaSource(node)
  if (meta !== null) return meta
  const text = resultText(node)
  if (text === null) return null
  const fenced = /^```mermaid\r?\n([\s\S]*?)\r?\n?```$/.exec(text.trim())
  return fenced === null ? text : fenced[1]
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
  const source = bareSource(props.block)
  if (source === null) return null
  return (
    <Diagram
      source={source}
      labels={labels}
      copyLabel={t('copy')}
      copiedLabel={t('copied')}
    />
  )
}

/**
 * Draw one diagram, preferring the client's own fence renderer.
 * @param props.source - the bare diagram source.
 * @param props.labels - localized chrome the client's Markdown renderer consumes.
 * @param props.copyLabel - localized copy action of the card's code fallback.
 * @param props.copiedLabel - localized copied confirmation of the card's code fallback.
 * @returns the client's diagram, or the diagram this card draws itself.
 */
function Diagram({ source, labels, copyLabel, copiedLabel }: {
  source: string
  labels: MarkdownLabels
  copyLabel: string
  copiedLabel: string
}): ReactNode {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [draws, setDraws] = useState(PINNED_RENDERER !== 'card' && clientDrawsFences !== false)
  useEffect(() => {
    if (!draws || PINNED_RENDERER !== undefined) return
    const timer = window.setTimeout(() => {
      const diagram = hostRef.current?.querySelector(DIAGRAM_SELECTOR) ?? null
      clientDrawsFences = diagram !== null
      if (diagram === null) setDraws(false)
    }, CLIENT_DRAW_GRACE_MS)
    return () => {
      window.clearTimeout(timer)
    }
  }, [draws, source])
  if (!draws) return <DiagramView source={source} copyLabel={copyLabel} copiedLabel={copiedLabel} />
  return (
    <div ref={hostRef}>
      <MarkdownText text={`${FENCE}\n${source.trimEnd()}\n\`\`\``} labels={labels} />
    </div>
  )
}
