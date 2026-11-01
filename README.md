# MacronCMS MCP

[![npm version](https://img.shields.io/npm/v/macron-cms-mcp.svg)](https://www.npmjs.com/package/macron-cms-mcp)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)

Official [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server for [MacronCMS](https://github.com/macron1-automations/macron-cms), enabling AI assistants (such as Antigravity, Claude Desktop, Claude Code, and Cursor) to read, author, and surgically edit structured content blocks, upload media assets, and manage article metadata.

---

## Features

- 🧱 **Granular Block Editing**: Insert blocks at specific positions (`insert_at`), update single blocks in-place without destroying attached assets, delete blocks, and reorder blocks seamlessly.
- 🖼️ **Full Asset Support**: Ingest remote image/media URLs or upload local files directly from disk (`prepareLocalFileUpload` with base64 streaming), complete with Active Storage attachment purging and article `background_image` support.
- 🛡️ **Schema-Aware Validation**: Queries live content type schemas dynamically (`/cms/api/v1/content_types`) and catches mistyped keys or invalid dropdown options before submitting writes, preventing silent server-side data truncation.
- 🔄 **Declarative Type Conversions**: In-place block type conversions (e.g. `image` <-> `three_js_image`) honoring `convertible_to` rules while preserving file attachments and dormant JSON payload keys.
- 📚 **MCP Resources & Prompts**: Built-in resources (`macron://content-types`, `macron://articles`) and specialized workflows for Substack/HTML article importing, article drafting, and surgical block editing.
- 🔒 **Read-Only Safety Guard**: Optional `MACRON_CMS_READ_ONLY=true` flag blocks all mutating tools when connecting to sensitive environments.

---

## Installation & Quick Start

You can run `macron-cms-mcp` directly using `npx` or clone and run it locally:

```bash
# Using npx (once published or local package link)
npx macron-cms-mcp

# Or install locally
cd /path/to/macron-cms-mcp
npm install
npm run build
node dist/index.js
```

---

## Environment Configuration

Configure the server using the following environment variables:

| Variable | Required | Default | Description |
|---|---|---|---|
| `MACRON_CMS_URL` | **Yes** | — | Base URL of your MacronCMS host app (e.g. `http://localhost:3000` or `https://my-blog.com/cms`). |
| `MACRON_CMS_API_KEY` | No (dev/test) / **Yes** (prod) | — | Bearer token or API key configured in host application (`Macron::Cms.config.api_key`). |
| `MACRON_CMS_MOUNT_PATH` | No | `/cms` | Engine mount path in host `routes.rb` if non-standard. |
| `MACRON_CMS_READ_ONLY` | No | `false` | When `true`, disables all create, update, and delete tools. |
| `MACRON_CMS_TIMEOUT_MS` | No | `30000` | HTTP request timeout in milliseconds. |

---

## MCP Client Configuration

### 1. Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "macron-cms": {
      "command": "node",
      "args": ["/Users/leonid/src/macron-cms-mcp/dist/index.js"],
      "env": {
        "MACRON_CMS_URL": "http://localhost:3000",
        "MACRON_CMS_API_KEY": "123"
      }
    }
  }
}
```

### 2. Antigravity IDE

Configure in your workspace or global Antigravity MCP settings:

```json
{
  "mcpServers": {
    "macron-cms": {
      "command": "node",
      "args": ["/Users/leonid/src/macron-cms-mcp/dist/index.js"],
      "env": {
        "MACRON_CMS_URL": "http://localhost:3000",
        "MACRON_CMS_API_KEY": "123"
      }
    }
  }
}
```

### 3. Claude Code CLI

```bash
claude mcp add macron-cms -- node /Users/leonid/src/macron-cms-mcp/dist/index.js -e MACRON_CMS_URL=http://localhost:3000 -e MACRON_CMS_API_KEY=123
```

### 4. Cursor

Add to `.cursor/mcp.json` in your project workspace:

```json
{
  "mcpServers": {
    "macron-cms": {
      "command": "node",
      "args": ["/Users/leonid/src/macron-cms-mcp/dist/index.js"],
      "env": {
        "MACRON_CMS_URL": "http://localhost:3000",
        "MACRON_CMS_API_KEY": "123"
      }
    }
  }
}
```

---

## Available MCP Tools

### Schema & Discovery
- **`list_content_types`**: Introspect all available block widgets (`heading`, `markdown`, `image`, `three_js_quote`, etc.), field definitions, dropdown options, and `convertible_to` targets. Accepts `{ refresh: true }` to force-reload cached schemas.

### Article Lifecycle
- **`list_articles`**: Search and paginate articles. Parameters: `query`, `page`, `per_page`, `include_blocks`.
- **`get_article`**: Fetch complete article metadata, `featured_image`, `background_image`, and ordered `content_blocks` by ID or slug.
- **`create_article`**: Create or upsert an article atomically with metadata, background images, and initial content blocks (with local file upload or remote URL support).
- **`update_article_metadata`**: Update title, slug, publication date, SEO tags, colors, background display options, or attach/purge `background_image` without touching content blocks.
- **`replace_article_blocks`**: Replace all blocks on an article. Passing existing block `id`s preserves Active Storage file attachments.
- **`delete_article`**: Permanently delete an article and its dependent blocks.

### Surgical Block Operations
- **`add_content_block`**: Insert a block at `insert_at` (1-based index) or append to the end. Automatically shifts existing blocks down and updates sort orders.
- **`update_content_block`**: Update an individual block's payload (merged by default), upload/replace its file attachment, or purge it.
- **`delete_content_block`**: Delete a single block by ID; remaining blocks are re-normalized sequentially and the article's featured image is updated.
- **`reorder_content_blocks`**: Reorder blocks via `ordered_block_ids` array, or move an individual block by `direction` (`"up"`/`"down"`) or `position`.
- **`convert_content_block`**: Transform a block into a compatible target type (e.g. `image` <-> `three_js_image`) while preserving attachments and dormant JSON payload keys.

---

## MCP Resources

- **`macron://content-types`**: Live JSON schema dictionary of registered MacronCMS widgets.
- **`macron://articles`**: Summary list of recent articles.
- **`macron://articles/{slug}`**: Resource template returning full article JSON by ID or slug.

---

## MCP Prompts

- **`import_html_article`**: Converts raw Substack/HTML into MacronCMS content blocks based on live widget schemas and migration rules.
- **`draft_article`**: Guides the assistant in outlining and composing a rich article with proper heading hierarchy, markdown prose, and widgets.
- **`edit_article`**: Inspects an article and provides instructions for surgical block edits.

---

## Development & Testing

```bash
# Typecheck TypeScript
npm run typecheck

# Run test suite (vitest)
npm test

# Build production bundle
npm run build
```

---

## License

MIT © Leonid Medovyy
