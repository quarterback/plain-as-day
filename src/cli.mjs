#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { install } from './installer.mjs';
import { skillText, customInstructionsText, reviewPlainLanguage } from './core.mjs';

const HELP = `plain-language-default — federal plain language for AI agents

Usage:
  plain-language-default install [--target all|agents|codex|claude|cursor] [--directory PATH] [--dry-run] [--force] [--no-instructions]
  plain-language-default instructions
  plain-language-default skill
  plain-language-default check [FILE|-] [--json] [--strict]
  plain-language-default mcp
  plain-language-default help

install         Copy SKILL.md and add persistent writing rules to the current project.
instructions    Print ready-to-paste ChatGPT Custom Instructions.
skill           Print the complete reusable SKILL.md.
check           Flag possible plain-language problems (heuristic, not certification).
mcp             Start the local MCP stdio server. No API key required.

Use --dry-run to see which project files would change before installing.
`;

function requireOptionValue(args, index, key) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${key}.`);
  return value;
}

async function inputFromStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function main(argv) {
  const [command = 'help', ...args] = argv;
  if (command === 'help' || command === '--help' || command === '-h') {
    process.stdout.write(HELP);
    return;
  }
  if (command === 'skill') {
    process.stdout.write(skillText());
    return;
  }
  if (command === 'instructions') {
    process.stdout.write(customInstructionsText());
    return;
  }
  if (command === 'mcp') {
    const { startMcpServer } = await import('./mcp.mjs');
    await startMcpServer();
    return;
  }
  if (command === 'install') {
    const options = { target: 'all', directory: process.cwd(), withInstructions: true, dryRun: false, force: false };
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--target') options.target = requireOptionValue(args, i++, '--target');
      else if (args[i] === '--directory') options.directory = resolve(requireOptionValue(args, i++, '--directory'));
      else if (args[i] === '--dry-run') options.dryRun = true;
      else if (args[i] === '--force') options.force = true;
      else if (args[i] === '--no-instructions') options.withInstructions = false;
      else throw new Error(`Unknown option ${args[i]}.`);
    }
    const changes = await install(options);
    for (const change of changes) {
      process.stdout.write(`${change.action}: ${change.path}\n`);
    }
    process.stdout.write(options.dryRun ? 'Dry run only; no files changed.\n' : 'Installed project rules. Restart the agent if it does not reload instructions automatically.\n');
    return;
  }
  if (command === 'check') {
    const flags = { json: false, strict: false };
    let file = '-';
    for (const arg of args) {
      if (arg === '--json') flags.json = true;
      else if (arg === '--strict') flags.strict = true;
      else if (file === '-') file = arg;
      else throw new Error(`Unexpected argument ${arg}.`);
    }
    const source = file === '-' ? await inputFromStdin() : await readFile(resolve(file), 'utf8');
    const report = reviewPlainLanguage(source);
    if (flags.json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      process.stdout.write(`Checked about ${report.wordsApprox} words. ${report.findings.length} possible problem(s).\n`);
      for (const finding of report.findings) {
        process.stdout.write(`- ${finding.kind}: ${finding.excerpt} — ${finding.suggestion}\n`);
      }
      process.stdout.write(`${report.note}\n`);
    }
    if (flags.strict && report.findings.length) process.exitCode = 1;
    return;
  }
  throw new Error(`Unknown command “${command}”. Run plain-language-default help.`);
}

main(process.argv.slice(2)).catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
