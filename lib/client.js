window.__ModuleLoader__.load({
	id: "dsh-mermaid",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/diagram.tsx
		/**
		* The card's own Mermaid renderer, used when the surrounding client draws
		* ```mermaid fences as ordinary code blocks (upstream DSH does; clients that
		* carry the fence support draw them and lend their own viewport).
		*
		* The engine arrives lazily through the client module system's `require.async`,
		* so a session that never opens this card never fetches it. The engine emits an
		* SVG string; the browser's HTML parser turns it into a tree this module maps
		* onto React elements. The engine sanitizes its output at
		* `securityLevel: 'strict'` (scripts and event handlers removed); the mapping
		* additionally drops every `on*` attribute and `javascript:` URL, so no engine
		* string reaches `dangerouslySetInnerHTML`. Parsing as HTML rather than XML is
		* deliberate: label markup inside `<foreignObject>` may carry HTML void
		* elements such as `<br>`, which no XML parse accepts.
		*/
		/** One shared engine load per page lifetime; every card reuses the settled module. */
		let enginePromise;
		/**
		* Import the engine and apply the render options this card relies on.
		* @returns the engine module, with `startOnLoad` disabled and strict sanitizing.
		*/
		function loadEngine() {
			enginePromise ??= require.async("./client.mermaid.js").then((module) => {
				module.default.initialize({
					startOnLoad: false,
					securityLevel: "strict"
				});
				return module;
			});
			return enginePromise;
		}
		/** Convert one inline `style` attribute string into React's style object. */
		function styleObject(css) {
			const style = {};
			for (const declaration of css.split(";")) {
				const colon = declaration.indexOf(":");
				if (colon === -1) continue;
				const key = declaration.slice(0, colon).trim().replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
				style[key] = declaration.slice(colon + 1).trim();
			}
			return style;
		}
		/** Whether an attribute value may reach the element. */
		function isSafeAttribute(name, value) {
			if (name.startsWith("on")) return false;
			if ((name === "href" || name === "xlink:href") && /^\s*javascript:/i.test(value)) return false;
			return true;
		}
		/** Map one parsed DOM node onto a React element (text nodes pass through). */
		function domToReact(node, key) {
			if (node.nodeType === Node.TEXT_NODE) return node.textContent;
			if (node.nodeType !== Node.ELEMENT_NODE) return null;
			const element = node;
			const props = { key };
			for (const attribute of element.attributes) {
				if (!isSafeAttribute(attribute.name, attribute.value)) continue;
				if (attribute.name === "class") props["className"] = attribute.value;
				else if (attribute.name === "style") props["style"] = styleObject(attribute.value);
				else props[attribute.name] = attribute.value;
			}
			const children = [...element.childNodes].map(domToReact);
			return children.length === 0 ? (0, react.createElement)(element.localName, props) : (0, react.createElement)(element.localName, props, ...children);
		}
		/**
		* Parse one serialized engine document down to its `<svg>` root.
		* @param svg - the engine's serialized SVG document.
		* @returns the `<svg>` root, or null when the document holds no SVG element.
		*/
		function parseSvgRoot(svg) {
			return new DOMParser().parseFromString(svg, "text/html").querySelector("svg");
		}
		/** Stable short hash for the engine's render id (ids must be unique per diagram). */
		function hashSource(value) {
			let hash = 0;
			for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash, 31) + value.charCodeAt(index) | 0;
			return Math.abs(hash).toString(36);
		}
		/**
		* Render Mermaid source to a React SVG tree.
		* @param source - the bare diagram source, without any fence.
		* @returns the rendered diagram, null while the engine loads, or undefined when
		* the engine rejects the source or returns no SVG (the caller keeps a code
		* fallback).
		*/
		function useDiagram(source) {
			const [tree, setTree] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				let cancelled = false;
				setTree(null);
				loadEngine().then(async (module) => {
					try {
						const { svg } = await module.default.render(`dsh-mermaid-${hashSource(source)}`, source);
						if (cancelled) return;
						const root = parseSvgRoot(svg);
						if (root === null) {
							console.warn("dsh-mermaid: the engine returned no SVG root");
							setTree(void 0);
							return;
						}
						setTree(domToReact(root, 0));
					} catch (error) {
						if (!cancelled) {
							console.warn("dsh-mermaid: the engine rejected this diagram source", error);
							setTree(void 0);
						}
					}
				}, (error) => {
					if (!cancelled) {
						console.warn("dsh-mermaid: the engine chunk failed to load", error);
						setTree(void 0);
					}
				});
				return () => {
					cancelled = true;
				};
			}, [source]);
			return tree;
		}
		/** The diagram frame: the engine's own SVG is width-responsive inside it. */
		const FRAME_STYLE = { maxWidth: "100%" };
		/**
		* The diagram this card draws itself, with the source as its code fallback.
		* @param props.source - the bare diagram source.
		* @param props.copyLabel - localized copy action of the fallback fence.
		* @param props.copiedLabel - localized copied confirmation of the fallback fence.
		* @returns the drawn diagram, or the fence while the engine loads or fails.
		*/
		function DiagramView({ source, copyLabel, copiedLabel }) {
			const tree = useDiagram(source);
			if (tree === null || tree === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.CodeBlock, {
				code: `${source}\n`,
				lang: "mermaid",
				copyLabel,
				copiedLabel
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: FRAME_STYLE,
				children: tree
			});
		}
		//#endregion
		//#region src/client/MermaidCard.tsx
		/** Fence the shared Markdown renderer consumes. */
		const FENCE = "```mermaid";
		/** The id the client's own fence renderer mints for a settled diagram. */
		const DIAGRAM_SELECTOR = "svg[id^=\"dsh-mermaid-\"]";
		/** How long the client's fence renderer gets to settle a diagram before the card draws it. */
		const CLIENT_DRAW_GRACE_MS = 1200;
		/**
		* Whether the surrounding client draws Mermaid fences, once some card has seen
		* one settle. Undefined until then, so the first card pays the grace period and
		* every later card reuses the verdict.
		*/
		let clientDrawsFences;
		/**
		* Debug switch, read when this plugin loads: `'card'` pins the card's own
		* renderer, `'client'` pins the surrounding client's fence renderer, and
		* anything else leaves the card to observe which one draws.
		*/
		const PINNED_RENDERER = globalThis.__DSH_MERMAID_RENDERER__;
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
		* The bare diagram source: `presentationMeta.source` when the host published
		* it, otherwise the result text with its own ```mermaid fence removed.
		*/
		function bareSource(node) {
			const meta = metaSource(node);
			if (meta !== null) return meta;
			const text = resultText(node);
			if (text === null) return null;
			const fenced = /^```mermaid\r?\n([\s\S]*?)\r?\n?```$/.exec(text.trim());
			return fenced === null ? text : fenced[1];
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
			const source = bareSource(props.block);
			if (source === null) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Diagram, {
				source,
				labels,
				copyLabel: t("copy"),
				copiedLabel: t("copied")
			});
		}
		/**
		* Draw one diagram, preferring the client's own fence renderer.
		* @param props.source - the bare diagram source.
		* @param props.labels - localized chrome the client's Markdown renderer consumes.
		* @param props.copyLabel - localized copy action of the card's code fallback.
		* @param props.copiedLabel - localized copied confirmation of the card's code fallback.
		* @returns the client's diagram, or the diagram this card draws itself.
		*/
		function Diagram({ source, labels, copyLabel, copiedLabel }) {
			const hostRef = (0, react.useRef)(null);
			const [draws, setDraws] = (0, react.useState)(PINNED_RENDERER !== "card" && clientDrawsFences !== false);
			(0, react.useEffect)(() => {
				if (!draws || PINNED_RENDERER !== void 0) return;
				const timer = window.setTimeout(() => {
					const diagram = hostRef.current?.querySelector(DIAGRAM_SELECTOR) ?? null;
					clientDrawsFences = diagram !== null;
					if (diagram === null) setDraws(false);
				}, CLIENT_DRAW_GRACE_MS);
				return () => {
					window.clearTimeout(timer);
				};
			}, [draws, source]);
			if (!draws) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DiagramView, {
				source,
				copyLabel,
				copiedLabel
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				ref: hostRef,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MarkdownText, {
					text: `${FENCE}\n${source.trimEnd()}\n\`\`\``,
					labels
				})
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
