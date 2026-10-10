import type { Context } from '@deepseek-ai/cordis';
import { type MermaidKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        dshMermaid: MermaidKey;
    }
}
export declare const inject: string[];
/** Register this plugin's dictionaries and its keyed tool card.
 * @param ctx - Browser plugin context; `slots` and `locale` are ready because of {@link inject}.
 */
export declare function apply(ctx: Context): void;
