import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import { MermaidCard, type MermaidCardInjected } from './MermaidCard.tsx'
import { MermaidDiagramsTail, mermaidTailDefinition } from './tail.tsx'
import { MermaidViewer, MermaidViewerTitle, isMermaidAddress, mermaidAddress, type MermaidViewDocument } from './viewer.tsx'
import { NS, en, zh, type MermaidKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    dshMermaid: MermaidKey
  }
}

export const inject = ['slots', 'locale', 'uiConversation', 'sidebarRight', 'sidebarRightTabs']

/** The tab-type id; the key its body and title register under. */
const VIEWER_ID = 'dsh-mermaid'

/**
 * The injected face both the card and the tail share: open one diagram's
 * viewer tab under the session it belongs to.
 * @param ctx - Browser plugin context with `sidebarRight` ready.
 * @param sessionId - Session whose transcript displays the diagram.
 * @returns the injected `openViewer` action.
 */
function openViewerInject(ctx: Context, sessionId: string): MermaidCardInjected {
  return {
    openViewer: (callId, document) => {
      ctx.sidebarRight.openResource(mermaidAddress(sessionId, callId), { params: { diagram: document } })
    },
  }
}

/** Register this plugin's dictionaries, viewer tab, turn tail, and keyed tool card.
 * @param ctx - Browser plugin context; the injected services are ready because of {@link inject}.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-mermaid: dictionaries')
  const t = ctx.locale.bind(NS)
  ctx.effect(() => ctx.uiConversation.events.register(mermaidTailDefinition), 'dsh-mermaid: conversation definition')
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: VIEWER_ID,
    kind: 'mermaid',
    patterns: ['dsh-resource://mermaid/**'],
    canOpen: isMermaidAddress,
    title: () => t('viewerTitle'),
  }), 'dsh-mermaid: sidebar tab type')
  ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register(
    { name: 'sidebar.right.pane.tab', key: VIEWER_ID, locale: NS },
    MermaidViewer,
  ))
  ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register(
    { name: 'sidebar.right.pane.tab.title', key: VIEWER_ID },
    MermaidViewerTitle,
  ))
  ctx.slots.inject('conversation.chat.turnTail', () => ctx.slots.register(
    {
      name: 'conversation.chat.turnTail',
      id: VIEWER_ID,
      locale: NS,
      inject: (sessionId) => openViewerInject(ctx, sessionId),
    },
    MermaidDiagramsTail,
  ))
  ctx.slots.inject('tool.call.toolview', () => ctx.slots.register(
    {
      name: 'tool.call.toolview',
      key: 'mermaid_render',
      locale: NS,
      inject: (sessionId) => openViewerInject(ctx, sessionId),
    },
    MermaidCard,
  ))
}
