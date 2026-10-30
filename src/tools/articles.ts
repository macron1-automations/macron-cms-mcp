import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { prepareLocalFileUpload } from "../assets.js";
import { MacronCmsClient } from "../client.js";
import { SchemaValidator } from "../schema-validator.js";

const BackgroundOptionsSchema = z.object({
  repeat: z.enum(["no-repeat", "repeat", "repeat-x", "repeat-y"]).optional(),
  size: z.enum(["cover", "contain", "auto"]).optional(),
  position: z.enum(["center", "top", "bottom", "left", "right"]).optional(),
  attachment: z.enum(["scroll", "fixed"]).optional(),
});

const ContentBlockInputSchema = z.object({
  id: z.number().int().positive().optional().describe("Existing block ID (required to preserve Active Storage attachments during updates)."),
  content_type: z.string().describe("Content type name (e.g. heading, markdown, image)."),
  sort_order: z.number().int().positive().optional().describe("1-based sequence order."),
  payload: z.record(z.unknown()).optional().describe("Key-value attributes matching the content type schema."),
  purge_attachment: z.boolean().optional().describe("Purge existing file attachment on this block."),
  file_url: z.string().url().optional().describe("Remote HTTP/HTTPS URL for the CMS server to download and attach."),
  file_path: z.string().optional().describe("Absolute or relative local file path to upload from disk."),
});

export function registerArticleTools(
  server: McpServer,
  client: MacronCmsClient,
  validator: SchemaValidator
): void {
  // 1. list_articles
  server.tool(
    "list_articles",
    "List and search MacronCMS articles with pagination, metadata, and optional full content blocks.",
    {
      query: z.string().optional().describe("Optional search query across title, slug, and SEO metadata."),
      page: z.number().int().positive().optional().describe("Page number (defaults to 1)."),
      per_page: z.number().int().positive().max(100).optional().describe("Number of articles per page (max 100, defaults to 20)."),
      include_blocks: z.boolean().optional().describe("Whether to include serialized content blocks in each article record."),
    },
    async (args) => {
      try {
        const res = await client.listArticles({
          q: args.query,
          page: args.page,
          per_page: args.per_page,
          include_blocks: args.include_blocks,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(res, null, 2) }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to list articles: ${err.message}` }],
        };
      }
    }
  );

  // 2. get_article
  server.tool(
    "get_article",
    "Retrieve a single article and all of its ordered content blocks by ID or slug.",
    {
      id_or_slug: z.string().describe("Article numeric ID or FriendlyId slug."),
    },
    async (args) => {
      try {
        const res = await client.getArticle(args.id_or_slug);
        return {
          content: [{ type: "text", text: JSON.stringify(res, null, 2) }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to get article "${args.id_or_slug}": ${err.message}` }],
        };
      }
    }
  );

  // 3. create_article
  server.tool(
    "create_article",
    "Create a new article (or upsert an existing article) with metadata and ordered content blocks in a single atomic transaction.",
    {
      title: z.string().describe("Display title of the article."),
      slug: z.string().optional().describe("Custom URL slug. Parameterized automatically from title if omitted."),
      meta_title: z.string().optional().describe("SEO title tag."),
      meta_description: z.string().optional().describe("SEO meta description."),
      published_at: z.string().optional().describe("ISO 8601 publication timestamp."),
      background_color: z.string().optional().describe("CSS background color (e.g. #ffffff)."),
      text_color: z.string().optional().describe("CSS text color (e.g. #18181b)."),
      background_options: BackgroundOptionsSchema.optional(),
      background_image_url: z.string().url().optional().describe("Remote URL for article background image."),
      background_image_path: z.string().optional().describe("Local file path for article background image."),
      upsert: z.boolean().optional().describe("If true, updates article matching slug/title instead of creating duplicate."),
      content_blocks: z.array(ContentBlockInputSchema).optional().describe("Initial sequence of content blocks."),
    },
    async (args) => {
      if (client.config.readOnly) {
        return {
          isError: true,
          content: [{ type: "text", text: "Operation rejected: MacronCMS MCP server is in read-only mode." }],
        };
      }

      try {
        const articlePayload: Record<string, unknown> = {
          title: args.title,
          slug: args.slug,
          meta_title: args.meta_title,
          meta_description: args.meta_description,
          published_at: args.published_at,
          background_color: args.background_color,
          text_color: args.text_color,
          background_options: args.background_options,
        };

        if (args.background_image_path) {
          const upload = await prepareLocalFileUpload(args.background_image_path);
          articlePayload.background_image_upload = upload;
        } else if (args.background_image_url) {
          articlePayload.background_image_url = args.background_image_url;
        }

        const preparedBlocks: any[] = [];
        if (args.content_blocks && args.content_blocks.length > 0) {
          for (let i = 0; i < args.content_blocks.length; i++) {
            const b = args.content_blocks[i];
            await validator.validateBlock(b.content_type, b.payload || {});

            const blockObj: any = {
              id: b.id,
              content_type: b.content_type,
              sort_order: b.sort_order ?? i + 1,
              payload: b.payload || {},
              purge_attachment: b.purge_attachment,
              image_url: b.file_url,
            };

            if (b.file_path) {
              blockObj.file_upload = await prepareLocalFileUpload(b.file_path);
            }

            preparedBlocks.push(blockObj);
          }
        }

        const body: Record<string, unknown> = {
          article: articlePayload,
          upsert: args.upsert ?? false,
        };

        if (preparedBlocks.length > 0) {
          body.content_blocks = preparedBlocks;
        }

        const res = await client.createArticle(body);
        return {
          content: [
            {
              type: "text",
              text: `Article "${res.article.title}" successfully created/upserted (slug: ${res.article.slug}, id: ${res.article.id}).\n\n${JSON.stringify(
                res,
                null,
                2
              )}`,
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to create article: ${err.message}` }],
        };
      }
    }
  );

  // 4. update_article_metadata
  server.tool(
    "update_article_metadata",
    "Update an article's metadata (title, slug, publication date, SEO tags, colors, background options, or background image) without modifying its content blocks.",
    {
      id_or_slug: z.string().describe("Article ID or slug."),
      title: z.string().optional(),
      slug: z.string().optional(),
      meta_title: z.string().optional(),
      meta_description: z.string().optional(),
      published_at: z.string().optional(),
      background_color: z.string().optional(),
      text_color: z.string().optional(),
      background_options: BackgroundOptionsSchema.optional(),
      background_image_url: z.string().url().optional(),
      background_image_path: z.string().optional(),
      purge_background_image: z.boolean().optional(),
    },
    async (args) => {
      if (client.config.readOnly) {
        return {
          isError: true,
          content: [{ type: "text", text: "Operation rejected: MacronCMS MCP server is in read-only mode." }],
        };
      }

      try {
        const { id_or_slug, ...fields } = args;
        const articlePayload: Record<string, unknown> = {};

        for (const [k, v] of Object.entries(fields)) {
          if (v !== undefined && !k.startsWith("background_image") && k !== "purge_background_image") {
            articlePayload[k] = v;
          }
        }

        if (args.purge_background_image) {
          articlePayload.purge_background_image = true;
        } else if (args.background_image_path) {
          articlePayload.background_image_upload = await prepareLocalFileUpload(args.background_image_path);
        } else if (args.background_image_url) {
          articlePayload.background_image_url = args.background_image_url;
        }

        const res = await client.updateArticle(id_or_slug, { article: articlePayload });
        return {
          content: [
            {
              type: "text",
              text: `Article "${res.article.title}" metadata updated.\n\n${JSON.stringify(res, null, 2)}`,
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to update article metadata: ${err.message}` }],
        };
      }
    }
  );

  // 5. replace_article_blocks
  server.tool(
    "replace_article_blocks",
    "Replace the entire content block sequence of an article in one atomic transaction. To preserve existing file attachments (e.g. uploaded images), pass the existing block `id`.",
    {
      id_or_slug: z.string().describe("Article ID or slug."),
      content_blocks: z.array(ContentBlockInputSchema).describe("Complete array of blocks in desired order."),
    },
    async (args) => {
      if (client.config.readOnly) {
        return {
          isError: true,
          content: [{ type: "text", text: "Operation rejected: MacronCMS MCP server is in read-only mode." }],
        };
      }

      try {
        const preparedBlocks: any[] = [];
        for (let i = 0; i < args.content_blocks.length; i++) {
          const b = args.content_blocks[i];
          await validator.validateBlock(b.content_type, b.payload || {});

          const blockObj: any = {
            id: b.id,
            content_type: b.content_type,
            sort_order: b.sort_order ?? i + 1,
            payload: b.payload || {},
            purge_attachment: b.purge_attachment,
            image_url: b.file_url,
          };

          if (b.file_path) {
            blockObj.file_upload = await prepareLocalFileUpload(b.file_path);
          }

          preparedBlocks.push(blockObj);
        }

        const res = await client.updateArticle(args.id_or_slug, {
          content_blocks: preparedBlocks,
        });

        return {
          content: [
            {
              type: "text",
              text: `Replaced content blocks for article "${res.article.title}". Total blocks: ${res.content_blocks.length}.\n\n${JSON.stringify(
                res,
                null,
                2
              )}`,
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to replace article blocks: ${err.message}` }],
        };
      }
    }
  );

  // 6. delete_article
  server.tool(
    "delete_article",
    "Permanently delete an article and all of its content blocks by ID or slug.",
    {
      id_or_slug: z.string().describe("Article ID or slug to permanently delete."),
    },
    async (args) => {
      if (client.config.readOnly) {
        return {
          isError: true,
          content: [{ type: "text", text: "Operation rejected: MacronCMS MCP server is in read-only mode." }],
        };
      }

      try {
        const res = await client.deleteArticle(args.id_or_slug);
        return {
          content: [
            {
              type: "text",
              text: `Article "${args.id_or_slug}" (id: ${res.id}, slug: ${res.slug}) has been permanently deleted.`,
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to delete article: ${err.message}` }],
        };
      }
    }
  );
}
