/**
 * Self-contained build for both faces of the plugin.
 *
 * The browser face is the DSH client closure factory: a CJS bundle wrapped in
 * `window.__ModuleLoader__.load({ id, factory })`, resolving shared values
 * through the injected `require` (the shell's module table). This is a
 * standalone copy of the in-repo `packages/client/tsdown.client.ts` preset,
 * which cannot be imported from outside the DSH workspace.
 *
 * Three builds land in `lib/`:
 * - `index.js` — the host half;
 * - `client.js` — the card, with the engine kept out of it;
 * - `client.mermaid.js` — the engine, fetched through `require.async` when the
 *   first diagram is drawn. It is one self-contained file because the module
 *   loader materializes a chunk as a single closure: a chunk-to-chunk
 *   synchronous `require` cannot be answered, so Mermaid's own diagram
 *   splitting is inlined here instead.
 */
import { stat, utimes } from 'node:fs/promises'
import { resolve } from 'node:path'
import { defineConfig } from 'tsdown'

/** Module-table specifiers every dynamic client bundle may require. */
const PLATFORM_MODULES = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
]

const ID = 'dsh-mermaid'

/** The engine chunk the card requests, and the file name it is published as. */
const ENGINE_CHUNK = 'client.mermaid.js'

/** Package-local chunk names the module loader accepts, as `chunkFileNames` emits them. */
const CHUNK_FILE = /^client\.[A-Za-z0-9][A-Za-z0-9._-]*\.js$/

/** The `__ModuleLoader__.load` registration every emitted file opens with. */
function registration(chunk: string | undefined): string {
  return `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, `
    + (chunk === undefined ? '' : `chunk: ${JSON.stringify(chunk)}, `)
    + 'factory: (require) => {'
}

/**
 * Point the card's engine import at the engine chunk, and keep the entry's
 * timestamp ahead of it.
 *
 * The module table answers only `require.async` for a package-local chunk, and
 * a chunk's URL carries the *entry's* revision, so a rebuilt engine with an
 * unchanged entry would be served from cache; the timestamp bump is the same
 * safeguard the in-repo preset applies.
 * @returns the Rolldown plugin carrying that rewrite.
 */
function clientBundle() {
  return {
    name: 'dsh-mermaid-client-bundle',
    renderChunk(
      code: string,
      chunk: { dynamicImports: readonly string[] },
      outputOptions: { format?: string },
    ): string | null {
      if (outputOptions.format !== 'cjs') return null
      let rewritten = code
      const request = `require.async(${JSON.stringify(`./${ENGINE_CHUNK}`)})`
      // An external dynamic import survives CJS output as `import("mermaid")`,
      // which the browser cannot resolve for a bare specifier; the module table
      // reaches the engine chunk only through `require.async`.
      for (const generated of ['import("mermaid")', "import('mermaid')", 'require("mermaid")', "require('mermaid')"]) {
        if (!rewritten.includes(generated)) continue
        rewritten = rewritten.split(generated).join(request)
      }
      if (rewritten.includes('"mermaid"') || rewritten.includes("'mermaid'")) {
        const external = /(?:import|require)\((['"])mermaid\1\)/.exec(rewritten)
        if (external !== null) {
          throw new Error(`dsh-mermaid client build: the engine is still requested as ${external[0]}`)
        }
      }
      for (const dynamicImport of chunk.dynamicImports) {
        const fileName = dynamicImport.startsWith('./') ? dynamicImport.slice(2) : dynamicImport
        if (!CHUNK_FILE.test(fileName)) continue
        const specifier = `./${fileName}`
        const hit = [`require(${JSON.stringify(specifier)})`, `require('${specifier}')`]
          .find(call => rewritten.includes(call))
        if (hit === undefined) {
          throw new Error(`dsh-mermaid client build: chunk ${JSON.stringify(fileName)} has no generated require expression`)
        }
        rewritten = rewritten.split(hit).join(`require.async(${JSON.stringify(specifier)})`)
      }
      if (rewritten.includes('require("./client.') || rewritten.includes("require('./client.")) {
        throw new Error('dsh-mermaid client build: a package-local chunk was required synchronously')
      }
      return rewritten === code ? null : rewritten
    },
    async writeBundle(): Promise<void> {
      const entry = resolve('lib/client.js')
      const current = await stat(entry)
      await utimes(entry, current.atime, new Date(Math.max(Date.now(), current.mtimeMs + 1)))
    },
  }
}

export default defineConfig([
  {
    entry: ['src/index.ts'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    deps: { neverBundle: ['@deepseek-ai/dsh-tools', '@deepseek-ai/cordis'] },
    dts: false,
    clean: false,
    outputOptions: {
      entryFileNames: 'index.js',
    },
  },
  {
    entry: ['src/client/index.ts'],
    outDir: 'lib',
    format: ['cjs'],
    platform: 'browser',
    // The engine travels as its own chunk, so this face keeps it external and
    // requests it through the module table.
    deps: { neverBundle: [...PLATFORM_MODULES, 'mermaid'] },
    dts: false,
    clean: false,
    plugins: [clientBundle()],
    outputOptions: {
      entryFileNames: 'client.js',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
      banner: (chunk: { fileName: string; isEntry: boolean }): string =>
        registration(chunk.isEntry ? undefined : chunk.fileName),
      footer: 'return module.exports; } });',
    },
  },
  {
    entry: { 'client.mermaid': 'src/client/engine.ts' },
    outDir: 'lib',
    format: ['cjs'],
    platform: 'browser',
    deps: { neverBundle: [...PLATFORM_MODULES] },
    dts: false,
    clean: false,
    minify: true,
    outputOptions: {
      entryFileNames: ENGINE_CHUNK,
      // One closure, so Mermaid's own dynamic imports cannot become sibling chunks.
      inlineDynamicImports: true,
      // Keep the ESM shape the importing source asks for: the card reads
      // `module.default`, and CJS auto-export would collapse the API onto
      // `module.exports` itself.
      exports: 'named',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
      banner: registration(ENGINE_CHUNK),
      footer: 'return module.exports; } });',
    },
  },
])
