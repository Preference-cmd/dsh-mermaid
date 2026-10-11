/**
 * The right-Sidebar viewer tab: one settled `mermaid_render` diagram drawn
 * large, with its own zoom and pan surface.
 *
 * Navigation follows the plan-review shape: the tab carries its document in
 * in-memory params and is never persisted in sidebar layout — the durable copy
 * of a diagram is its session log, and the transcript card is the way back to
 * it. A params-less reopen (a restored layout) renders an expired notice
 * instead of an empty pane.
 */
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { PropsLocale, PropsRuntime, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import { useDiagram } from './diagram.tsx'
import { NS } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-sidebar-right/client' {
  interface SidebarRightResourceParamsMap {
    /** One settled diagram, carried in-memory from its `mermaid_render` card. */
    mermaid: { diagram: MermaidViewDocument }
  }
}

/** The document one viewer tab draws. */
export interface MermaidViewDocument {
  /** The bare diagram source, without any fence. */
  readonly source: string
  /** The diagram's frontmatter title, when it names itself. */
  readonly title?: string
}

/**
 * Name one diagram's viewer tab: the Session and the tool call it belongs to.
 * Two opens of one address are the same tab, so reopening a call's diagram
 * focuses the tab it already has.
 * @param sessionId - Session displaying the diagram.
 * @param callId - the settled `mermaid_render` invocation.
 * @returns the resource address for the viewer tab.
 */
export function mermaidAddress(sessionId: string, callId: string): string {
  return `dsh-resource://mermaid/${encodeURIComponent(sessionId)}/${encodeURIComponent(callId)}`
}

/**
 * Recognize a viewer address without decoding it: the tab body reads its
 * document from navigation params, never from the address.
 * @param address - saved or caller-supplied navigation address.
 * @returns whether the address identifies a diagram viewer tab.
 */
export function isMermaidAddress(address: string): boolean {
  return /^dsh-resource:\/\/mermaid\/[^/?#]+\/[^/?#]+$/.test(address)
}

/**
 * Read the diagram's own title from its frontmatter block, when it carries one.
 * @param source - the bare diagram source.
 * @returns the frontmatter title, or undefined.
 */
export function diagramTitle(source: string): string | undefined {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source.trim())
  if (frontmatter === null) return undefined
  return /^title:\s*(\S[^\r\n]*)$/m.exec(frontmatter[1])?.[1]?.trim() || undefined
}

/** Zoom bounds of the viewer surface, in multiples of the diagram's natural size. */
const MIN_SCALE = 0.2
const MAX_SCALE = 6

/** Fallback natural size when the engine SVG carries no readable viewBox. */
const FALLBACK_NATURAL = { w: 800, h: 600 }

/** The pan/zoom surface fills the tab body and owns its gestures. */
const SURFACE_STYLE: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  width: '100%',
  height: '100%',
  minHeight: 240,
  boxSizing: 'border-box',
  background: 'var(--dsw-static-neutral-50, #f5f5f5)',
  touchAction: 'none',
  userSelect: 'none',
  cursor: 'grab',
}

/** Full-bleed status lines (loading, engine failure, expired params). */
const MESSAGE_STYLE: CSSProperties = {
  boxSizing: 'border-box',
  width: '100%',
  padding: 16,
  color: 'var(--dsw-alias-label-secondary, #666)',
  font: 'inherit',
}

/** The floating zoom toolbar in the surface's top-right corner. */
const TOOLBAR_STYLE: CSSProperties = {
  position: 'absolute',
  top: 8,
  right: 8,
  zIndex: 1,
  display: 'flex',
  gap: 4,
}

/** One toolbar button; gestures on the surface skip it. */
const BUTTON_STYLE: CSSProperties = {
  boxSizing: 'border-box',
  minWidth: 26,
  height: 26,
  padding: '0 8px',
  border: '0.5px solid var(--dsw-alias-border-l1, #ccc)',
  borderRadius: 8,
  background: 'var(--dsw-static-neutral-0, #fff)',
  color: 'inherit',
  font: 'inherit',
  fontSize: 12,
  cursor: 'pointer',
}

/** One zoom/pan transform: translation in surface pixels plus a scale. */
interface View {
  readonly x: number
  readonly y: number
  readonly k: number
}

/** Clamp a scale into the viewer's bounds. */
function clampScale(k: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, k))
}

/**
 * The keyed `sidebar.right.pane.tab` body for `dsh-mermaid`: the document from
 * the tab's navigation params, drawn on the zoom/pan surface.
 */
export function MermaidViewer({ useTabInfo, t }: PropsRuntime<'sidebar.right.pane.tab'> & PropsLocale<typeof NS>): ReactNode {
  const tab = useTabInfo()
  const params = tab.tab.navigation.params
  const diagram = params !== undefined && 'diagram' in params ? params.diagram : undefined
  if (diagram === undefined) return <div style={MESSAGE_STYLE} role="status">{t('viewerExpired')}</div>
  return <ViewerSurface t={t} source={diagram.source} />
}

/**
 * The tab chip's title for `dsh-mermaid`: the diagram's frontmatter title while
 * its params live, otherwise the title captured at open time.
 */
export function MermaidViewerTitle({ useTabInfo }: PropsRuntime<'sidebar.right.pane.tab.title'>): ReactNode {
  const tab = useTabInfo()
  const params = tab.tab.navigation.params
  const diagram = params !== undefined && 'diagram' in params ? params.diagram : undefined
  return <>{diagram?.title ?? tab.tab.title}</>
}

/**
 * Draw one diagram large: the engine's SVG normalized to its viewBox size, so
 * the pan/zoom transform has a stable natural size to scale.
 * @param props.t - localized chrome of the surface and its toolbar.
 * @param props.source - the bare diagram source.
 */
function ViewerSurface({ t, source }: { t: TranslateNS<typeof NS>; source: string }): ReactNode {
  const tree = useDiagram(source)
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const [natural, setNatural] = useState<{ w: number; h: number } | undefined>(undefined)
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 })
  const dragRef = useRef<{ id: number; x: number; y: number; view: View } | undefined>(undefined)

  // The engine emits a width-responsive SVG; pin it to the wrapper's natural
  // size so zooming scales a fixed document instead of reflowing it.
  useEffect(() => {
    if (tree === null || tree === undefined) return
    const svg = surfaceRef.current?.querySelector('svg') ?? null
    if (svg === null) return
    svg.style.maxWidth = 'none'
    svg.style.width = '100%'
    svg.style.height = '100%'
    const box = /^[-0-9.]+\s+[-0-9.]+\s+([0-9.]+)\s+([0-9.]+)$/.exec(svg.getAttribute('viewBox') ?? '')
    const w = box === null ? NaN : Number(box[1])
    const h = box === null ? NaN : Number(box[2])
    setNatural(Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 ? { w, h } : FALLBACK_NATURAL)
  }, [tree])

  /** Zoom by one multiplicative factor around a surface point. */
  const zoomAt = useCallback((factor: number, px: number, py: number): void => {
    setView(v => {
      const k = clampScale(v.k * factor)
      if (k === v.k) return v
      const ratio = k / v.k
      return { k, x: px - (px - v.x) * ratio, y: py - (py - v.y) * ratio }
    })
  }, [])

  // React's root wheel listener is passive; the surface zoom needs the
  // non-preventable default (pane scrolling) gone, so it listens natively.
  useEffect(() => {
    const surface = surfaceRef.current
    if (surface === null) return
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault()
      const rect = surface.getBoundingClientRect()
      zoomAt(Math.exp(-event.deltaY * 0.0015), event.clientX - rect.left, event.clientY - rect.top)
    }
    surface.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      surface.removeEventListener('wheel', onWheel)
    }
  }, [zoomAt])

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if ((event.target as HTMLElement).closest('button') !== null) return
    const surface = surfaceRef.current
    if (surface === null) return
    surface.setPointerCapture(event.pointerId)
    dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, view }
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current
    if (drag === undefined || drag.id !== event.pointerId) return
    setView({ k: drag.view.k, x: drag.view.x + event.clientX - drag.x, y: drag.view.y + event.clientY - drag.y })
  }
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (dragRef.current?.id === event.pointerId) dragRef.current = undefined
  }

  if (tree === null) return <div style={MESSAGE_STYLE} role="status">{t('viewerLoading')}</div>
  if (tree === undefined) {
    return <div style={MESSAGE_STYLE} role="status">{t('viewerFailed')}</div>
  }
  return (
    <div
      ref={surfaceRef}
      style={SURFACE_STYLE}
      aria-label={t('viewerTitle')}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div style={TOOLBAR_STYLE}>
        <button type="button" style={BUTTON_STYLE} aria-label={t('zoomIn')} onClick={() => zoomAt(1.25, midX(surfaceRef.current), midY(surfaceRef.current))}>＋</button>
        <button type="button" style={BUTTON_STYLE} aria-label={t('zoomOut')} onClick={() => zoomAt(0.8, midX(surfaceRef.current), midY(surfaceRef.current))}>－</button>
        <button type="button" style={BUTTON_STYLE} onClick={() => setView({ x: 0, y: 0, k: 1 })}>{t('reset')}</button>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: natural?.w,
          height: natural?.h,
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
          transformOrigin: '0 0',
        }}
      >
        {tree}
      </div>
    </div>
  )
}

/** The surface's horizontal center, or 0 before it mounts. */
function midX(surface: HTMLDivElement | null): number {
  return surface === null ? 0 : surface.clientWidth / 2
}

/** The surface's vertical center, or 0 before it mounts. */
function midY(surface: HTMLDivElement | null): number {
  return surface === null ? 0 : surface.clientHeight / 2
}
