import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname, relative } from 'node:path';
import { skillText, customInstructionsText } from './core.mjs';

const START = '<!-- plain-language-default:start -->';
const END = '<!-- plain-language-default:end -->';
const TARGETS = ['agents', 'claude', 'cursor'];

function appendOrUpdateBlock(current, block) {
  const start = current.indexOf(START);
  const end = current.indexOf(END);
  if ((start >= 0) !== (end >= 0)) {
    throw new Error('Found an incomplete plain-language-default instruction block. Repair it manually.');
  }
  if (start >= 0) {
    if (end < start) throw new Error('Invalid instruction block order. Repair it manually.');
    return current.slice(0, start) + block + current.slice(end + END.length);
  }
  return (current.trimEnd() ? `${current.trimEnd()}\n\n` : '') + `${block}\n`;
}

async function readIfExists(path) {
  try { return await readFile(path, 'utf8'); }
  catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}

function instructionsBlock(skillFile) {
  return `${START}\n## Write in plain language\n\nBefore every user-facing response, follow \`${skillFile}\` as the default writing standard. Answer directly; use familiar words, active voice, and clear paragraphs. Do not repeat the user's input or add filler, invented jargon, or ornamental formatting. Preserve technical accuracy, sources, and user-requested formats. Quietly apply the checks in the skill before sending.\n${END}`;
}

function cursorRule() {
  return `---\ndescription: Default federal plain-language prose standard for all responses\nalwaysApply: true\n---\n\n${customInstructionsText()}\n\nFull skill: \`.cursor/skills/plain-language-default/SKILL.md\`.\n`;
}

export async function install({ directory = process.cwd(), target = 'all', force = false, dryRun = false, withInstructions = true } = {}) {
  if (!['all', ...TARGETS, 'codex'].includes(target)) {
    throw new Error(`Unknown target “${target}”. Choose all, agents, codex, claude, or cursor.`);
  }
  const selected = target === 'all' ? TARGETS : [target === 'codex' ? 'agents' : target];
  const changes = [];

  const save = async (path, content, policy = 'managed') => {
    const existing = await readIfExists(path);
    if (existing === content) { changes.push({ path: relative(directory, path), action: 'unchanged' }); return; }
    if (policy === 'safe-skill' && existing !== null && !force) {
      changes.push({ path: relative(directory, path), action: 'skipped: existing file differs (use --force)' });
      return;
    }
    changes.push({ path: relative(directory, path), action: existing === null ? 'created' : 'updated' });
    if (!dryRun) {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content, 'utf8');
    }
  };

  for (const name of selected) {
    const skillDir = name === 'agents' ? '.agents' : `.${name}`;
    const skillPath = `${skillDir}/skills/plain-language-default/SKILL.md`;
    await save(join(directory, skillPath), skillText(), 'safe-skill');

    if (!withInstructions) continue;
    if (name === 'cursor') {
      await save(join(directory, '.cursor/rules/plain-language-default.mdc'), cursorRule(), 'safe-skill');
    } else {
      const file = name === 'agents' ? 'AGENTS.md' : 'CLAUDE.md';
      const path = join(directory, file);
      const old = (await readIfExists(path)) ?? '';
      const next = appendOrUpdateBlock(old, instructionsBlock(skillPath));
      await save(path, next);
    }
  }
  return changes;
}
