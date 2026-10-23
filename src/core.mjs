import { readFileSync } from 'node:fs';

export const SKILL_URI = 'plainlanguage://skill';
export const INSTRUCTIONS_URI = 'plainlanguage://custom-instructions';

export function skillText() {
  return readFileSync(new URL('../SKILL.md', import.meta.url), 'utf8');
}

export function customInstructionsText() {
  return readFileSync(new URL('../CUSTOM_INSTRUCTIONS.md', import.meta.url), 'utf8');
}

export const SHORT_RULES = `Use federal plain language for every user-facing response. Answer the question first. Use familiar words, active voice, and clear paragraphs. Name the actor and the action. Keep necessary technical terms, facts, citations, and qualifications. Do not repeat the user's input, invent jargon, add motivational openings, or pad the answer with headings and lists. Explain how things work. Quietly edit before sending. Follow the user's requested format and higher-priority instructions.`;

const WORD_CHOICES = [
  ['utilize', 'use'],
  ['utilization', 'use'],
  ['prior to', 'before'],
  ['subsequent to', 'after'],
  ['in order to', 'to'],
  ['with respect to', 'about'],
  ['at this point in time', 'now'],
  ['in the event that', 'if'],
  ['facilitate', 'help or make possible'],
  ['leverage', 'use, unless a technical meaning is intended'],
  ['commence', 'start'],
  ['terminate', 'end'],
  ['endeavor', 'try'],
];
const FILLER_OPENINGS = [
  /^great question\b/i,
  /^absolutely\b/i,
  /^let['’]s (unpack|dive into|break down)\b/i,
  /^here['’]s the thing\b/i,
  /^it['’]s worth noting\b/i,
  /^the real opportunity is\b/i,
];

function wordCount(text) {
  return (text.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu) || []).length;
}

function plainText(text) {
  return text
    .replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^\s*>.*$/gm, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\[[^\]]+\]\([^)]*\)/g, (m) => m.slice(1, m.indexOf(']')))
    .replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/gm, '')
    .trim();
}

function excerpt(text, max = 130) {
  const s = text.trim().replace(/\s+/g, ' ');
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/**
 * A small, transparent heuristic check, not a federal compliance test.
 * Keeps findings limited so model context and CLI output stay readable.
 */
export function reviewPlainLanguage(input) {
  if (typeof input !== 'string' || !input.trim()) {
    throw new TypeError('Text is required.');
  }
  if (input.length > 100_000) {
    throw new RangeError('Text must be 100,000 characters or fewer.');
  }
  const prose = plainText(input);
  const findings = [];
  const add = (kind, match, suggestion) => {
    if (findings.length < 30) findings.push({ kind, excerpt: excerpt(match), suggestion });
  };

  for (const [term, substitute] of WORD_CHOICES) {
    const rx = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'giu');
    const found = prose.match(rx);
    if (found) add('word_choice', term, `Consider “${substitute}” if the meaning stays accurate. (${found.length} occurrence${found.length === 1 ? '' : 's'})`);
  }

  const opening = prose.replace(/^(?:#.*\n|\s)*/g, '').trim();
  if (FILLER_OPENINGS.some((re) => re.test(opening))) {
    add('filler_opening', excerpt(opening, 100), 'Begin with the answer or next useful action.');
  }

  const sentences = prose.replace(/\n+/g, ' ').split(/(?<=[.!?])\s+(?=[\p{Lu}\d“"(])/u);
  for (const sentence of sentences) {
    if (wordCount(sentence) > 30) add('long_sentence', sentence, 'Split this sentence while keeping the facts and qualifications.');
    if (findings.length >= 30) break;
  }

  const paragraphs = input
    .replace(/```[\s\S]*?```/g, '')
    .split(/\n\s*\n+/)
    .filter((p) => p.trim() && !p.trim().startsWith('>') && !p.trim().startsWith('|'));
  for (const p of paragraphs) {
    if (wordCount(p) > 130) add('long_paragraph', p, 'Break the paragraph at a change in subject or action.');
    if (findings.length >= 30) break;
  }

  return {
    wordsApprox: wordCount(prose),
    checkedCharacters: input.length,
    findings,
    guidance: findings.length
      ? 'Review these possible problems. Context may justify the original wording.'
      : 'No selected patterns found. This is not proof that the text meets federal plain-language guidance.',
    note: 'This is a local heuristic check. It does not assess factual accuracy, audience understanding, or legal compliance.',
  };
}

export function writingPrompt(request) {
  if (typeof request !== 'string' || !request.trim()) throw new TypeError('A writing request is required.');
  return `${SHORT_RULES}\n\nComplete the following request. Provide only the requested output; do not add commentary about the style.\n\n${request}`;
}

export function rewritingPrompt(text) {
  if (typeof text !== 'string' || !text.trim()) throw new TypeError('Text is required.');
  return `${SHORT_RULES}\n\nRewrite the following text in plain language. Keep its meaning, specific facts, quotations, names, dates, citations, and essential technical details. Do not add claims, opinions, or background. Keep the original purpose and audience. Return only the revised text.\n\n---\n${text}\n---`;
}
