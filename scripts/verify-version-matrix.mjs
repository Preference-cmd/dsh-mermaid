/**
 * Typecheck the plugin source against every published harness release line.
 *
 * The README claims the plugin source compiles from 0.2.1-alpha.2 through
 * 0.2.2-rc.1. This check makes that claim mechanical: for each published
 * version it pins the direct devDependencies to it, lets the harness packages
 * pull their own pinned peers, and runs the typecheck against the real
 * published types. The override covers only the packages the plugin develops
 * against directly, so each candidate stays one coherent release line.
 *
 * The plugin's own manifest and lockfile are restored afterwards, so a run
 * leaves the checkout as it found it.
 *
 * The check also asserts that the plugin's own peer ranges admit each
 * candidate. A peer range that rejects a host the plugin claims to support
 * makes the plugin uninstallable there, and the typecheck alone cannot see
 * it: the root project's peer dependencies are not resolved against its own
 * installed packages.
 *
 * Run with `node scripts/verify-version-matrix.mjs`; set DSH_MATRIX_ONLY to a
 * version to check a single candidate.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import semver from 'semver'

const root = resolve(import.meta.dirname, '..')

/** The peer ranges the plugin declares, read from its own manifest. */
const peers = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).peerDependencies

/**
 * The harness release after the supported 0.2 line. The peer range must stop
 * at it: a 0.x package's API can break between minors.
 */
const NEXT_MINOR = '0.3.0'

/** The published harness versions the plugin supports, with the Cordis release each one requires. */
const VERSIONS = [
  ['0.2.1-alpha.2', '4.0.5-alpha.1'],
  ['0.2.1-alpha.3', '4.0.5-alpha.2'],
  ['0.2.1-alpha.4', '4.0.5-alpha.2'],
  ['0.2.1-alpha.5', '4.0.5-alpha.2'],
  ['0.2.1-rc.1', '4.0.5'],
  ['0.2.1-rc.2', '4.0.5'],
  ['0.2.1-rc.3', '4.0.5'],
  ['0.2.1-rc.4', '4.0.5'],
  ['0.2.1-rc.5', '4.0.5'],
  ['0.2.2-alpha.2', '4.0.6-alpha.1'],
  ['0.2.2-alpha.3', '4.0.6-alpha.2'],
  ['0.2.2-rc.1', '4.1.0'],
]

/** The packages the plugin develops against; the harness packages pin their own peers. */
const OVERRIDDEN = [
  '@deepseek-ai/dsh-client-locale',
  '@deepseek-ai/dsh-client-ui-chat',
  '@deepseek-ai/dsh-client-ui-conversation',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-renderer',
  '@deepseek-ai/dsh-client-ui-sidebar-right',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-tool',
  '@deepseek-ai/dsh-session',
  '@deepseek-ai/dsh-tools',
]

const workspacePath = resolve(root, 'pnpm-workspace.yaml')
const lockPath = resolve(root, 'pnpm-lock.yaml')
const tscPath = resolve(root, 'node_modules/typescript/bin/tsc')

/**
 * Read the minimumReleaseAgeExclude entries a workspace file lists.
 * @param {string} text - The workspace file's content.
 * @returns {string[]} The entries, verbatim with their quotes.
 */
function excludeEntries(text) {
  const lines = text.split('\n')
  const start = lines.findIndex(line => line.startsWith('minimumReleaseAgeExclude:'))
  if (start === -1) return []
  const entries = []
  for (const line of lines.slice(start + 1)) {
    const match = /^ {2}- (.+)$/.exec(line)
    if (match === null) break
    entries.push(match[1])
  }
  return entries
}

/**
 * Write the workspace file with one candidate version pinned.
 * @param {string} dsh - The harness release to pin the plugin's dependencies to.
 * @param {string} cordis - The Cordis release that harness line requires.
 * @param {string[]} exclude - The minimumReleaseAgeExclude entries to carry over.
 */
function writeWorkspace(dsh, cordis, exclude) {
  const lines = ['packages: []', 'overrides:']
  for (const pkg of OVERRIDDEN) lines.push(`  '${pkg}': '${dsh}'`)
  lines.push(`  '@deepseek-ai/cordis': '${cordis}'`)
  lines.push('minimumReleaseAgeExclude:')
  for (const entry of exclude) lines.push(`  - ${entry}`)
  writeFileSync(workspacePath, `${lines.join('\n')}\n`)
}

/**
 * Report whether the declared peer ranges admit a harness release.
 * @param {string} dsh - The harness release.
 * @param {string} cordis - The Cordis release that harness line requires.
 * @returns {string|null} The conflicts, or null when the ranges admit it.
 */
function peerConflict(dsh, cordis) {
  const problems = []
  if (!semver.satisfies(dsh, peers['@deepseek-ai/dsh-tools'])) {
    problems.push(`the @deepseek-ai/dsh-tools peer range "${peers['@deepseek-ai/dsh-tools']}" rejects ${dsh}`)
  }
  if (!semver.satisfies(cordis, peers['@deepseek-ai/cordis'])) {
    problems.push(`the @deepseek-ai/cordis peer range "${peers['@deepseek-ai/cordis']}" rejects ${cordis}`)
  }
  return problems.length === 0 ? null : problems.join('\n')
}

/**
 * Run the typecheck against the installed harness packages.
 * @returns {string} The compiler output, empty when the check passed.
 */
function typecheck() {
  try {
    execFileSync(process.execPath, [tscPath, '-p', 'tsconfig.json', '--noEmit'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return ''
  } catch (error) {
    return `${error.stdout ?? ''}${error.stderr ?? ''}`
  }
}

const only = process.env['DSH_MATRIX_ONLY']
const candidates = only === undefined ? VERSIONS : VERSIONS.filter(([dsh]) => dsh === only)
if (candidates.length === 0) {
  console.error(`verify-version-matrix: no candidate matches DSH_MATRIX_ONLY=${only}`)
  process.exit(1)
}

const originalWorkspace = readFileSync(workspacePath, 'utf8')
const originalLock = readFileSync(lockPath, 'utf8')
const results = []

// The range has to stop at the next minor: a 0.x package's API can break
// between minors, and an unbounded range would admit hosts the plugin never
// met.
const boundary = semver.satisfies(NEXT_MINOR, peers['@deepseek-ai/dsh-tools'])
  ? `the @deepseek-ai/dsh-tools peer range "${peers['@deepseek-ai/dsh-tools']}" admits ${NEXT_MINOR}`
  : null

try {
  let exclude = excludeEntries(originalWorkspace)
  for (const [dsh, cordis] of candidates) {
    writeWorkspace(dsh, cordis, exclude)
    const conflict = peerConflict(dsh, cordis)
    if (conflict !== null) {
      results.push({ dsh, cordis, outcome: 'peer range rejects the candidate', detail: conflict })
      continue
    }
    try {
      // The overrides make the lockfile stale by construction, so the frozen
      // install pnpm turns on under CI has to be turned off explicitly.
      execFileSync('pnpm', ['install', '--no-frozen-lockfile', '--reporter=append-only'], { cwd: root, stdio: 'inherit' })
    } catch (error) {
      results.push({ dsh, cordis, outcome: 'install failed', detail: String(error) })
      continue
    }
    // pnpm admits a package that the release-age policy would block by adding
    // it to the exclude list; carry that forward for the next candidate.
    exclude = excludeEntries(readFileSync(workspacePath, 'utf8'))
    const output = typecheck()
    results.push({
      dsh,
      cordis,
      outcome: output === '' ? 'typecheck passed' : 'typecheck failed',
      detail: output,
    })
  }
} finally {
  writeFileSync(workspacePath, originalWorkspace)
  writeFileSync(lockPath, originalLock)
}

console.log('')
console.log('| DeepSeek Harness | Cordis | Result |')
console.log('| --- | --- | --- |')
for (const result of results) {
  console.log(`| ${result.dsh} | ${result.cordis} | ${result.outcome} |`)
}
const failures = results.filter(result => result.outcome !== 'typecheck passed')
if (boundary !== null) failures.push({ dsh: NEXT_MINOR, cordis: '-', outcome: 'peer range is unbounded', detail: boundary })
if (failures.length > 0) {
  console.error('')
  for (const failure of failures) {
    console.error(`verify-version-matrix: ${failure.dsh} — ${failure.outcome}`)
    console.error(failure.detail)
  }
  process.exit(1)
}
console.log(`verify-version-matrix: ${results.length} harness version(s) typecheck cleanly, and the peer ranges admit them.`)
