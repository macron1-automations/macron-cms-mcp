import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MacronCmsClient } from "./client.js";
import { SchemaValidator } from "./schema-validator.js";

export function registerResources(
  server: McpServer,
  client: MacronCmsClient,
  validator: SchemaValidator
): void {
  // 1. Content types dictionary
  server.resource(
    "content-types",
    "macron://content-types",
    {
      description: "Live schema dictionary of all registered MacronCMS content block types and allowed options.",
      mimeType: "application/json",
    },
    async (uri) => {
      const types = await validator.getContentTypes();
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(types, null, 2),
          },
        ],
      };
    }
  );

  // 2. Recent articles feed
  server.resource(
    "articles",
    "macron://articles",
    {
      description: "List of recently published MacronCMS articles.",
      mimeType: "application/json",
    },
    async (uri) => {
      const list = await client.listArticles({ per_page: 50 });
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(list, null, 2),
          },
        ],
      };
    }
  );

  // 3. Article template by ID or slug
  server.resource(
    "article-by-slug",
    new ResourceTemplate("macron://articles/{slug}", { list: undefined }),
    {
      description: "Complete article JSON payload including all ordered content blocks and asset links.",
      mimeType: "application/json",
    },
    async (uri, { slug }) => {
      const slugStr = Array.isArray(slug) ? slug[0] : slug;
      const article = await client.getArticle(slugStr);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(article, null, 2),
          },
        ],
      };
    }
  );
}
