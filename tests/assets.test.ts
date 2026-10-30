import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prepareLocalFileUpload } from "../src/assets.js";

describe("prepareLocalFileUpload", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "macron-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("reads local file and returns base64 and inferred MIME type", async () => {
    const testFile = path.join(tmpDir, "sample.png");
    const testData = Buffer.from("fake-png-binary-content");
    await fs.writeFile(testFile, testData);

    const result = await prepareLocalFileUpload(testFile);
    expect(result.filename).toBe("sample.png");
    expect(result.content_type).toBe("image/png");
    expect(result.data_base64).toBe(testData.toString("base64"));
  });

  it("throws when file does not exist", async () => {
    const missing = path.join(tmpDir, "missing.jpg");
    await expect(prepareLocalFileUpload(missing)).rejects.toThrow(/Local file not found/);
  });
});
