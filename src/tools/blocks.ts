import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { prepareLocalFileUpload } from "../assets.js";
import { MacronCmsClient } from "../client.js";
import { SchemaValidator } from "../schema-validator.js";

export function registerBlockTools(
  server: McpServer,
  client: MacronCmsClient,
  validator: SchemaValidator
): void {
  // 1. add_content_block
  server.tool(
    "add_content_block",
    "Insert a single content block into an article at a specific position (or append to the end). Automatically shifts existing blocks down and normalizes sequence order.",
    {
      article_id_or_slug: z.string().describe("Article ID or slug."),
      content_type: z.string().describe("Content type name (e.g. heading, markdown, image, embed, three_js_quote)."),
      insert_at: z.number().int().positive().optional().describe("1-based position to insert at. If omitted, appends to the end."),
      payload: z.record(z.unknown()).optional().describe("Block payload fields matching the schema."),
      file_url: z.string().url().optional().describe("Remote URL to download and attach."),
      file_path: z.string().optional().describe("Local file path to upload and attach."),
    },
    async (args) => {
      if (client.config.readOnly) {
        return {
          isError: true,
          content: [{ type: "text", text: "Operation rejected: MacronCMS MCP server is in read-only mode." }],
        };
      }

      try {
        await validator.validateBlock(args.content_type, args.payload || {});

        const blockPayload: Record<string, unknown> = {
          content_type: args.content_type,
          insert_at: args.insert_at,
          payload: args.payload || {},
        };

        if (args.file_path) {
          blockPayload.file_upload = await prepareLocalFileUpload(args.file_path);
        } else if (args.file_url) {
          blockPayload.file_url = args.file_url;
        }

        const res = await client.addContentBlock(args.article_id_or_slug, blockPayload);
        return {
          content: [
            {
              type: "text",
              text: `Added ${args.content_type} block (id: ${res.content_block.id}, sort_order: ${res.content_block.sort_order}) to article "${args.article_id_or_slug}". Total blocks: ${res.blocks_count}.\n\n${JSON.stringify(
                res.content_block,
                null,
                2
              )}`,
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to add content block: ${err.message}` }],
        };
      }
    }
  );

  // 2. update_content_block
  server.tool(
    "update_content_block",
    "Update an individual content block's payload or file attachment without affecting other blocks in the article. Existing payload fields are preserved and merged by default.",
    {
      article_id_or_slug: z.string().describe("Article ID or slug."),
      block_id: z.number().int().positive().describe("Content block ID."),
      payload: z.record(z.unknown()).optional().describe("Field key-values to update."),
      replace_payload: z.boolean().optional().describe("If true, replaces the entire payload instead of merging."),
      purge_attachment: z.boolean().optional().describe("Purge existing file attachment on this block."),
      file_url: z.string().url().optional().describe("New remote URL to download and attach."),
      file_path: z.string().optional().describe("New local file path to upload and attach."),
      content_type: z.string().optional().describe("Change content type directly (if type conversion rules don't apply)."),
    },
    async (args) => {
      if (client.config.readOnly) {
        return {
          isError: true,
          content: [{ type: "text", text: "Operation rejected: MacronCMS MCP server is in read-only mode." }],
        };
      }

      try {
        if (args.payload) {
          const article = await client.getArticle(args.article_id_or_slug);
          const currentBlock = article.content_blocks.find((b) => b.id === args.block_id);
          const targetType = args.content_type || currentBlock?.content_type;
          if (targetType) {
            await validator.validateBlock(targetType, args.payload, { isPartial: !args.replace_payload });
          }
        }

        const blockPayload: Record<string, unknown> = {
          payload: args.payload,
          replace_payload: args.replace_payload,
          purge_attachment: args.purge_attachment,
          content_type: args.content_type,
        };

        if (args.file_path) {
          blockPayload.file_upload = await prepareLocalFileUpload(args.file_path);
        } else if (args.file_url) {
          blockPayload.file_url = args.file_url;
        }

        const res = await client.updateContentBlock(args.article_id_or_slug, args.block_id, blockPayload);
        return {
          content: [
            {
              type: "text",
              text: `Updated block ${args.block_id} in article "${args.article_id_or_slug}".\n\n${JSON.stringify(
                res.content_block,
                null,
                2
              )}`,
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to update content block: ${err.message}` }],
        };
      }
    }
  );

  // 3. delete_content_block
  server.tool(
    "delete_content_block",
    "Delete an individual content block from an article. Remaining blocks are automatically re-numbered sequentially and the article's featured image is re-calculated.",
    {
      article_id_or_slug: z.string().describe("Article ID or slug."),
      block_id: z.number().int().positive().describe("Content block ID to delete."),
    },
    async (args) => {
      if (client.config.readOnly) {
        return {
          isError: true,
          content: [{ type: "text", text: "Operation rejected: MacronCMS MCP server is in read-only mode." }],
        };
      }

      try {
        const res = await client.deleteContentBlock(args.article_id_or_slug, args.block_id);
        return {
          content: [
            {
              type: "text",
              text: `Block ${res.id} was successfully deleted from article "${args.article_id_or_slug}".`,
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to delete content block: ${err.message}` }],
        };
      }
    }
  );

  // 4. reorder_content_blocks
  server.tool(
    "reorder_content_blocks",
    "Reorder content blocks within an article, either by specifying an explicit ordered ID list, or by moving a single block by position (1..N) or direction ('up' / 'down').",
    {
      article_id_or_slug: z.string().describe("Article ID or slug."),
      ordered_block_ids: z.array(z.number().int().positive()).optional().describe("Array of all block IDs in desired sequence."),
      block_id: z.number().int().positive().optional().describe("Single block ID to move."),
      position: z.number().int().positive().optional().describe("1-based target position for block_id."),
      direction: z.enum(["up", "down"]).optional().describe("Move direction for block_id."),
    },
    async (args) => {
      if (client.config.readOnly) {
        return {
          isError: true,
          content: [{ type: "text", text: "Operation rejected: MacronCMS MCP server is in read-only mode." }],
        };
      }

      try {
        if (args.ordered_block_ids && args.ordered_block_ids.length > 0) {
          const res = await client.reorderContentBlocks(args.article_id_or_slug, args.ordered_block_ids);
          return {
            content: [
              {
                type: "text",
                text: `Article "${args.article_id_or_slug}" blocks reordered.\n\n${JSON.stringify(
                  res.content_blocks.map((b) => ({ id: b.id, type: b.content_type, sort_order: b.sort_order })),
                  null,
                  2
                )}`,
              },
            ],
          };
        }

        if (args.block_id && (args.position || args.direction)) {
          const res = await client.moveContentBlock(args.article_id_or_slug, args.block_id, {
            direction: args.direction,
            position: args.position,
          });
          return {
            content: [
              {
                type: "text",
                text: `Block ${args.block_id} moved ${args.direction || `to position ${args.position}`}.\n\n${JSON.stringify(
                  res.content_blocks.map((b) => ({ id: b.id, type: b.content_type, sort_order: b.sort_order })),
                  null,
                  2
                )}`,
              },
            ],
          };
        }

        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "Must provide either `ordered_block_ids` array, or `block_id` with `position` or `direction`.",
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to reorder content blocks: ${err.message}` }],
        };
      }
    }
  );

  // 5. convert_content_block
  server.tool(
    "convert_content_block",
    "Convert a content block in-place to a compatible target type (e.g. image <-> three_js_image) defined by the schema's `convertible_to` rules. Preserves existing file attachments and dormant JSON payload keys.",
    {
      article_id_or_slug: z.string().describe("Article ID or slug."),
      block_id: z.number().int().positive().describe("Content block ID to convert."),
      target_content_type: z.string().describe("Target content type name (must be in convertible_to list)."),
    },
    async (args) => {
      if (client.config.readOnly) {
        return {
          isError: true,
          content: [{ type: "text", text: "Operation rejected: MacronCMS MCP server is in read-only mode." }],
        };
      }

      try {
        const article = await client.getArticle(args.article_id_or_slug);
        const block = article.content_blocks.find((b) => b.id === args.block_id);
        if (!block) {
          throw new Error(`Block ${args.block_id} not found on article "${args.article_id_or_slug}".`);
        }

        await validator.validateConversion(block.content_type, args.target_content_type);

        const res = await client.convertContentBlock(
          args.article_id_or_slug,
          args.block_id,
          args.target_content_type
        );

        return {
          content: [
            {
              type: "text",
              text: `Block ${args.block_id} successfully converted from "${block.content_type}" to "${args.target_content_type}".\n\n${JSON.stringify(
                res.content_block,
                null,
                2
              )}`,
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to convert block: ${err.message}` }],
        };
      }
    }
  );
}
