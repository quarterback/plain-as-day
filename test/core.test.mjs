import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewPlainLanguage, skillText, customInstructionsText, rewritingPrompt } from '../src/core.mjs';

test('contains the full skill and ready-to-paste instructions', () => {
  assert.match(skillText(), /^---\nname: plain-language-default/m);
  assert.match(customInstructionsText(), /Federal Plain Language Guidelines/);
});

test('finds avoidable jargon and filler', () => {
  const result = reviewPlainLanguage('Great question. We should utilize the guidance prior to sending this.');
  const kinds = result.findings.map((x) => x.kind);
  assert.ok(kinds.includes('word_choice'));
  assert.ok(kinds.includes('filler_opening'));
  assert.ok(result.findings.some((x) => x.excerpt === 'prior to'));
});

test('finds very long sentences and does not report certification', () => {
  const text = 'We need to follow the steps because the project depends on volunteers and every volunteer needs accurate instructions and a clear assignment that explains who will review the work and when it needs to be finished so the next contributor can start without guessing.';
  const result = reviewPlainLanguage(text);
  assert.ok(result.findings.some((x) => x.kind === 'long_sentence'));
  assert.match(result.note, /not assess/);
});

test('ignores code fences and inline code in basic checks', () => {
  const result = reviewPlainLanguage('Use the method below.\n\n```js\nconst utilize = prior_to;\n```\n\nCall `utilize` when necessary.');
  assert.equal(result.findings.filter((x) => x.kind === 'word_choice').length, 0);
});

test('validates content length and missing text', () => {
  assert.throws(() => reviewPlainLanguage(''), /required/);
  assert.throws(() => reviewPlainLanguage('x'.repeat(100001)), /100,000/);
  assert.match(rewritingPrompt('A proposal.'), /preserving facts|Keep its meaning/);
});
