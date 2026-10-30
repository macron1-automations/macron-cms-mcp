import { describe, expect, it, vi } from "vitest";
import { MacronCmsClient } from "../src/client.js";
import { SchemaValidator } from "../src/schema-validator.js";
import { ContentType } from "../src/types.js";

const mockContentTypes: ContentType[] = [
  {
    id: 1,
    name: "heading",
    fields: [
      { name: "title", kind: "string" },
      {
        name: "level",
        kind: "dropdown",
        options: [
          { name: "Heading 1", value: "h1" },
          { name: "Heading 2", value: "h2" },
        ],
      },
      { name: "color", kind: "color" },
    ],
    convertible_to: [],
    featured_image: false,
  },
  {
    id: 2,
    name: "image",
    fields: [
      { name: "upload", kind: "file" },
      { name: "size", kind: "dropdown", options: ["sm", "md", "lg", "full"] },
    ],
    convertible_to: ["three_js_image"],
    featured_image: true,
  },
];

describe("SchemaValidator", () => {
  function createValidator() {
    const client = {
      getContentTypes: vi.fn().mockResolvedValue(mockContentTypes),
    } as unknown as MacronCmsClient;
    return new SchemaValidator(client);
  }

  it("allows valid fields and valid dropdown option values", async () => {
    const validator = createValidator();
    await expect(
      validator.validateBlock("heading", { title: "Hello", level: "h1" })
    ).resolves.toBeUndefined();
  });

  it("allows dropdown matching by option label/name", async () => {
    const validator = createValidator();
    await expect(
      validator.validateBlock("heading", { title: "Hello", level: "Heading 2" })
    ).resolves.toBeUndefined();
  });

  it("rejects unknown payload keys with allowed list hint", async () => {
    const validator = createValidator();
    await expect(
      validator.validateBlock("heading", { title: "Hello", text: "Invalid Key" })
    ).rejects.toThrow(/Unknown field "text" for content type "heading". Allowed fields: \[title, level, color\]/);
  });

  it("rejects invalid dropdown values", async () => {
    const validator = createValidator();
    await expect(
      validator.validateBlock("heading", { title: "Hello", level: "h7" })
    ).rejects.toThrow(/Invalid value "h7" for dropdown field "level"/);
  });

  it("validates convertible_to rules", async () => {
    const validator = createValidator();
    await expect(validator.validateConversion("image", "three_js_image")).resolves.toBeUndefined();
    await expect(validator.validateConversion("heading", "image")).rejects.toThrow(
      /Cannot convert block of type "heading" to "image"/
    );
  });
});
