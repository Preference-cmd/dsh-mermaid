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
import type { ReactNode } from 'react';
import type { ConversationNodeDefinition } from '@deepseek-ai/dsh-client-ui-conversation/client';
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import { type MermaidViewDocument } from './viewer.tsx';
import { NS } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-conversation/client' {
    interface ConversationTurnDataMap {
        /** Settled `mermaid_render` diagrams accumulated in this Turn. */
        mermaidDiagrams: MermaidTailData;
    }
}
/** One settled diagram published against its Turn. */
export interface MermaidDiagramEntry {
    /** The `mermaid_render` invocation the result settled. */
    readonly callId: string;
    /** The bare diagram source, without any fence. */
    readonly source: string;
    /** The diagram's frontmatter title, when it names itself. */
    readonly title?: string;
}
/** The turn business value this plugin publishes for its tail. */
export interface MermaidTailData {
    readonly diagrams: readonly MermaidDiagramEntry[];
}
/** The injected business face of the tail rows. */
export interface MermaidTailInjected {
    /** Open one diagram in the right-Sidebar viewer tab. */
    openViewer(callId: string, document: MermaidViewDocument): void;
}
/** Mutable accumulator behind one Turn's tail data. */
interface MermaidTailState {
    readonly turn: number;
    readonly calls: ReadonlySet<string>;
    readonly diagrams: readonly MermaidDiagramEntry[];
}
/**
 * The document of one settled result: the host's `presentationMeta` (source and
 * title) when present, otherwise the fenced block the tool returns as its text
 * with a source-level frontmatter title. Shared with the transcript card.
 * @param data - the recorded `tool/result` payload.
 * @returns the bare document, or null when the result carries no diagram.
 */
export declare function resultDocument(data: {
    readonly meta?: unknown;
    readonly message: {
        readonly content: ReadonlyArray<{
            readonly type: string;
            readonly text?: string;
        }>;
    };
}): MermaidViewDocument | null;
/**
 * Turn-scoped settled-diagram accumulator; it publishes no view Node.
 * Root calls only, matching the file-delivery Definition's scope: PTC
 * dispatch children do not enter independently.
 */
export declare const mermaidTailDefinition: ConversationNodeDefinition<MermaidTailState>;
/**
 * The keyed `conversation.chat.turnTail` entry for `dsh-mermaid`: one row per
 * settled diagram, or nothing on turns that drew none.
 */
export declare function MermaidDiagramsTail(props: PropsRuntime<'conversation.chat.turnTail'> & PropsLocale<typeof NS> & MermaidTailInjected): ReactNode;
export {};
