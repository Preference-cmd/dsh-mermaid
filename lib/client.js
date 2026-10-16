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
		//#region src/client/viewer.tsx
		/**
		* Name one diagram's viewer tab: the Session and the tool call it belongs to.
		* Two opens of one address are the same tab, so reopening a call's diagram
		* focuses the tab it already has.
		* @param sessionId - Session displaying the diagram.
		* @param callId - the settled `mermaid_render` invocation.
		* @returns the resource address for the viewer tab.
		*/
		function mermaidAddress(sessionId, callId) {
			return `dsh-resource://mermaid/${encodeURIComponent(sessionId)}/${encodeURIComponent(callId)}`;
		}
		/**
		* Recognize a viewer address without decoding it: the tab body reads its
		* document from navigation params, never from the address.
		* @param address - saved or caller-supplied navigation address.
		* @returns whether the address identifies a diagram viewer tab.
		*/
		function isMermaidAddress(address) {
			return /^dsh-resource:\/\/mermaid\/[^/?#]+\/[^/?#]+$/.test(address);
		}
		/**
		* Read the diagram's own title from its frontmatter block, when it carries one.
		* @param source - the bare diagram source.
		* @returns the frontmatter title, or undefined.
		*/
		function diagramTitle(source) {
			const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source.trim());
			if (frontmatter === null) return void 0;
			return /^title:\s*(\S[^\r\n]*)$/m.exec(frontmatter[1])?.[1]?.trim() || void 0;
		}
		/** Zoom bounds of the viewer surface, in multiples of the diagram's natural size. */
		const MIN_SCALE = .2;
		const MAX_SCALE = 6;
		/** Fallback natural size when the engine SVG carries no readable viewBox. */
		const FALLBACK_NATURAL = {
			w: 800,
			h: 600
		};
		/** The pan/zoom surface fills the tab body and owns its gestures. */
		const SURFACE_STYLE = {
			position: "relative",
			overflow: "hidden",
			width: "100%",
			height: "100%",
			minHeight: 240,
			boxSizing: "border-box",
			background: "var(--dsw-static-neutral-50, #f5f5f5)",
			touchAction: "none",
			userSelect: "none",
			cursor: "grab"
		};
		/** Full-bleed status lines (loading, engine failure, expired params). */
		const MESSAGE_STYLE = {
			boxSizing: "border-box",
			width: "100%",
			padding: 16,
			color: "var(--dsw-alias-label-secondary, #666)",
			font: "inherit"
		};
		/** The floating zoom toolbar in the surface's top-right corner. */
		const TOOLBAR_STYLE = {
			position: "absolute",
			top: 8,
			right: 8,
			zIndex: 1,
			display: "flex",
			gap: 4
		};
		/** One toolbar button; gestures on the surface skip it. */
		const BUTTON_STYLE$1 = {
			boxSizing: "border-box",
			minWidth: 26,
			height: 26,
			padding: "0 8px",
			border: "0.5px solid var(--dsw-alias-border-l1, #ccc)",
			borderRadius: 8,
			background: "var(--dsw-static-neutral-0, #fff)",
			color: "inherit",
			font: "inherit",
			fontSize: 12,
			cursor: "pointer"
		};
		/** Clamp a scale into the viewer's bounds. */
		function clampScale(k) {
			return Math.min(MAX_SCALE, Math.max(MIN_SCALE, k));
		}
		/**
		* The keyed `sidebar.right.pane.tab` body for `dsh-mermaid`: the document from
		* the tab's navigation params, drawn on the zoom/pan surface.
		*/
		function MermaidViewer({ useTabInfo, t }) {
			const params = useTabInfo().tab.navigation.params;
			const diagram = params !== void 0 && "diagram" in params ? params.diagram : void 0;
			if (diagram === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: MESSAGE_STYLE,
				role: "status",
				children: t("viewerExpired")
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ViewerSurface, {
				t,
				source: diagram.source
			});
		}
		/**
		* The tab chip's title for `dsh-mermaid`: the diagram's frontmatter title while
		* its params live, otherwise the title captured at open time.
		*/
		function MermaidViewerTitle({ useTabInfo }) {
			const tab = useTabInfo();
			const params = tab.tab.navigation.params;
			const diagram = params !== void 0 && "diagram" in params ? params.diagram : void 0;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: diagram?.title ?? tab.tab.title });
		}
		/**
		* Draw one diagram large: the engine's SVG normalized to its viewBox size, so
		* the pan/zoom transform has a stable natural size to scale.
		* @param props.t - localized chrome of the surface and its toolbar.
		* @param props.source - the bare diagram source.
		*/
		function ViewerSurface({ t, source }) {
			const tree = useDiagram(source);
			const surfaceRef = (0, react.useRef)(null);
			const [natural, setNatural] = (0, react.useState)(void 0);
			const [view, setView] = (0, react.useState)({
				x: 0,
				y: 0,
				k: 1
			});
			const dragRef = (0, react.useRef)(void 0);
			(0, react.useEffect)(() => {
				if (tree === null || tree === void 0) return;
				const svg = surfaceRef.current?.querySelector("svg") ?? null;
				if (svg === null) return;
				svg.style.maxWidth = "none";
				svg.style.width = "100%";
				svg.style.height = "100%";
				const box = /^[-0-9.]+\s+[-0-9.]+\s+([0-9.]+)\s+([0-9.]+)$/.exec(svg.getAttribute("viewBox") ?? "");
				const w = box === null ? NaN : Number(box[1]);
				const h = box === null ? NaN : Number(box[2]);
				setNatural(Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 ? {
					w,
					h
				} : FALLBACK_NATURAL);
			}, [tree]);
			/** Zoom by one multiplicative factor around a surface point. */
			const zoomAt = (0, react.useCallback)((factor, px, py) => {
				setView((v) => {
					const k = clampScale(v.k * factor);
					if (k === v.k) return v;
					const ratio = k / v.k;
					return {
						k,
						x: px - (px - v.x) * ratio,
						y: py - (py - v.y) * ratio
					};
				});
			}, []);
			(0, react.useEffect)(() => {
				const surface = surfaceRef.current;
				if (surface === null) return;
				const onWheel = (event) => {
					event.preventDefault();
					const rect = surface.getBoundingClientRect();
					zoomAt(Math.exp(-event.deltaY * .0015), event.clientX - rect.left, event.clientY - rect.top);
				};
				surface.addEventListener("wheel", onWheel, { passive: false });
				return () => {
					surface.removeEventListener("wheel", onWheel);
				};
			}, [zoomAt]);
			const onPointerDown = (event) => {
				if (event.target.closest("button") !== null) return;
				const surface = surfaceRef.current;
				if (surface === null) return;
				surface.setPointerCapture(event.pointerId);
				dragRef.current = {
					id: event.pointerId,
					x: event.clientX,
					y: event.clientY,
					view
				};
			};
			const onPointerMove = (event) => {
				const drag = dragRef.current;
				if (drag === void 0 || drag.id !== event.pointerId) return;
				setView({
					k: drag.view.k,
					x: drag.view.x + event.clientX - drag.x,
					y: drag.view.y + event.clientY - drag.y
				});
			};
			const onPointerUp = (event) => {
				if (dragRef.current?.id === event.pointerId) dragRef.current = void 0;
			};
			if (tree === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: MESSAGE_STYLE,
				role: "status",
				children: t("viewerLoading")
			});
			if (tree === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: MESSAGE_STYLE,
				role: "status",
				children: t("viewerFailed")
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				ref: surfaceRef,
				style: SURFACE_STYLE,
				"aria-label": t("viewerTitle"),
				onPointerDown,
				onPointerMove,
				onPointerUp,
				onPointerCancel: onPointerUp,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: TOOLBAR_STYLE,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							style: BUTTON_STYLE$1,
							"aria-label": t("zoomIn"),
							onClick: () => zoomAt(1.25, midX(surfaceRef.current), midY(surfaceRef.current)),
							children: "＋"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							style: BUTTON_STYLE$1,
							"aria-label": t("zoomOut"),
							onClick: () => zoomAt(.8, midX(surfaceRef.current), midY(surfaceRef.current)),
							children: "－"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							style: BUTTON_STYLE$1,
							onClick: () => setView({
								x: 0,
								y: 0,
								k: 1
							}),
							children: t("reset")
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: {
						position: "absolute",
						left: 0,
						top: 0,
						width: natural?.w,
						height: natural?.h,
						transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
						transformOrigin: "0 0"
					},
					children: tree
				})]
			});
		}
		/** The surface's horizontal center, or 0 before it mounts. */
		function midX(surface) {
			return surface === null ? 0 : surface.clientWidth / 2;
		}
		/** The surface's vertical center, or 0 before it mounts. */
		function midY(surface) {
			return surface === null ? 0 : surface.clientHeight / 2;
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
		* The settled document: `presentationMeta` (the host persists it under the
		* result node's `meta`) when it carries a source, otherwise the result text
		* with its own ```mermaid fence removed.
		*/
		function bareDocument(node) {
			const meta = metaSource(node.meta);
			if (meta !== null) return {
				source: meta,
				title: diagramTitle(meta)
			};
			const text = resultText(node);
			if (text === null) return null;
			const fenced = /^```mermaid\r?\n([\s\S]*?)\r?\n?```$/.exec(text.trim());
			const source = fenced === null ? text : fenced[1];
			return {
				source,
				title: diagramTitle(source)
			};
		}
		/**
		* Keyed `tool.call.toolview` card for `mermaid_render`: it hands the settled
		* fenced source to the shared Markdown renderer, whose Mermaid fence support
		* draws the diagram (and, where the client exposes it, the zoom viewport), and
		* offers the right-Sidebar viewer for a large pan/zoom surface.
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
			const document = bareDocument(props.block);
			if (document === null) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: VIEWER_ROW_STYLE,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					style: VIEWER_BUTTON_STYLE,
					onClick: () => props.openViewer(props.callId, document),
					children: t("openViewer")
				})
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Diagram, {
				source: document.source,
				labels,
				copyLabel: t("copy"),
				copiedLabel: t("copied")
			})] });
		}
		/** The card's viewer affordance hugs the diagram's top-right corner. */
		const VIEWER_ROW_STYLE = {
			display: "flex",
			justifyContent: "flex-end"
		};
		/** The viewer affordance stays quiet beside the diagram it opens. */
		const VIEWER_BUTTON_STYLE = {
			boxSizing: "border-box",
			height: 24,
			padding: "0 8px",
			border: "0.5px solid var(--dsw-alias-border-l1, #ccc)",
			borderRadius: 8,
			background: "transparent",
			color: "inherit",
			font: "inherit",
			fontSize: 12,
			cursor: "pointer"
		};
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
		//#region node_modules/.pnpm/@deepseek-ai+dsh-session@0.2.1-alpha.4_@deepseek-ai+cordis@4.0.5-alpha.1_@deepseek-ai+d_559e75d579d7e24c6903c120e1508d53/node_modules/@deepseek-ai/dsh-session/lib/types/surface.js
		/** Runtime counterpart of the message-producing event union. */
		const SURFACE_EVENT_TYPES = /* @__PURE__ */ new Set([
			"system/message",
			"developer/message",
			"user/message",
			"assistant/message",
			"tool/result"
		]);
		/**
		* Narrow an event to a surface-eligible event carrying its required marker.
		* @param event - event to test.
		* @returns true when both the type and marker identify a surface event.
		*/
		function isSurfaceEvent(event) {
			if (!SURFACE_EVENT_TYPES.has(event.type)) return false;
			return event.surfaceOp !== void 0;
		}
		/**
		* Narrow an event to an append-origin surface event: one that entered the
		* surface at its own log position and was never itself a replacement copy.
		*
		* The model-visible surface deliberately shadows replaced ranges, so it is the
		* wrong source for a human transcript — a landed replacement would erase
		* conversation the user already saw. Append-origin events are that transcript's
		* durable source material; replacement copies stay model-only.
		* @param event - event to test.
		* @returns true when the event appended to the surface tail.
		*/
		function isAppendSurfaceEvent(event) {
			return isSurfaceEvent(event) && event.surfaceOp === "append";
		}
		//#endregion
		//#region src/client/tail.tsx
		/**
		* The document of one settled result: the host's `presentationMeta` (source and
		* title) when present, otherwise the fenced block the tool returns as its text
		* with a source-level frontmatter title. Shared with the transcript card.
		* @param data - the recorded `tool/result` payload.
		* @returns the bare document, or null when the result carries no diagram.
		*/
		function resultDocument(data) {
			if (typeof data.meta === "object" && data.meta !== null) {
				const record = data.meta;
				const source = typeof record.source === "string" && record.source.trim().length > 0 ? record.source : null;
				if (source !== null) return {
					source,
					title: (typeof record.title === "string" && record.title.trim().length > 0 ? record.title.trim() : void 0) ?? diagramTitle(source)
				};
			}
			const text = data.message.content.filter((part) => part.type === "text" && typeof part.text === "string").map((part) => part.text).join("\n").trim();
			if (text.length === 0) return null;
			const fenced = /^```mermaid\r?\n([\s\S]*?)\r?\n?```$/.exec(text);
			const source = fenced === null ? text : fenced[1];
			return {
				source,
				title: diagramTitle(source)
			};
		}
		/**
		* Turn-scoped settled-diagram accumulator; it publishes no view Node.
		* Root calls only, matching the file-delivery Definition's scope: PTC
		* dispatch children do not enter independently.
		*/
		const mermaidTailDefinition = {
			kind: "mermaidDiagrams",
			match: (event) => {
				if (event.type !== "turn/start" && event.type !== "tool/call" && event.type !== "tool/result") return null;
				const turn = event.data?.turn;
				if (typeof turn !== "number") return null;
				if (event.type === "turn/start") return {
					id: String(turn),
					role: "start"
				};
				if (event.type === "tool/call") return {
					id: String(turn),
					role: "update"
				};
				return isAppendSurfaceEvent(event) ? {
					id: String(turn),
					role: "update"
				} : null;
			},
			start: (_context, match) => {
				if (match.event.type !== "turn/start") throw new Error("mermaid tail start requires turn/start");
				return {
					turn: match.event.data.turn,
					calls: /* @__PURE__ */ new Set(),
					diagrams: []
				};
			},
			update: (context, match) => {
				const event = match.event;
				if (event.type === "tool/call") {
					if (event.data.name !== "mermaid_render") return context.state;
					const calls = new Set(context.state.calls);
					calls.add(String(event.data.callId));
					return {
						...context.state,
						calls
					};
				}
				if (event.type !== "tool/result") return context.state;
				const callId = String(event.data.message.source.callId);
				if (!context.state.calls.has(callId) || event.data.message.isError === true) return context.state;
				const document = resultDocument(event.data);
				if (document === null || context.state.diagrams.some((entry) => entry.callId === callId)) return context.state;
				return {
					...context.state,
					diagrams: [...context.state.diagrams, {
						callId,
						...document
					}]
				};
			},
			buildLocationData: (context, scope, previous) => {
				if (scope !== "turn" || context.state === void 0) return null;
				const value = { diagrams: context.state.diagrams };
				if (previous?.kind === "turn" && previous.turn === context.state.turn && previous.key === "mermaidDiagrams" && previous.value.diagrams === context.state.diagrams) return previous;
				return {
					kind: "turn",
					turn: context.state.turn,
					key: "mermaidDiagrams",
					value
				};
			}
		};
		/** The tail lists its rows in a quiet bordered group. */
		const TAIL_STYLE = {
			boxSizing: "border-box",
			display: "flex",
			flexDirection: "column",
			gap: 6,
			width: "100%",
			padding: 8,
			border: "0.5px solid var(--dsw-alias-border-l1, #ccc)",
			borderRadius: "var(--dsw-radius-xl, 12px)"
		};
		/** One artifact-style row: the diagram's name, then its viewer affordance. */
		const ROW_STYLE = {
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			gap: 10,
			minWidth: 0
		};
		/** Row titles truncate instead of pushing the affordance out. */
		const LABEL_STYLE = {
			overflow: "hidden",
			minWidth: 0,
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
			fontSize: 13,
			fontWeight: 500
		};
		/** The row's viewer affordance. */
		const BUTTON_STYLE = {
			boxSizing: "border-box",
			flexShrink: 0,
			height: 24,
			padding: "0 8px",
			border: "0.5px solid var(--dsw-alias-border-l1, #ccc)",
			borderRadius: 8,
			background: "transparent",
			color: "inherit",
			font: "inherit",
			fontSize: 12,
			cursor: "pointer"
		};
		/**
		* The keyed `conversation.chat.turnTail` entry for `dsh-mermaid`: one row per
		* settled diagram, or nothing on turns that drew none.
		*/
		function MermaidDiagramsTail(props) {
			const diagrams = props.turn.data.get("mermaidDiagrams")?.diagrams ?? [];
			if (diagrams.length === 0) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: TAIL_STYLE,
				"data-dsh-mermaid-tail": "",
				children: diagrams.map((diagram) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: ROW_STYLE,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: LABEL_STYLE,
						children: diagram.title ?? props.t("viewerTitle")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						style: BUTTON_STYLE,
						onClick: () => props.openViewer(diagram.callId, {
							source: diagram.source,
							title: diagram.title
						}),
						children: props.t("openViewer")
					})]
				}, diagram.callId))
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
			reset: "复位",
			openViewer: "在视图中打开",
			viewerTitle: "Mermaid 图",
			viewerLoading: "正在加载渲染引擎",
			viewerFailed: "引擎无法绘制这张图；源码保留在转录卡片上。",
			viewerExpired: "此视图不保留图表内容；回到转录，从它的卡片重新打开。"
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
			reset: "Reset zoom",
			openViewer: "Open in viewer",
			viewerTitle: "Mermaid diagram",
			viewerLoading: "Loading the rendering engine",
			viewerFailed: "The engine could not draw this diagram; its source stays on the transcript card.",
			viewerExpired: "This view keeps no diagram content; reopen it from its transcript card."
		};
		//#endregion
		//#region src/client/index.ts
		const inject = [
			"slots",
			"locale",
			"uiConversation",
			"sidebarRight",
			"sidebarRightTabs"
		];
		/** The tab-type id; the key its body and title register under. */
		const VIEWER_ID = "dsh-mermaid";
		/**
		* The injected face both the card and the tail share: open one diagram's
		* viewer tab under the session it belongs to.
		* @param ctx - Browser plugin context with `sidebarRight` ready.
		* @param sessionId - Session whose transcript displays the diagram.
		* @returns the injected `openViewer` action.
		*/
		function openViewerInject(ctx, sessionId) {
			return { openViewer: (callId, document) => {
				ctx.sidebarRight.openResource(mermaidAddress(sessionId, callId), { params: { diagram: document } });
			} };
		}
		/** Register this plugin's dictionaries, viewer tab, turn tail, and keyed tool card.
		* @param ctx - Browser plugin context; the injected services are ready because of {@link inject}.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-mermaid: dictionaries");
			const t = ctx.locale.bind(NS);
			ctx.effect(() => ctx.uiConversation.events.register(mermaidTailDefinition), "dsh-mermaid: conversation definition");
			ctx.effect(() => ctx.sidebarRightTabs.register({
				id: VIEWER_ID,
				kind: "mermaid",
				patterns: ["dsh-resource://mermaid/**"],
				canOpen: isMermaidAddress,
				title: () => t("viewerTitle")
			}), "dsh-mermaid: sidebar tab type");
			ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
				name: "sidebar.right.pane.tab",
				key: VIEWER_ID,
				locale: NS
			}, MermaidViewer));
			ctx.slots.inject("sidebar.right.pane.tab.title", () => ctx.slots.register({
				name: "sidebar.right.pane.tab.title",
				key: VIEWER_ID
			}, MermaidViewerTitle));
			ctx.slots.inject("conversation.chat.turnTail", () => ctx.slots.register({
				name: "conversation.chat.turnTail",
				id: VIEWER_ID,
				locale: NS,
				inject: (sessionId) => openViewerInject(ctx, sessionId)
			}, MermaidDiagramsTail));
			ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
				name: "tool.call.toolview",
				key: "mermaid_render",
				locale: NS,
				inject: (sessionId) => openViewerInject(ctx, sessionId)
			}, MermaidCard));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
