import { describe, expect, it } from "vitest";
import { parseConfig } from "../src/config.js";

describe("parseConfig", () => {
  it("throws when MACRON_CMS_URL is missing", () => {
    expect(() => parseConfig({})).toThrow(/Missing required environment variable/);
  });

  it("normalizes bare origin URL with default /cms mount", () => {
    const config = parseConfig({ MACRON_CMS_URL: "http://localhost:3000" });
    expect(config.originUrl).toBe("http://localhost:3000");
    expect(config.apiBaseUrl).toBe("http://localhost:3000/cms/api/v1");
    expect(config.readOnly).toBe(false);
    expect(config.timeoutMs).toBe(30000);
  });

  it("normalizes URL already ending with /cms", () => {
    const config = parseConfig({ MACRON_CMS_URL: "http://localhost:3000/cms" });
    expect(config.originUrl).toBe("http://localhost:3000");
    expect(config.apiBaseUrl).toBe("http://localhost:3000/cms/api/v1");
  });

  it("normalizes URL already ending with /api/v1", () => {
    const config = parseConfig({ MACRON_CMS_URL: "https://example.com/cms/api/v1" });
    expect(config.originUrl).toBe("https://example.com");
    expect(config.apiBaseUrl).toBe("https://example.com/cms/api/v1");
  });

  it("parses API key, custom mount path, and readOnly flag", () => {
    const config = parseConfig({
      MACRON_CMS_URL: "http://localhost:8080",
      MACRON_CMS_MOUNT_PATH: "/custom_cms",
      MACRON_CMS_API_KEY: "secret-token",
      MACRON_CMS_READ_ONLY: "true",
      MACRON_CMS_TIMEOUT_MS: "5000",
    });
    expect(config.apiBaseUrl).toBe("http://localhost:8080/custom_cms/api/v1");
    expect(config.apiKey).toBe("secret-token");
    expect(config.readOnly).toBe(true);
    expect(config.timeoutMs).toBe(5000);
  });
});
