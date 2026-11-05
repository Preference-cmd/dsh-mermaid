// Web e2e against a stock upstream harness: the plugin draws a settled
// `mermaid_render` result as a real diagram, opens it in the right-Sidebar
// viewer, and lists it at the turn tail. Zero model calls: the scenario seeds
// a recorded session.
//
// This file lives in the plugin repository but runs inside a harness
// checkout, beside the harness's own web tests: the plugin must be staged at
// plugins/dsh-mermaid, because that is where the scenario looks for it. The
// workflow .github/workflows/host-compatibility.yml does both and runs this
// file against a pinned upstream release.
//
// Upstream has no built-in Mermaid fence renderer, so the plugin's own
// engine draws the diagram and the plain assistant fence stays a code
// block. That is the standalone value proposition this lane pins.
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Browser, Page } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it, onTestFailed } from 'vitest'
import { ToolCallId, createAssistantMessage, createToolResultMessage, createUserMessage } from '@deepseek-ai/dsh-llm'
import { SESSION_FORMAT_VERSION, Session, SessionId } from '@deepseek-ai/dsh-session'
import { launchWebScaffold, seedSession, watchConsole, type WebScaffold } from './scaffold.ts'
import { expandTurnProcesses, newEnglishPage, saveFailureShot } from './support.ts'

/** The plugin checkout under test; installed into the scaffold profile as a bundle. */
const PLUGIN_DIR = fileURLToPath(new URL('../../../plugins/dsh-mermaid/', import.meta.url))
const SEED_ID = 'mermaid-plugin-web-e2e'
const DONE = 'MERMAID_PLUGIN_DONE'
const SOURCE = 'flowchart TD\n    A[User] --> B[Dashboard]'
const FENCE_SOURCE = 'flowchart LR\n    F[FenceNode] --> G[Goal]'

/** Seed one settled `mermaid_render` call plus an independent assistant fence. */
function mermaidToolFixture(): string {
  const session = Session.create(SessionId('mermaid-plugin-source'))
  session.append('turn/start', { turn: 1 })
  session.append('user/message', createUserMessage({
    content: [{ type: 'text', text: 'Draw the flow.' }],
    source: { kind: 'user' },
  }), { surfaceOp: 'append' })
  session.append('step/start', { turn: 1, step: 1 })
  const callId = ToolCallId('mermaid-tool-1')
  const args = JSON.stringify({ diagram: SOURCE })
  session.append('assistant/message', {
    stream: [],
    turn: 1,
    step: 1,
    message: createAssistantMessage({
      content: [{ type: 'tool-call', id: callId, name: 'mermaid_render', arguments: args }],
      source: { provider: 'fixture', model: 'fixture' },
    }),
  }, { surfaceOp: 'append' })
  const call = session.append('tool/call', {
    turn: 1,
    step: 1,
    callId,
    name: 'mermaid_render',
    arguments: args,
  })
  session.append('tool/result', {
    turn: 1,
    step: 1,
    meta: { source: SOURCE, title: 'Install flow' },
    message: createToolResultMessage({
      callId,
      content: [{ type: 'text', text: `\`\`\`mermaid\n${SOURCE}\n\`\`\`` }],
      isError: false,
    }),
  }, { surfaceOp: 'append', sourceEventSeqs: [call.seq] })
  session.append('step/end', { turn: 1, step: 1 })
  session.append('step/start', { turn: 1, step: 2 })
  session.append('assistant/message', {
    stream: [],
    turn: 1,
    step: 2,
    message: createAssistantMessage({
      content: [{ type: 'text', text: `\n\n\`\`\`mermaid\n${FENCE_SOURCE}\n\`\`\`\n\n${DONE}` }],
      source: { provider: 'fixture', model: 'fixture' },
    }),
  }, { surfaceOp: 'append' })
  session.append('step/end', { turn: 1, step: 2 })
  session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })

  return [
    JSON.stringify({
      type: 'session',
      version: SESSION_FORMAT_VERSION,
      id: '{{sessionId}}',
      createdAt: 0,
      cwd: '{{cwd}}',
      isSeeded: false,
      delegationDepth: 0,
    }),
    ...session.snapshotEvents().map(event => JSON.stringify(event)),
    '',
  ].join('\n')
}

describe('web e2e: dsh-mermaid plugin on a stock upstream client', () => {
  let scaffold: WebScaffold
  let browser: Browser
  let page: Page
  let tripwire: ReturnType<typeof watchConsole>

  beforeAll(async () => {
    scaffold = await launchWebScaffold({
      profile: { packages: [{ dir: PLUGIN_DIR, enabled: true }] },
    })
    await seedSession(scaffold, mermaidToolFixture(), SEED_ID)
    browser = await chromium.launch()
    page = await newEnglishPage(browser)
    tripwire = watchConsole(page)
    await page.goto(scaffold.authenticatedUrl, { waitUntil: 'load' })
    await page.locator('[role="treeitem"]').first().click()
    await page.locator('[role="treeitem"]').nth(1).click()
    await page.getByText(DONE, { exact: true }).waitFor({ timeout: 30_000 })
    await expandTurnProcesses(page)
  }, 120_000)

  afterAll(async () => {
    try { await browser?.close() } finally { await scaffold?.close() }
  })

  /** Open every collapsed disclosure between the transcript and the tool card. */
  async function openToolGroup(target: Page): Promise<void> {
    for (let pass = 0; pass < 6; pass++) {
      const collapsed = target.locator('[data-process-activity][aria-expanded="false"], [data-expandable][aria-expanded="false"]')
      const count = await collapsed.count()
      if (count === 0) return
      for (let index = 0; index < count; index++) {
        await collapsed.nth(index).click({ timeout: 2_000 }).catch(() => undefined)
      }
    }
  }

  it.skipIf(!existsSync(PLUGIN_DIR))('draws the tool result with the plugin’s own engine', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-mermaid-plugin-card'))
    await openToolGroup(page)
    // The stock client has no Mermaid fence support, so the card falls back to
    // its own engine chunk and draws the settled result itself.
    await expect.poll(() => page.getByText('Dashboard', { exact: true }).count(), { timeout: 30_000 }).toBeGreaterThan(0)
    await expect.poll(() => page.locator('svg[id^="dsh-mermaid-"]').count(), { timeout: 30_000 }).toBe(1)
    // The plain assistant fence stays a code block: upstream renders no
    // diagram for it, which is the gap this plugin fills.
    expect(await page.locator('pre code').filter({ hasText: 'FenceNode' }).count()).toBeGreaterThan(0)
    expect(await page.locator('[class*="mermaidFrame"]').count()).toBe(0)
    expect(tripwire.pageErrors).toEqual([])
    expect(tripwire.warnings).toEqual([])
  }, 90_000)

  it.skipIf(!existsSync(PLUGIN_DIR))('opens the diagram in the right-Sidebar viewer', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-mermaid-plugin-viewer'))
    await openToolGroup(page)
    await page.getByRole('button', { name: 'Open in viewer' }).first().click()
    // The viewer tab mounts its own zoom/pan surface and draws the diagram on
    // it; reopening the same call focuses the tab instead of stacking another.
    const surface = page.locator('[aria-label="Mermaid diagram"]')
    await expect.poll(() => surface.count(), { timeout: 30_000 }).toBe(1)
    await expect.poll(() => surface.locator('svg').count(), { timeout: 45_000 }).toBe(1)
    await page.getByRole('button', { name: 'Open in viewer' }).first().click()
    await expect.poll(() => surface.count(), { timeout: 10_000 }).toBe(1)
    expect(tripwire.pageErrors).toEqual([])
  }, 120_000)

  it.skipIf(!existsSync(PLUGIN_DIR))('lists the settled diagram at the turn tail', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-mermaid-plugin-tail'))
    // The tail row comes from the definition's replay of the recorded call and
    // result; it renders after the closing message without expanding anything,
    // named by the host-persisted diagram title.
    const tail = page.locator('[data-dsh-mermaid-tail]')
    await expect.poll(() => tail.count(), { timeout: 30_000 }).toBe(1)
    expect(await tail.getByText('Install flow', { exact: true }).count()).toBe(1)
    expect(await tail.locator('button').count()).toBe(1)
    await tail.getByRole('button', { name: 'Open in viewer' }).click()
    const surface = page.locator('[aria-label="Mermaid diagram"]')
    await expect.poll(() => surface.count(), { timeout: 30_000 }).toBe(1)
    expect(tripwire.pageErrors).toEqual([])
  }, 120_000)
})
