import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MacronCmsClient } from "../client.js";
import { SchemaValidator } from "../schema-validator.js";

export function registerSchemaTools(
  server: McpServer,
  client: MacronCmsClient,
  validator: SchemaValidator
): void {
  server.tool(
    "list_content_types",
    "List all available MacronCMS widget content types (e.g. heading, markdown, image, embed, three_js_quote), their fields, accepted dropdown options, convertible types, and featured image bubbling flags.",
    {
      refresh: z
        .boolean()
        .optional()
        .describe("Force reload fresh content type schemas from the MacronCMS server."),
    },
    async (args) => {
      try {
        const types = await validator.getContentTypes(args.refresh);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ content_types: types }, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Failed to retrieve content types: ${err.message}`,
            },
          ],
        };
      }
    }
  );
}
