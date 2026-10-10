/**
 * Self-contained build for both faces of the plugin.
 *
 * The browser face is the DSH client closure factory: a CJS bundle wrapped in
 * `window.__ModuleLoader__.load({ id, factory })`, resolving shared values
 * through the injected `require` (the shell's module table). This is a
 * standalone copy of the in-repo `packages/client/tsdown.client.ts` preset,
 * which cannot be imported from outside the DSH workspace.
 */
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

export default defineConfig([
  {
    entry: ['src/index.ts'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    external: ['@deepseek-ai/dsh-tools', '@deepseek-ai/cordis'],
    dts: false,
    clean: false,
  },
  {
    entry: ['src/client/index.ts'],
    outDir: 'lib',
    format: ['cjs'],
    platform: 'browser',
    external: [...PLATFORM_MODULES],
    dts: false,
    clean: false,
    outputOptions: {
      entryFileNames: 'client.js',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
    },
  },
])
