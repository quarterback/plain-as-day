#!/usr/bin/env node
import { createInterface } from 'node:readline';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  skillText, customInstructionsText, SHORT_RULES, SKILL_URI, INSTRUCTIONS_URI,
  reviewPlainLanguage, writingPrompt, rewritingPrompt,
} from './core.mjs';

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const name = 'plain-language-default';
const VERSION_CURRENT = '2026-07-28';
const VERSION_LEGACY = '2025-11-25';
const CAPABILITIES = { tools: { listChanged: false }, resources: { listChanged: false }, prompts: { listChanged: false } };
const TOOL_SCHEMAS = [
  {
    name: 'get_plain_language_rules',
    description: 'Get the federal plain-language writing rules to apply to a response. This tool does not change host settings.',
    inputSchema: {
      type: 'object',
      properties: { detail: { type: 'string', enum: ['short', 'full'], description: 'Use full for the complete SKILL.md; otherwise return brief rules.' } },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'check_plain_language',
    description: 'Flag possible jargon, filler openings, and long sentences in supplied text. Local heuristic, not a compliance certification or AI rewrite.',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string', minLength: 1, maxLength: 100000, description: 'Draft prose to review.' } },
      required: ['text'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'get_custom_instructions',
    description: 'Return ready-to-paste ChatGPT Custom Instructions for federal plain-language prose.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
];
const RESOURCES = [
  { uri: SKILL_URI, name: 'Plain language default SKILL.md', description: 'The complete always-on writing skill', mimeType: 'text/markdown' },
  { uri: INSTRUCTIONS_URI, name: 'Plain language Custom Instructions', description: 'Ready-to-paste persistent style instructions', mimeType: 'text/markdown' },
];
const PROMPTS = [
  { name: 'respond_in_plain_language', description: 'Answer a request using federal plain-language style', arguments: [{ name: 'request', description: 'The request to answer', required: true }] },
  { name: 'rewrite_in_plain_language', description: 'Rewrite supplied prose using federal plain-language style without changing facts', arguments: [{ name: 'text', description: 'The source prose to rewrite', required: true }] },
];
const SERVER_GUIDANCE = 'This server provides a plain-language writing skill, two writing prompts, and a local prose checker. Its tools and resources are optional. For every-response behavior, add its custom instructions to the host or install its skill and a persistent project instruction.';

function success(id, result) {
  return { jsonrpc: '2.0', id, result };
}
function fault(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}
function resultFields(obj, modern) {
  return modern ? { resultType: 'complete', ...obj } : obj;
}
function toolContent(text, modern, structuredContent) {
  return resultFields({ content: [{ type: 'text', text }], ...(structuredContent ? { structuredContent } : {}) }, modern);
}
function nonempty(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} is required.`);
  if (value.length > 100000) throw new RangeError(`${label} must be 100,000 characters or fewer.`);
  return value;
}

export function handleMcpRequest(request, state = {}) {
  if (!request || typeof request !== 'object' || Array.isArray(request) || request.jsonrpc !== '2.0') {
    return fault(request?.id ?? null, -32600, 'Invalid JSON-RPC request.');
  }
  if (!Object.hasOwn(request, 'id')) return null; // Notifications receive no reply.
  const { id, method } = request;
  if (typeof method !== 'string') return fault(id, -32600, 'Missing method.');

  const metadataVersion = request.params?._meta?.['io.modelcontextprotocol/protocolVersion'];
  const modern = method === 'server/discover' || metadataVersion === VERSION_CURRENT || state.protocol === VERSION_CURRENT;
  const params = request.params ?? {};

  try {
    switch (method) {
      case 'server/discover':
        return success(id, {
          resultType: 'complete',
          supportedVersions: [VERSION_CURRENT, VERSION_LEGACY],
          capabilities: CAPABILITIES,
          _meta: { 'io.modelcontextprotocol/serverInfo': { name, version } },
          instructions: SERVER_GUIDANCE,
          cacheScope: 'public',
          ttlMs: 3600000,
        });
      case 'initialize': {
        const offered = params.protocolVersion;
        state.protocol = offered === VERSION_CURRENT ? VERSION_CURRENT : VERSION_LEGACY;
        return success(id, {
          protocolVersion: state.protocol,
          capabilities: CAPABILITIES,
          serverInfo: { name, version },
          instructions: SERVER_GUIDANCE,
        });
      }
      case 'ping':
        return success(id, {});
      case 'tools/list':
        return success(id, resultFields({ tools: TOOL_SCHEMAS }, modern));
      case 'resources/list':
        return success(id, resultFields({ resources: RESOURCES }, modern));
      case 'resources/read': {
        const source = params.uri === SKILL_URI ? skillText() : params.uri === INSTRUCTIONS_URI ? customInstructionsText() : null;
        if (source === null) return fault(id, -32602, 'Unknown resource URI.');
        return success(id, resultFields({ contents: [{ uri: params.uri, mimeType: 'text/markdown', text: source }] }, modern));
      }
      case 'prompts/list':
        return success(id, resultFields({ prompts: PROMPTS }, modern));
      case 'prompts/get': {
        const promptName = params.name;
        const args = params.arguments ?? {};
        let content;
        if (promptName === 'respond_in_plain_language') content = writingPrompt(nonempty(args.request, 'request'));
        else if (promptName === 'rewrite_in_plain_language') content = rewritingPrompt(nonempty(args.text, 'text'));
        else return fault(id, -32602, 'Unknown prompt name.');
        return success(id, resultFields({ messages: [{ role: 'user', content: { type: 'text', text: content } }] }, modern));
      }
      case 'tools/call': {
        const args = params.arguments ?? {};
        let result;
        if (params.name === 'get_plain_language_rules') {
          result = toolContent(args.detail === 'full' ? skillText() : SHORT_RULES, modern);
        } else if (params.name === 'get_custom_instructions') {
          result = toolContent(customInstructionsText(), modern);
        } else if (params.name === 'check_plain_language') {
          const report = reviewPlainLanguage(nonempty(args.text, 'text'));
          result = toolContent(JSON.stringify(report, null, 2), modern, report);
        } else {
          return fault(id, -32602, 'Unknown tool name.');
        }
        return success(id, result);
      }
      default:
        return fault(id, -32601, `Method not found: ${method}`);
    }
  } catch (error) {
    return fault(id, -32602, error instanceof Error ? error.message : 'Invalid arguments.');
  }
}

export async function startMcpServer() {
  const state = {};
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity, terminal: false });
  for await (const line of lines) {
    if (!line.trim()) continue;
    let reply;
    try {
      if (line.length > 1_000_000) {
        reply = fault(null, -32600, 'Request exceeds the size limit.');
      } else {
        reply = handleMcpRequest(JSON.parse(line), state);
      }
    } catch {
      reply = fault(null, -32700, 'Parse error.');
    }
    if (reply) process.stdout.write(`${JSON.stringify(reply)}\n`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startMcpServer().catch((err) => { console.error(err); process.exitCode = 1; });
}
