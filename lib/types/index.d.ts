import type { Context } from '@deepseek-ai/cordis';
export declare const name = "tool-mermaid";
export declare const inject: string[];
/** Register the model-facing `mermaid_render` tool on the profile's tool registry.
 * @param ctx - Host plugin context; `tools` is ready because of {@link inject}.
 */
export declare function apply(ctx: Context): void;
