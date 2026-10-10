# dsh-mermaid

Model-facing Mermaid diagrams for DeepSeek Harness: a `mermaid_render` tool plus a tool card that draws the settled diagram in the transcript.

## Install

```sh
dsh plugin --profile web add github:Preference-cmd/dsh-mermaid
```

Restart the profile afterwards. The package ships built artifacts, so pnpm needs no build permission.

## What it contributes

- **Host**: the `mermaid_render` tool (no parser, no headless browser). It rejects an empty diagram, returns the source unchanged as a fenced `mermaid` block, and publishes `output.presentationMeta = { source }` for replay-stable cards.
- **Browser**: a keyed `tool.call.toolview` card for `mermaid_render`. It first hands the source to the shared `MarkdownText` renderer, so a client with Mermaid fence support draws the diagram and lends its own zoom/pan viewport.
- **Browser, fallback**: a client that renders ```mermaid fences as ordinary code blocks — upstream DSH does — gets the diagram from the card's own renderer instead. The engine travels as the package-local `lib/client.mermaid.js` chunk (~3.5 MB, inlined and minified) and is fetched through the client module system's `require.async` only when the first diagram is drawn; it never enters the page bundle. Assembled SVG reaches React as elements, never as markup: the engine sanitizes at `securityLevel: 'strict'`, the DOM-to-React mapping drops every `on*` attribute and `javascript:` URL, and nothing reaches `dangerouslySetInnerHTML`.

## Known limitations

- The card's own renderer fits the diagram to the transcript column. The zoom/pan viewport belongs to the client's fence renderer; where that renderer exists the card keeps using it, and the fallback does not reimplement it.
- The engine chunk inlines Mermaid's own per-diagram splitting: the client module system materializes a package-local chunk as one closure, so a chunk-to-chunk synchronous require cannot be answered.
- The card never regresses: while the engine loads, or when it fails, the result keeps the code-block rendering the fence already had.
- Assistant-authored ```mermaid fences are outside this plugin: they render only where the client's Markdown renderer supports them. Making that renderer part of DSH core is the only path that covers every client without shipping an engine per plugin.
- Debug switch: set `window.__DSH_MERMAID_RENDERER__ = 'card'` (or `'client'`) before the page boots to pin which renderer draws.
- Reference: [DeepSeek Harness plugin tutorial](https://deepseek-harness.github.io/deepseek-harness/develop/basic/publish).
