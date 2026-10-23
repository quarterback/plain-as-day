# plain-as-day

The npm package is named `plain-language-default`.

A reusable writing standard for AI agents. It follows the principles in the U.S. Federal Plain Language Guidelines: answer directly, use familiar words, name the actor, and organize information so people can find and use it.

This package includes:

- `SKILL.md` for agents that support skills.
- A project installer for `AGENTS.md`, Claude Code, and Cursor.
- Ready-to-paste ChatGPT Custom Instructions.
- A local Model Context Protocol (MCP) server with rules, prompts, and a prose checker.

The package has **no runtime dependencies**, needs **Node.js 20 or later**, and does **not send your text to an external service**. It is an independent project, not an official U.S. government tool.

## Install the writing rules in a project

Run this from your project directory once the npm package is published:

```sh
npx --yes plain-language-default@latest install --target all
```

This creates or updates:

| Agent | Files |
| --- | --- |
| Codex / agents that read `AGENTS.md` | `.agents/skills/plain-language-default/SKILL.md`, `AGENTS.md` |
| Claude Code | `.claude/skills/plain-language-default/SKILL.md`, `CLAUDE.md` |
| Cursor | `.cursor/skills/plain-language-default/SKILL.md`, `.cursor/rules/plain-language-default.mdc` |

The installer adds a marked block to an existing `AGENTS.md` or `CLAUDE.md`; it preserves the rest of the file. It does not overwrite a different `SKILL.md` or Cursor rule unless you pass `--force`. Running it again does not add duplicate instruction blocks.

Use `--target agents`, `--target claude`, or `--target cursor` to install for only one client. Use `--dry-run` to preview file changes. Use `--no-instructions` if you want only the skill files.

For an unpublished local source checkout:

```sh
node src/cli.mjs install --target all --directory /path/to/project
```

**Important:** A skill file is not always loaded automatically. The installer also writes a persistent project rule that tells the agent to follow it. Restart the agent if it does not reload changed instructions automatically.

## ChatGPT Custom Instructions

Print the ready-to-paste text:

```sh
npx --yes plain-language-default@latest instructions
```

Open **ChatGPT → Settings → Personalization → Custom Instructions** and paste the output. The full text is also in [`CUSTOM_INSTRUCTIONS.md`](CUSTOM_INSTRUCTIONS.md).

ChatGPT does not automatically read a `SKILL.md` on your computer. Use Custom Instructions for ordinary ChatGPT chats.

## Use the MCP server

The package includes a local MCP server. Add this entry to an MCP client's configuration:

```json
{
  "mcpServers": {
    "plain-language-default": {
      "command": "npx",
      "args": ["-y", "plain-language-default@latest", "mcp"]
    }
  }
}
```

MCP clients use different names and locations for their configuration files. The JSON above is the common `mcpServers` form used by several clients. For a client that uses a different schema, keep the command and args and use its documented configuration format.

After connecting, the server exposes:

| Feature | Name | Purpose |
| --- | --- | --- |
| Tool | `get_plain_language_rules` | Return short rules or the full `SKILL.md` |
| Tool | `get_custom_instructions` | Return ready-to-paste ChatGPT rules |
| Tool | `check_plain_language` | Flag likely word-choice, opening, and length problems in supplied text |
| Prompt | `respond_in_plain_language` | Answer a request in plain language |
| Prompt | `rewrite_in_plain_language` | Rewrite text while preserving facts and sources |
| Resource | `plainlanguage://skill` | Read the full `SKILL.md` |
| Resource | `plainlanguage://custom-instructions` | Read the Custom Instructions |

MCP supports protocol versions **2026-07-28** (stateless discovery) and **2025-11-25** (legacy initialize) over standard input and output.

**MCP alone cannot force every answer to use these rules.** MCP exposes guidance and tools to a client, but the client decides whether to use them. For always-on behavior, also install the project instructions or set persistent instructions in your chat application.

## Check a draft

```sh
# File check
npx --yes plain-language-default@latest check post.md

# Pipe text in, return JSON
cat post.md | npx --yes plain-language-default@latest check --json

# Return a nonzero exit status if the checker finds problems
npx --yes plain-language-default@latest check post.md --strict
```

The checker uses simple local rules. It flags some jargon, filler openings, long sentences, and long paragraphs. It does not rewrite text, prove that readers understand it, judge technical accuracy, or certify compliance with federal guidance. Review findings in context.

## Develop and test locally

```sh
npm test
npm pack --dry-run
node src/cli.mjs install --target all --dry-run
node src/mcp.mjs  # waits for an MCP client on stdin
```

No `npm install` step is required to run or test this source package.

## Publish to npm

If the name `plain-language-default` is available and you have an npm account:

```sh
npm login
npm view plain-language-default version
npm test
npm pack --dry-run
npm publish --access public
```

If `npm view` reports that the name is already taken, choose an unused package name in `package.json`, update the examples, and publish under that name. A `404` from `npm view` normally means the package does not exist, but network or permission errors mean you should investigate before publishing.

Publishing may require two-factor authentication or a suitable npm token. This package does not publish itself, create accounts, or bypass npm's authentication.

## Source guidance and attribution

- [Digital.gov: Plain language guide](https://digital.gov/guides/plain-language)
- [GSA: PlainLanguage.gov guidelines archive](https://github.com/GSA/plainlanguage.gov/tree/main/_pages/guidelines)
- [GSA: Federal Plain Language Review agent skill](https://github.com/GSA-TTS/agentic-coding-patterns/blob/main/.agents/skills/frontend/plain-language-review/SKILL.md) — a related review-only skill

The skill in this package is independently written using federal plain-language principles. The checker is not an official federal evaluation or certification.

## License

CC0 1.0 Universal. See [LICENSE](LICENSE).
