import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { handleMcpRequest } from '../src/mcp.mjs';

const serverFile = fileURLToPath(new URL('../src/mcp.mjs', import.meta.url));
const request = (id, method, params = {}) => ({ jsonrpc: '2.0', id, method, params });

test('modern MCP discovery and tools work', () => {
  const discovered = handleMcpRequest(request('discover', 'server/discover', {
    _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' },
  }));
  assert.equal(discovered.result.resultType, 'complete');
  assert.ok(discovered.result.supportedVersions.includes('2026-07-28'));
  const tools = handleMcpRequest(request(1, 'tools/list', {
    _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' },
  }));
  assert.equal(tools.result.resultType, 'complete');
  assert.ok(tools.result.tools.some((x) => x.name === 'check_plain_language'));
});

test('legacy handshake works', () => {
  const state = {};
  const init = handleMcpRequest(request(1, 'initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test', version: '1' } }), state);
  assert.equal(init.result.protocolVersion, '2025-11-25');
  const res = handleMcpRequest(request(2, 'resources/read', { uri: 'plainlanguage://skill' }), state);
  assert.match(res.result.contents[0].text, /plain language/i);
  assert.equal('resultType' in res.result, false);
});

test('prompts, resources, tools and bad arguments behave predictably', () => {
  const prompts = handleMcpRequest(request(1, 'prompts/list'));
  assert.equal(prompts.result.prompts.length, 2);
  const prompt = handleMcpRequest(request(2, 'prompts/get', { name: 'rewrite_in_plain_language', arguments: { text: 'Original.' } }));
  assert.match(prompt.result.messages[0].content.text, /Original/);
  const reviewed = handleMcpRequest(request(3, 'tools/call', { name: 'check_plain_language', arguments: { text: 'We will utilize this.' } }));
  assert.equal(reviewed.result.structuredContent.findings[0].kind, 'word_choice');
  const bad = handleMcpRequest(request(4, 'tools/call', { name: 'check_plain_language', arguments: {} }));
  assert.equal(bad.error.code, -32602);
  const unknown = handleMcpRequest(request(5, 'surprise'));
  assert.equal(unknown.error.code, -32601);
  const notification = handleMcpRequest({ jsonrpc: '2.0', method: 'notifications/initialized' });
  assert.equal(notification, null);
});

test('stdio MCP server accepts multiple JSON-RPC messages with clean stdout', async () => {
  const child = spawn(process.execPath, [serverFile], { stdio: ['pipe', 'pipe', 'pipe'] });
  const lines = createInterface({ input: child.stdout });
  const replies = [];
  lines.on('line', (line) => replies.push(JSON.parse(line)));
  const messages = [
    request(1, 'initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test', version: '1' } }),
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    request(2, 'tools/list'),
    request(3, 'resources/read', { uri: 'plainlanguage://custom-instructions' }),
    request(4, 'tools/call', { name: 'get_plain_language_rules', arguments: { detail: 'short' } }),
  ];
  for (const message of messages) child.stdin.write(`${JSON.stringify(message)}\n`);
  child.stdin.end();
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('MCP stdio timeout')); }, 3000);
    child.on('error', (e) => { clearTimeout(timeout); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timeout);
      code === 0 ? resolve() : reject(new Error(`MCP server exited ${code}`));
    });
  });
  assert.deepEqual(replies.map((x) => x.id), [1, 2, 3, 4]);
  assert.equal(replies[0].result.protocolVersion, '2025-11-25');
  assert.match(replies[2].result.contents[0].text, /Federal Plain Language Guidelines/);
  assert.match(replies[3].result.content[0].text, /federal plain language/i);
});
