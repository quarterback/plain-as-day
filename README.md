# plain-as-day

The npm package is named `plain-language-default`.

A reusable writing standard for AI agents. It follows the principles in the U.S. Federal Plain Language Guidelines: answer directly, use familiar words, name the actor, and organize information so people can find and use it.

This package includes:

- `SKILL.md` for agents that support skills.
- A project installer for `AGENTS.md`, Claude Code, and Cursor.
- Ready-to-paste ChatGPT Custom Instructions.
- A local Model Context Protocol (MCP) server with rules, prompts, and a prose checker.

The package has **no runtime dependencies**, needs **Node.js 20 or later**, and does **not send your text to an external service**. It is an independent project, not an official U.S. government tool.

## Install from the agent skill directory

You can install the skill from GitHub through [skills.sh](https://skills.sh/docs/cli) without publishing an npm package:

```sh
npx skills add quarterback/plain-as-day
```

Use `npx skills add quarterback/plain-as-day -g` for a global installation. Skills appear on the skills.sh leaderboard after people install them through the skills CLI; you do not need a separate listing submission.

Agent skills may be loaded only when an agent finds them relevant. For writing rules on every response, install the persistent project instructions described below or add the Custom Instructions to your assistant.

## Publish to the official MCP Registry

npm distributes the MCP server. The [official MCP Registry](https://registry.modelcontextprotocol.io) separately lists it so MCP clients can discover it.

This repository includes a `server.json` manifest and npm `mcpName` metadata. Both identify the server as `io.github.quarterback/plain-as-day`. The MCP server runs locally through `npx` with the `mcp` command over standard input and output.

1. **Publish the npm package version containing the `mcpName` metadata.** If `0.1.0` was already published without `mcpName`, increase the version in `package.json`, and update both `version` fields in `server.json`. npm does not allow replacing a published version.
2. Open [Publish to MCP Registry](https://github.com/quarterback/plain-as-day/actions/workflows/publish-mcp.yml) and select **Run workflow** on `main`. The workflow checks the npm release, validates the manifest, and publishes it using GitHub Actions identity. No additional MCP Registry secret is needed.
3. Confirm your listing in the [MCP Registry](https://registry.modelcontextprotocol.io).

Alternatively, from a local checkout *after* publishing the npm package:

```sh
brew install mcp-publisher
mcp-publisher validate server.json
mcp-publisher login github
mcp-publisher publish server.json
```

A `server.json` file in GitHub does not, by itself, register an MCP server. Registry publication is a separate authenticated step. An MCP connection also does not force writing rules on every model response.

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

## Publish from GitHub (no local checkout)

This repository has a manual [Publish to npm workflow](https://github.com/quarterback/plain-as-day/actions/workflows/publish.yml). You can release from your browser.

**First release:** npm currently requires a publishing token to create a brand-new package. Trusted publishing (OIDC) can replace it after the first version exists.

1. Sign in to [npmjs.com](https://www.npmjs.com/) and open **Profile → Access Tokens → Generate New Token**.
2. Choose **Read and write (publish and stage)** for packages, select **All Packages** for the initial release, and turn on **Bypass two-factor authentication**. Use a short expiry because you will replace this token with trusted publishing. Copy the token. Do not commit it or put it in a GitHub issue.
3. Open [GitHub repository Actions secrets](https://github.com/quarterback/plain-as-day/settings/secrets/actions), click **New repository secret**, name it `NPM_TOKEN`, and paste the value.
4. Open [Publish to npm](https://github.com/quarterback/plain-as-day/actions/workflows/publish.yml), click **Run workflow**, select `main`, and start the run.
5. Check [plain-language-default on npm](https://www.npmjs.com/package/plain-language-default) or inspect the workflow logs. The package must be owned by your npm account (or the unclaimed name must be available).

The workflow runs tests, previews the release contents, and publishes using the package name in `package.json`, currently `plain-language-default@0.1.0`. Running it again with the same version will not publish a second copy.

**Future releases without a saved npm token:**

1. Once the package is published, open its npm package **Settings → Trusted publishing** and add a GitHub Actions trusted publisher:
   - GitHub user: `quarterback`
   - Repository: `plain-as-day`
   - Workflow filename: `publish.yml`
   - Allow direct `npm publish`.
2. Remove the `NPM_TOKEN` GitHub secret and revoke that token from your npm account.
3. For each new release, increase the version in `package.json`, then use the same **Run workflow** button.

New trusted-publisher configurations must be validated by a successful publication within two days. This workflow uses GitHub-hosted runners, Node.js 24 and the required OIDC permission.

See [npm's trusted publishing documentation](https://docs.npmjs.com/trusted-publishers/) and [access-token instructions](https://docs.npmjs.com/creating-and-viewing-access-tokens/).

### Alternative: publish from a local checkout

```sh
npm login
npm test
npm pack --dry-run
npm publish --access public
```

## Source guidance and attribution

- [Digital.gov: Plain language guide](https://digital.gov/guides/plain-language)
- [GSA: PlainLanguage.gov guidelines archive](https://github.com/GSA/plainlanguage.gov/tree/main/_pages/guidelines)
- [GSA: Federal Plain Language Review agent skill](https://github.com/GSA-TTS/agentic-coding-patterns/blob/main/.agents/skills/frontend/plain-language-review/SKILL.md) — a related review-only skill

The skill in this package is independently written using federal plain-language principles. The checker is not an official federal evaluation or certification.

## License

CC0 1.0 Universal. See [LICENSE](LICENSE).
