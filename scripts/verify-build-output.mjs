/**
 * Assert the committed build output matches a fresh build of the current source.
 *
 * The plugin ships its build output: `dsh plugin add github:Preference-cmd/dsh-mermaid`
 * fetches this repository, and `lib/` is the published artifact. A source change
 * that never reaches `lib/` therefore ships stale code, and nothing else in this
 * repository notices that.
 *
 * The bundler records every bundled module's resolved path in a `//#region`
 * comment. A dependency's path carries the package version and the pnpm
 * virtual-store hash, so it moves whenever the resolution moves even when the
 * bundled code is byte-identical. Those paths are normalized to their
 * package-relative form before comparing, so a dependency bump does not read as
 * a stale build while a real source change still does.
 *
 * Run after `pnpm run build`; exits non-zero and names the files that differ.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const outputDir = 'lib'

/** A dependency path in a region comment, with its version and store hash. */
const dependencyRegion = /^(\s*\/\/#region\s+)node_modules\/\.pnpm\/[^/]+\/node_modules\/(.*)$/gm

/**
 * Replace a dependency's resolved path with its package-relative form.
 * @param source - File text as the bundler wrote it.
 * @returns The same text with every dependency path normalized.
 */
function normalize(source) {
  return source.replace(dependencyRegion, '$1node_modules/$2')
}

/**
 * Run a git command in the repository root.
 * @param args - Arguments for git.
 * @returns The command's standard output.
 */
function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

/**
 * The output files this repository tracks.
 * @returns Repository-relative paths of the tracked build output.
 */
function trackedOutputs() {
  return git(['ls-files', '--', outputDir]).split('\n').filter(file => file !== '')
}

/**
 * The output files a build produced that the repository does not track.
 * @returns Repository-relative paths of the untracked build output.
 */
function untrackedOutputs() {
  return git(['status', '--porcelain', '--', outputDir])
    .split('\n')
    .filter(line => line.startsWith('?? '))
    .map(line => line.slice(3).trim())
    .filter(file => file !== '')
}

const tracked = trackedOutputs()
const stale = []
const untracked = untrackedOutputs()

for (const file of tracked) {
  const committed = normalize(git(['show', `HEAD:${file}`]))
  let built
  try {
    built = normalize(readFileSync(resolve(root, file), 'utf8'))
  } catch {
    stale.push(`${file} — the build did not produce it`)
    continue
  }
  if (committed !== built) stale.push(`${file} — the committed output differs from a fresh build`)
}

if (stale.length > 0 || untracked.length > 0) {
  for (const file of stale) console.error(`stale build output: ${file}`)
  for (const file of untracked) console.error(`uncommitted build output: ${file}`)
  console.error('\nRun `pnpm run build` and commit the result.')
  process.exit(1)
}

console.log(`verify-build-output: ${tracked.length} committed file(s) match a fresh build.`)
