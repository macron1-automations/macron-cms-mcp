import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MacronCmsClient } from "./client.js";
import { MacronCmsConfig } from "./config.js";
import { registerPrompts } from "./prompts.js";
import { registerResources } from "./resources.js";
import { registerArticleTools } from "./tools/articles.js";
import { registerBlockTools } from "./tools/blocks.js";
import { registerSchemaTools } from "./tools/schema.js";
import { SchemaValidator } from "./schema-validator.js";

export function createMacronCmsMcpServer(config: MacronCmsConfig): McpServer {
  const client = new MacronCmsClient(config);
  const validator = new SchemaValidator(client);

  const server = new McpServer({
    name: "macron-cms-mcp",
    version: "1.0.0",
  });

  registerSchemaTools(server, client, validator);
  registerArticleTools(server, client, validator);
  registerBlockTools(server, client, validator);
  registerResources(server, client, validator);
  registerPrompts(server, client, validator);

  return server;
}
