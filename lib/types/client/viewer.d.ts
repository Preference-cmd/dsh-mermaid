import type { ReactNode } from 'react';
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import { NS } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-sidebar-right/client' {
    interface SidebarRightResourceParamsMap {
        /** One settled diagram, carried in-memory from its `mermaid_render` card. */
        mermaid: {
            diagram: MermaidViewDocument;
        };
    }
}
/** The document one viewer tab draws. */
export interface MermaidViewDocument {
    /** The bare diagram source, without any fence. */
    readonly source: string;
    /** The diagram's frontmatter title, when it names itself. */
    readonly title?: string;
}
/**
 * Name one diagram's viewer tab: the Session and the tool call it belongs to.
 * Two opens of one address are the same tab, so reopening a call's diagram
 * focuses the tab it already has.
 * @param sessionId - Session displaying the diagram.
 * @param callId - the settled `mermaid_render` invocation.
 * @returns the resource address for the viewer tab.
 */
export declare function mermaidAddress(sessionId: string, callId: string): string;
/**
 * Recognize a viewer address without decoding it: the tab body reads its
 * document from navigation params, never from the address.
 * @param address - saved or caller-supplied navigation address.
 * @returns whether the address identifies a diagram viewer tab.
 */
export declare function isMermaidAddress(address: string): boolean;
/**
 * Read the diagram's own title from its frontmatter block, when it carries one.
 * @param source - the bare diagram source.
 * @returns the frontmatter title, or undefined.
 */
export declare function diagramTitle(source: string): string | undefined;
/**
 * The keyed `sidebar.right.pane.tab` body for `dsh-mermaid`: the document from
 * the tab's navigation params, drawn on the zoom/pan surface.
 */
export declare function MermaidViewer({ useTabInfo, t }: PropsRuntime<'sidebar.right.pane.tab'> & PropsLocale<typeof NS>): ReactNode;
/**
 * The tab chip's title for `dsh-mermaid`: the diagram's frontmatter title while
 * its params live, otherwise the title captured at open time.
 */
export declare function MermaidViewerTitle({ useTabInfo }: PropsRuntime<'sidebar.right.pane.tab.title'>): ReactNode;
