# dsh-mermaid

Model-facing Mermaid diagrams for DeepSeek Harness: a `mermaid_render` tool plus a tool card that draws the settled diagram in the transcript.

## Install

```sh
dsh plugin --profile web add github:<owner>/dsh-mermaid
```

Restart the profile afterwards. The package ships built artifacts, so pnpm needs no build permission.

## What it contributes

- **Host**: the `mermaid_render` tool (`packages`-free, no parser, no headless browser). It rejects an empty diagram, returns the source unchanged as a fenced `mermaid` block, and publishes `output.presentationMeta = { source }` for replay-stable cards.
- **Browser**: a keyed `tool.call.toolview` card for `mermaid_render`. It hands the source to the shared `MarkdownText` renderer, so the diagram is drawn by the client's Mermaid fence support, including its zoom/pan viewport where the client provides one.

## Known limitations

- The card draws through the client's Markdown renderer. A client without Mermaid fence support falls back to the code block the generic tool row already shows; it never regresses.
- Assistant-authored ```mermaid fences render only where the client's Markdown renderer supports them.
- Reference: [DeepSeek Harness plugin tutorial](https://deepseek-harness.github.io/deepseek-harness/develop/basic/publish).
