import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { install } from '../src/installer.mjs';

async function temporaryTest(fn) {
  const folder = await mkdtemp(join(tmpdir(), 'plain-language-default-test-'));
  try { await fn(folder); } finally { await rm(folder, { recursive: true, force: true }); }
}

test('installs three targets with persistent project instructions', async () => {
  await temporaryTest(async (directory) => {
    await writeFile(join(directory, 'AGENTS.md'), '# Original agent notes\n');
    await install({ directory });
    const agentFile = await readFile(join(directory, 'AGENTS.md'), 'utf8');
    const claudeFile = await readFile(join(directory, 'CLAUDE.md'), 'utf8');
    const cursorRule = await readFile(join(directory, '.cursor/rules/plain-language-default.mdc'), 'utf8');
    assert.match(agentFile, /# Original agent notes/);
    assert.match(agentFile, /plain-language-default:start/);
    assert.match(claudeFile, /\.claude\/skills\/plain-language-default\/SKILL.md/);
    assert.match(cursorRule, /alwaysApply: true/);
    await install({ directory });
    const repeated = await readFile(join(directory, 'AGENTS.md'), 'utf8');
    assert.equal((repeated.match(/plain-language-default:start/g) || []).length, 1);
  });
});

test('dry run writes no files', async () => {
  await temporaryTest(async (directory) => {
    const changes = await install({ directory, target: 'claude', dryRun: true });
    assert.ok(changes.some((x) => x.action === 'created'));
    await assert.rejects(readFile(join(directory, 'CLAUDE.md')));
  });
});

test('protects an existing unrelated skill file unless forced', async () => {
  await temporaryTest(async (directory) => {
    const custom = join(directory, '.agents/skills/plain-language-default/SKILL.md');
    await mkdir(join(directory, '.agents/skills/plain-language-default'), { recursive: true });
    await writeFile(custom, 'Custom content\n');
    const first = await install({ directory, target: 'agents' });
    assert.ok(first.some((x) => x.action.startsWith('skipped:')));
    assert.equal(await readFile(custom, 'utf8'), 'Custom content\n');
    await install({ directory, target: 'agents', force: true });
    assert.match(await readFile(custom, 'utf8'), /plain-language-default/);
  });
});
