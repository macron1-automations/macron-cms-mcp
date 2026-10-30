import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMacronCmsMcpServer } from "../src/server.js";

describe("MacronCmsMcpServer", () => {
  let client: Client;
  let fetchSpy: any;

  beforeEach(async () => {
    fetchSpy = vi.spyOn(globalThis, "fetch");

    const server = createMacronCmsMcpServer({
      originUrl: "http://localhost:3000",
      apiBaseUrl: "http://localhost:3000/cms/api/v1",
      apiKey: "123",
      readOnly: false,
      timeoutMs: 5000,
    });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });
    await client.connect(clientTransport);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("lists all registered tools", async () => {
    const res = await client.listTools();
    const toolNames = res.tools.map((t) => t.name);

    expect(toolNames).toContain("list_content_types");
    expect(toolNames).toContain("list_articles");
    expect(toolNames).toContain("get_article");
    expect(toolNames).toContain("create_article");
    expect(toolNames).toContain("update_article_metadata");
    expect(toolNames).toContain("replace_article_blocks");
    expect(toolNames).toContain("delete_article");
    expect(toolNames).toContain("add_content_block");
    expect(toolNames).toContain("update_content_block");
    expect(toolNames).toContain("delete_content_block");
    expect(toolNames).toContain("reorder_content_blocks");
    expect(toolNames).toContain("convert_content_block");
    expect(toolNames.length).toBe(12);
  });

  it("lists all registered resources", async () => {
    const res = await client.listResources();
    const uris = res.resources.map((r) => r.uri);

    expect(uris).toContain("macron://content-types");
    expect(uris).toContain("macron://articles");
  });

  it("lists all registered prompts", async () => {
    const res = await client.listPrompts();
    const promptNames = res.prompts.map((p) => p.name);

    expect(promptNames).toContain("import_html_article");
    expect(promptNames).toContain("draft_article");
    expect(promptNames).toContain("edit_article");
  });

  it("executes list_content_types tool successfully", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          content_types: [
            {
              id: 1,
              name: "heading",
              fields: [{ name: "title", kind: "string" }],
              convertible_to: [],
              featured_image: false,
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const result: any = await client.callTool({
      name: "list_content_types",
      arguments: {},
    });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.content_types).toHaveLength(1);
    expect(parsed.content_types[0].name).toBe("heading");
  });
});
