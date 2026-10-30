import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MacronCmsClient } from "./client.js";
import { SchemaValidator } from "./schema-validator.js";

export function registerPrompts(
  server: McpServer,
  client: MacronCmsClient,
  validator: SchemaValidator
): void {
  // 1. import_html_article
  server.prompt(
    "import_html_article",
    "Transform an external Substack or HTML article into an atomic sequence of MacronCMS content blocks using live widget schemas.",
    {
      html_or_markdown: z.string().describe("Raw HTML or Markdown content to ingest."),
      source_url: z.string().optional().describe("Original source URL of the article."),
      slug: z.string().optional().describe("Desired URL slug for the article."),
    },
    async (args) => {
      const types = await validator.getContentTypes();
      const promptText = `You are an expert content migration agent for MacronCMS.
Your task is to parse the input HTML/Markdown and create or upsert an article in MacronCMS.

### Live Available MacronCMS Content Types:
${JSON.stringify(types, null, 2)}

### Block Mapping Rules:
1. Extract Title and Subtitle:
   - Use the Title for \`article.title\` and \`article.meta_title\`.
   - Use the Subtitle for \`article.meta_description\`.
2. Headings:
   - Map <h1>-<h6> headings to \`heading\` blocks: \`{ "title": "Heading Text", "level": "h2" }\`.
3. Rich Text / Paragraphs / Lists:
   - Combine consecutive text paragraphs, lists, bold/italics, and links into clean GitHub-flavored Markdown.
   - Map to \`markdown\` blocks: \`{ "content": "..." }\`.
4. Images:
   - If image URLs are present in the source, map to an \`image\` block with \`file_url: "<URL>"\` and payload \`{ "size": "lg" }\` (or "full").
5. Pullquotes:
   - Map highlighted quotes to \`three_js_quote\` or Markdown blockquotes.

### Input Content:
${args.html_or_markdown}

${args.source_url ? `Source URL: ${args.source_url}` : ""}
${args.slug ? `Desired Slug: ${args.slug}` : ""}

Please use the \`create_article\` tool to import this article. Set \`upsert: true\` if updating an existing article.`;

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: promptText,
            },
          },
        ],
      };
    }
  );

  // 2. draft_article
  server.prompt(
    "draft_article",
    "Guide the drafting of a structured, SEO-optimized article ready to publish on MacronCMS.",
    {
      topic: z.string().describe("Article topic or thesis."),
      target_audience: z.string().optional().describe("Intended audience."),
      tone: z.string().optional().describe("Editorial tone (e.g. conversational, academic, provocative)."),
    },
    async (args) => {
      const types = await validator.getContentTypes();
      const promptText = `You are a professional editorial writer and MacronCMS content architect.
Please research and outline an engaging, well-structured article on: "${args.topic}".
${args.target_audience ? `Target Audience: ${args.target_audience}\n` : ""}${args.tone ? `Tone: ${args.tone}\n` : ""}

### Available MacronCMS Content Types:
${types.map((t) => `- ${t.name}: fields [${t.fields.map((f) => f.name).join(", ")}]`).join("\n")}

### Instructions:
1. Propose an engaging title, SEO meta description, and FriendlyId slug.
2. Outline the article structure using a combination of \`heading\`, \`markdown\`, and callout widgets.
3. Call the \`create_article\` tool to save the draft.`;

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: promptText,
            },
          },
        ],
      };
    }
  );

  // 3. edit_article
  server.prompt(
    "edit_article",
    "Inspect an existing MacronCMS article and execute surgical block-level modifications (update, add, reorder, convert).",
    {
      id_or_slug: z.string().describe("Article ID or slug to edit."),
      instructions: z.string().describe("Editorial instructions for modifying the content."),
    },
    async (args) => {
      let articleData = "";
      try {
        const article = await client.getArticle(args.id_or_slug);
        articleData = JSON.stringify(article, null, 2);
      } catch {
        articleData = `(Article "${args.id_or_slug}" not pre-fetched. Use get_article to inspect first).`;
      }

      const promptText = `You are an expert content editor for MacronCMS.
Review the article "${args.id_or_slug}" and apply the following modifications:
"${args.instructions}"

### Current Article State:
${articleData}

### Guidelines:
- Prefer surgical operations: \`update_content_block\` to modify single blocks without destroying attached assets.
- Use \`add_content_block\` with \`insert_at\` to position new blocks.
- Use \`convert_content_block\` to transform compatible types (e.g. image <-> three_js_image).
- Use \`reorder_content_blocks\` to move blocks.`;

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: promptText,
            },
          },
        ],
      };
    }
  );
}
