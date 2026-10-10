import type { ReactNode } from 'react';
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client';
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import { NS } from './locales.ts';
/**
 * Keyed `tool.call.toolview` card for `mermaid_render`: it hands the settled
 * fenced source to the shared Markdown renderer, whose Mermaid fence support
 * draws the diagram (and, where the client exposes it, the zoom viewport).
 */
export declare function MermaidCard(props: ToolCallViewProps & PropsLocale<typeof NS>): ReactNode;
