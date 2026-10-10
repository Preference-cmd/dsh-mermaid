/**
 * The card's own Mermaid renderer, used when the surrounding client draws
 * ```mermaid fences as ordinary code blocks (upstream DSH does; clients that
 * carry the fence support draw them and lend their own viewport).
 *
 * The engine arrives lazily through the client module system's `require.async`,
 * so a session that never opens this card never fetches it. The engine emits an
 * SVG string; the browser's HTML parser turns it into a tree this module maps
 * onto React elements. The engine sanitizes its output at
 * `securityLevel: 'strict'` (scripts and event handlers removed); the mapping
 * additionally drops every `on*` attribute and `javascript:` URL, so no engine
 * string reaches `dangerouslySetInnerHTML`. Parsing as HTML rather than XML is
 * deliberate: label markup inside `<foreignObject>` may carry HTML void
 * elements such as `<br>`, which no XML parse accepts.
 */
import { createElement, useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { CodeBlock } from '@deepseek-ai/dsh-client-ui-primitives'

type MermaidModule = typeof import('mermaid')

/** One shared engine load per page lifetime; every card reuses the settled module. */
let enginePromise: Promise<MermaidModule> | undefined

/**
 * Import the engine and apply the render options this card relies on.
 * @returns the engine module, with `startOnLoad` disabled and strict sanitizing.
 */
function loadEngine(): Promise<MermaidModule> {
  enginePromise ??= import('mermaid').then((module) => {
    module.default.initialize({ startOnLoad: false, securityLevel: 'strict' })
    return module
  })
  return enginePromise
}

/** Convert one inline `style` attribute string into React's style object. */
function styleObject(css: string): CSSProperties {
  const style: Record<string, string> = {}
  for (const declaration of css.split(';')) {
    const colon = declaration.indexOf(':')
    if (colon === -1) continue
    const name = declaration.slice(0, colon).trim()
    const key = name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
    style[key] = declaration.slice(colon + 1).trim()
  }
  return style
}

/** Whether an attribute value may reach the element. */
function isSafeAttribute(name: string, value: string): boolean {
  if (name.startsWith('on')) return false
  if ((name === 'href' || name === 'xlink:href') && /^\s*javascript:/i.test(value)) return false
  return true
}

/** Map one parsed DOM node onto a React element (text nodes pass through). */
function domToReact(node: ChildNode, key: number): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent
  if (node.nodeType !== Node.ELEMENT_NODE) return null
  const element = node as Element
  const props: Record<string, unknown> = { key }
  for (const attribute of element.attributes) {
    if (!isSafeAttribute(attribute.name, attribute.value)) continue
    if (attribute.name === 'class') props['className'] = attribute.value
    else if (attribute.name === 'style') props['style'] = styleObject(attribute.value)
    else props[attribute.name] = attribute.value
  }
  const children = [...element.childNodes].map(domToReact)
  return children.length === 0
    ? createElement(element.localName, props)
    : createElement(element.localName, props, ...children)
}

/**
 * Parse one serialized engine document down to its `<svg>` root.
 * @param svg - the engine's serialized SVG document.
 * @returns the `<svg>` root, or null when the document holds no SVG element.
 */
function parseSvgRoot(svg: string): Element | null {
  return new DOMParser().parseFromString(svg, 'text/html').querySelector('svg')
}

/** Stable short hash for the engine's render id (ids must be unique per diagram). */
function hashSource(value: string): string {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (Math.imul(hash, 31) + value.charCodeAt(index)) | 0
  }
  return Math.abs(hash).toString(36)
}

/**
 * Render Mermaid source to a React SVG tree.
 * @param source - the bare diagram source, without any fence.
 * @returns the rendered diagram, null while the engine loads, or undefined when
 * the engine rejects the source or returns no SVG (the caller keeps a code
 * fallback).
 */
export function useDiagram(source: string): ReactNode | null | undefined {
  const [tree, setTree] = useState<ReactNode | null | undefined>(null)
  useEffect(() => {
    let cancelled = false
    setTree(null)
    loadEngine().then(
      async (module) => {
        try {
          const { svg } = await module.default.render(`dsh-mermaid-${hashSource(source)}`, source)
          if (cancelled) return
          const root = parseSvgRoot(svg)
          if (root === null) {
            console.warn('dsh-mermaid: the engine returned no SVG root')
            setTree(undefined)
            return
          }
          setTree(domToReact(root, 0))
        } catch (error) {
          if (!cancelled) {
            // The fence keeps its code fallback; the engine's own report is the
            // only account of why the diagram is missing.
            console.warn('dsh-mermaid: the engine rejected this diagram source', error)
            setTree(undefined)
          }
        }
      },
      (error: unknown) => {
        if (!cancelled) {
          console.warn('dsh-mermaid: the engine chunk failed to load', error)
          setTree(undefined)
        }
      },
    )
    return () => {
      cancelled = true
    }
  }, [source])
  return tree
}

/** The diagram frame: the engine's own SVG is width-responsive inside it. */
const FRAME_STYLE: CSSProperties = { maxWidth: '100%' }

/**
 * The diagram this card draws itself, with the source as its code fallback.
 * @param props.source - the bare diagram source.
 * @param props.copyLabel - localized copy action of the fallback fence.
 * @param props.copiedLabel - localized copied confirmation of the fallback fence.
 * @returns the drawn diagram, or the fence while the engine loads or fails.
 */
export function DiagramView({ source, copyLabel, copiedLabel }: {
  source: string
  copyLabel: string
  copiedLabel: string
}): ReactNode {
  const tree = useDiagram(source)
  if (tree === null || tree === undefined) {
    return (
      <CodeBlock
        code={`${source}\n`}
        lang="mermaid"
        copyLabel={copyLabel}
        copiedLabel={copiedLabel}
      />
    )
  }
  return <div style={FRAME_STYLE}>{tree}</div>
}
