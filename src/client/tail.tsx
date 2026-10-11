/**
 * The turn-tail surface: one artifact-style row per settled `mermaid_render`
 * diagram, rendered after a completed Turn's closing message where it can
 * never fold into the process flow.
 *
 * Data comes from a state-only conversation Definition that pairs recorded
 * `mermaid_render` calls with their append-origin results — the diagram source
 * is already durable in the session log, so nothing new is logged and the tail
 * replays identically. Rows stay compact and hand off to the right-Sidebar
 * viewer, the same split the file-delivery tail uses for presented files.
 */
import type { ReactNode } from 'react'
import type { CSSProperties } from 'react'
import type { ConversationNodeDefinition } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { isAppendSurfaceEvent } from '@deepseek-ai/dsh-session/surface'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import { diagramTitle, type MermaidViewDocument } from './viewer.tsx'
import { NS } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-conversation/client' {
  interface ConversationTurnDataMap {
    /** Settled `mermaid_render` diagrams accumulated in this Turn. */
    mermaidDiagrams: MermaidTailData
  }
}

/** One settled diagram published against its Turn. */
export interface MermaidDiagramEntry {
  /** The `mermaid_render` invocation the result settled. */
  readonly callId: string
  /** The bare diagram source, without any fence. */
  readonly source: string
  /** The diagram's frontmatter title, when it names itself. */
  readonly title?: string
}

/** The turn business value this plugin publishes for its tail. */
export interface MermaidTailData {
  readonly diagrams: readonly MermaidDiagramEntry[]
}

/** The injected business face of the tail rows. */
export interface MermaidTailInjected {
  /** Open one diagram in the right-Sidebar viewer tab. */
  openViewer(callId: string, document: MermaidViewDocument): void
}

/** Mutable accumulator behind one Turn's tail data. */
interface MermaidTailState {
  readonly turn: number
  readonly calls: ReadonlySet<string>
  readonly diagrams: readonly MermaidDiagramEntry[]
}

/**
 * The document of one settled result: the host's `presentationMeta` (source and
 * title) when present, otherwise the fenced block the tool returns as its text
 * with a source-level frontmatter title. Shared with the transcript card.
 * @param data - the recorded `tool/result` payload.
 * @returns the bare document, or null when the result carries no diagram.
 */
export function resultDocument(data: {
  readonly meta?: unknown
  readonly message: { readonly content: ReadonlyArray<{ readonly type: string; readonly text?: string }> }
}): MermaidViewDocument | null {
  if (typeof data.meta === 'object' && data.meta !== null) {
    const record = data.meta as Record<string, unknown>
    const source = typeof record.source === 'string' && record.source.trim().length > 0 ? record.source : null
    if (source !== null) {
      const title = typeof record.title === 'string' && record.title.trim().length > 0 ? record.title.trim() : undefined
      return { source, title: title ?? diagramTitle(source) }
    }
  }
  const text = data.message.content
    .filter(part => part.type === 'text' && typeof part.text === 'string')
    .map(part => part.text as string)
    .join('\n')
    .trim()
  if (text.length === 0) return null
  const fenced = /^```mermaid\r?\n([\s\S]*?)\r?\n?```$/.exec(text)
  const source = fenced === null ? text : fenced[1]
  return { source, title: diagramTitle(source) }
}

/**
 * Turn-scoped settled-diagram accumulator; it publishes no view Node.
 * Root calls only, matching the file-delivery Definition's scope: PTC
 * dispatch children do not enter independently.
 */
export const mermaidTailDefinition: ConversationNodeDefinition<MermaidTailState> = {
  // The engine requires a Definition's published Location key to equal its kind.
  kind: 'mermaidDiagrams',
  match: (event) => {
    if (event.type !== 'turn/start' && event.type !== 'tool/call' && event.type !== 'tool/result') return null
    const turn = (event.data as Record<string, unknown> | undefined)?.turn
    if (typeof turn !== 'number') return null
    if (event.type === 'turn/start') return { id: String(turn), role: 'start' }
    if (event.type === 'tool/call') return { id: String(turn), role: 'update' }
    return isAppendSurfaceEvent(event) ? { id: String(turn), role: 'update' } : null
  },
  start: (_context, match) => {
    if (match.event.type !== 'turn/start') throw new Error('mermaid tail start requires turn/start')
    return { turn: match.event.data.turn, calls: new Set(), diagrams: [] }
  },
  update: (context, match) => {
    const event = match.event
    if (event.type === 'tool/call') {
      if (event.data.name !== 'mermaid_render') return context.state
      const calls = new Set(context.state.calls)
      calls.add(String(event.data.callId))
      return { ...context.state, calls }
    }
    if (event.type !== 'tool/result') return context.state
    const callId = String(event.data.message.source.callId)
    if (!context.state.calls.has(callId) || event.data.message.isError === true) return context.state
    const document = resultDocument(event.data)
    if (document === null || context.state.diagrams.some(entry => entry.callId === callId)) return context.state
    return {
      ...context.state,
      diagrams: [...context.state.diagrams, { callId, ...document }],
    }
  },
  buildLocationData: (context, scope, previous) => {
    if (scope !== 'turn' || context.state === undefined) return null
    const value = { diagrams: context.state.diagrams }
    if (previous?.kind === 'turn'
      && previous.turn === context.state.turn
      && previous.key === 'mermaidDiagrams'
      && (previous.value as MermaidTailData).diagrams === context.state.diagrams) return previous
    return { kind: 'turn', turn: context.state.turn, key: 'mermaidDiagrams', value }
  },
}

/** The tail lists its rows in a quiet bordered group. */
const TAIL_STYLE: CSSProperties = {
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  width: '100%',
  padding: 8,
  border: '0.5px solid var(--dsw-alias-border-l1, #ccc)',
  borderRadius: 'var(--dsw-radius-xl, 12px)',
}

/** One artifact-style row: the diagram's name, then its viewer affordance. */
const ROW_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  minWidth: 0,
}

/** Row titles truncate instead of pushing the affordance out. */
const LABEL_STYLE: CSSProperties = {
  overflow: 'hidden',
  minWidth: 0,
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: 13,
  fontWeight: 500,
}

/** The row's viewer affordance. */
const BUTTON_STYLE: CSSProperties = {
  boxSizing: 'border-box',
  flexShrink: 0,
  height: 24,
  padding: '0 8px',
  border: '0.5px solid var(--dsw-alias-border-l1, #ccc)',
  borderRadius: 8,
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
  fontSize: 12,
  cursor: 'pointer',
}

/**
 * The keyed `conversation.chat.turnTail` entry for `dsh-mermaid`: one row per
 * settled diagram, or nothing on turns that drew none.
 */
export function MermaidDiagramsTail(props: PropsRuntime<'conversation.chat.turnTail'> & PropsLocale<typeof NS> & MermaidTailInjected): ReactNode {
  const diagrams = props.turn.data.get('mermaidDiagrams')?.diagrams ?? []
  if (diagrams.length === 0) return null
  return (
    <div style={TAIL_STYLE} data-dsh-mermaid-tail="">
      {diagrams.map(diagram => (
        <div key={diagram.callId} style={ROW_STYLE}>
          <span style={LABEL_STYLE}>{diagram.title ?? props.t('viewerTitle')}</span>
          <button
            type="button"
            style={BUTTON_STYLE}
            onClick={() => props.openViewer(diagram.callId, { source: diagram.source, title: diagram.title })}
          >
            {props.t('openViewer')}
          </button>
        </div>
      ))}
    </div>
  )
}
