import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { parseConfig } from "./config.js";
import { createMacronCmsMcpServer } from "./server.js";

async function main() {
  try {
    const config = parseConfig(process.env);
    const server = createMacronCmsMcpServer(config);
    const transport = new StdioServerTransport();

    process.stderr.write(
      `[macron-cms-mcp] Starting server connected to ${config.apiBaseUrl} (readOnly: ${config.readOnly})\n`
    );

    await server.connect(transport);

    process.stderr.write("[macron-cms-mcp] Server ready and listening on stdio.\n");
  } catch (err: any) {
    process.stderr.write(`[macron-cms-mcp] Fatal error: ${err.message}\n`);
    process.exit(1);
  }
}

main();
