import { defineTool } from "@deepseek-ai/dsh-tools";
//#region src/index.ts
const name = "tool-mermaid";
const inject = ["tools"];
/** Register the model-facing `mermaid_render` tool on the profile's tool registry.
* @param ctx - Host plugin context; `tools` is ready because of {@link inject}.
*/
function apply(ctx) {
	ctx.tools.register(defineTool({
		name: "mermaid_render",
		description: "Return Mermaid diagram source unchanged for the web client to render. Rejects an empty diagram.",
		parameters: { diagram: {
			type: "string",
			required: true,
			description: "The Mermaid diagram source code."
		} },
		output: {
			schema: {
				type: "object",
				additionalProperties: true,
				properties: { diagram: { type: "string" } }
			},
			render: (_args, value) => [{
				type: "text",
				text: typeof value.diagram === "string" && value.diagram.length > 0 ? `\`\`\`mermaid\n${value.diagram}\n\`\`\`` : ""
			}],
			presentationMeta: (_args, value) => ({ source: typeof value.diagram === "string" ? value.diagram : "" })
		},
		execute(args) {
			const diagram = args.diagram;
			if (diagram.trim().length === 0) throw new Error("mermaid_render: diagram must not be empty");
			return Promise.resolve({ diagram });
		},
		presentCall: (args) => ({
			card: "generic",
			title: "Render Mermaid diagram",
			kind: "other",
			rawInput: args.diagram
		})
	}));
}
//#endregion
export { apply, inject, name };
