import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'tool-mermaid'
export const inject = ['tools']

/** The longest diagram title the tool accepts; longer names get their own diagram text instead. */
const MAX_TITLE_LENGTH = 200

/** Register the model-facing `mermaid_render` tool on the profile's tool registry.
 * @param ctx - Host plugin context; `tools` is ready because of {@link inject}.
 */
export function apply(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'mermaid_render',
    description: 'Return Mermaid diagram source unchanged for the web client to render. Rejects an empty diagram.',
    parameters: {
      diagram: {
        type: 'string',
        required: true,
        description: 'The Mermaid diagram source code.',
      },
      title: {
        type: 'string',
        description: `A short title naming the diagram (at most ${MAX_TITLE_LENGTH} characters), shown beside it in the transcript tail and its viewer.`,
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: true,
        properties: {
          diagram: { type: 'string' },
          title: { type: 'string' },
        },
      },
      render: (_args, value) => [{
        type: 'text' as const,
        text: typeof value.diagram === 'string' && value.diagram.length > 0
          ? `\`\`\`mermaid\n${value.diagram}\n\`\`\``
          : '',
      }],
      presentationMeta: (_args, value) => ({
        source: typeof value.diagram === 'string' ? value.diagram : '',
        ...(typeof value.title === 'string' && value.title.trim().length > 0 ? { title: value.title.trim() } : {}),
      }),
    },
    execute(args) {
      const diagram = args.diagram
      if (diagram.trim().length === 0) throw new Error('mermaid_render: diagram must not be empty')
      const rawTitle = args.title?.trim()
      if (rawTitle !== undefined && rawTitle !== '' && rawTitle.length > MAX_TITLE_LENGTH) {
        throw new Error(`mermaid_render: title must be at most ${MAX_TITLE_LENGTH} characters; give the diagram its own source-level title instead`)
      }
      return Promise.resolve({ diagram, ...(rawTitle !== undefined && rawTitle !== '' ? { title: rawTitle } : {}) })
    },
    presentCall: args => ({
      card: 'generic',
      title: args.title !== undefined && args.title.trim() !== '' ? args.title.trim() : 'Render Mermaid diagram',
      kind: 'other',
      rawInput: args.diagram,
    }),
  }))
}
