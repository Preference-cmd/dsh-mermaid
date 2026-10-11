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
import type { ReactNode } from 'react';
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client';
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import { type MermaidViewDocument } from './viewer.tsx';
import { NS } from './locales.ts';
/** The business face the card registration injects beside its framework props. */
export interface MermaidCardInjected {
    /**
     * Open the diagram in the right-Sidebar viewer tab.
     * @param callId - the settled `mermaid_render` invocation the card shows.
     * @param document - the diagram source and its derived title.
     */
    openViewer(callId: string, document: MermaidViewDocument): void;
}
/**
 * Keyed `tool.call.toolview` card for `mermaid_render`: it hands the settled
 * fenced source to the shared Markdown renderer, whose Mermaid fence support
 * draws the diagram (and, where the client exposes it, the zoom viewport), and
 * offers the right-Sidebar viewer for a large pan/zoom surface.
 */
export declare function MermaidCard(props: ToolCallViewProps & PropsLocale<typeof NS> & MermaidCardInjected): ReactNode;
