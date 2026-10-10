window.__ModuleLoader__.load({
	id: "dsh-mermaid",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/MermaidCard.tsx
		/** Persisted `output.presentationMeta` this card reads; replay data arrives unvalidated. */
		function metaSource(meta) {
			if (typeof meta !== "object" || meta === null) return null;
			const source = meta.source;
			return typeof source === "string" && source.trim().length > 0 ? source : null;
		}
		/** Flatten a settled result's text blocks under the generic Tool-row text contract. */
		function resultText(node) {
			const parts = [];
			for (const item of node.content) if (item.type === "text") parts.push(item.text);
			const text = parts.join("\n");
			return text.trim().length === 0 ? null : text;
		}
		/**
		* The Markdown the shared renderer draws: its Mermaid fence support consumes a
		* fenced block, while `presentationMeta` carries the bare diagram source and
		* the generic result text is already fenced.
		*/
		function markdownSource(node) {
			const source = metaSource(node.meta) ?? resultText(node);
			if (source === null) return null;
			return source.includes("```") ? source : `\`\`\`mermaid\n${source.trimEnd()}\n\`\`\``;
		}
		/**
		* Keyed `tool.call.toolview` card for `mermaid_render`: it hands the settled
		* fenced source to the shared Markdown renderer, whose Mermaid fence support
		* draws the diagram (and, where the client exposes it, the zoom viewport).
		*/
		function MermaidCard(props) {
			const { t, phase } = props;
			const labels = {
				code: {
					copyLabel: t("copy"),
					copiedLabel: t("copied")
				},
				footnotes: t("footnotes"),
				mermaid: {
					zoomIn: t("zoomIn"),
					zoomOut: t("zoomOut"),
					reset: t("reset")
				}
			};
			if (phase === "preparing") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: t("preparing") });
			if (phase === "start") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: t("running") });
			const source = markdownSource(props.block);
			if (source === null) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MarkdownText, {
				text: source,
				labels
			});
		}
		//#endregion
		//#region src/client/locales.ts
		/** Locale namespace owned by this plugin's card. */
		const NS = "dshMermaid";
		/** Chinese dictionary; the key set is the source of truth. */
		const zh = {
			preparing: "准备中",
			running: "正在绘制图表",
			copy: "复制",
			copied: "已复制",
			footnotes: "引用",
			zoomIn: "放大",
			zoomOut: "缩小",
			reset: "复位"
		};
		/** English dictionary; completeness is checked against {@link MermaidKey}. */
		const en = {
			preparing: "Preparing",
			running: "Rendering diagram",
			copy: "Copy",
			copied: "Copied",
			footnotes: "References",
			zoomIn: "Zoom in",
			zoomOut: "Zoom out",
			reset: "Reset zoom"
		};
		//#endregion
		//#region src/client/index.ts
		const inject = ["slots", "locale"];
		/** Register this plugin's dictionaries and its keyed tool card.
		* @param ctx - Browser plugin context; `slots` and `locale` are ready because of {@link inject}.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-mermaid: dictionaries");
			ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
				name: "tool.call.toolview",
				key: "mermaid_render",
				locale: NS
			}, MermaidCard));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
