import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { MermaidCard } from './MermaidCard.tsx'
import { NS, en, zh, type MermaidKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    dshMermaid: MermaidKey
  }
}

export const inject = ['slots', 'locale']

/** Register this plugin's dictionaries and its keyed tool card.
 * @param ctx - Browser plugin context; `slots` and `locale` are ready because of {@link inject}.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-mermaid: dictionaries')
  ctx.slots.inject('tool.call.toolview', () => ctx.slots.register(
    { name: 'tool.call.toolview', key: 'mermaid_render', locale: NS },
    MermaidCard,
  ))
}
