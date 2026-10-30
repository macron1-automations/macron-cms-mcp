import { MacronCmsClient } from "./client.js";
import { ContentType, ContentTypeField, FieldOption } from "./types.js";

export class SchemaValidator {
  private cache: ContentType[] | null = null;
  private cacheExpiresAt = 0;
  private readonly ttlMs: number;

  constructor(private readonly client: MacronCmsClient, ttlMs = 60000) {
    this.ttlMs = ttlMs;
  }

  async getContentTypes(forceRefresh = false): Promise<ContentType[]> {
    const now = Date.now();
    if (!forceRefresh && this.cache && now < this.cacheExpiresAt) {
      return this.cache;
    }

    const types = await this.client.getContentTypes();
    this.cache = types;
    this.cacheExpiresAt = now + this.ttlMs;
    return types;
  }

  async getContentType(name: string, allowRetry = true): Promise<ContentType | undefined> {
    const types = await this.getContentTypes();
    const cleanName = name.trim().toLowerCase();
    let found = types.find((t) => t.name.toLowerCase() === cleanName);

    if (!found && allowRetry) {
      const refreshed = await this.getContentTypes(true);
      found = refreshed.find((t) => t.name.toLowerCase() === cleanName);
    }

    return found;
  }

  async validateBlock(
    contentTypeName: string,
    payload: Record<string, unknown> = {},
    options: { isPartial?: boolean } = {}
  ): Promise<void> {
    const typeDef = await this.getContentType(contentTypeName);
    if (!typeDef) {
      const allTypes = (await this.getContentTypes()).map((t) => t.name);
      throw new Error(
        `Unknown content type "${contentTypeName}". Available types: [${allTypes.join(", ")}]`
      );
    }

    const fieldMap = new Map<string, ContentTypeField>();
    for (const f of typeDef.fields) {
      fieldMap.set(f.name, f);
    }

    for (const [key, val] of Object.entries(payload)) {
      if (!fieldMap.has(key)) {
        const allowed = Array.from(fieldMap.keys());
        throw new Error(
          `Unknown field "${key}" for content type "${contentTypeName}". Allowed fields: [${allowed.join(
            ", "
          )}]. (Blocked prior to API submission to prevent silent data truncation).`
        );
      }

      const field = fieldMap.get(key)!;
      if (field.kind === "dropdown" && field.options && field.options.length > 0 && val !== null && val !== undefined && val !== "") {
        const validValues = field.options.map((opt: FieldOption) =>
          typeof opt === "string" ? opt : opt.value
        );
        const validNames = field.options
          .map((opt: FieldOption) => (typeof opt === "string" ? null : opt.name))
          .filter(Boolean) as string[];

        const strVal = String(val);
        const matches = validValues.includes(strVal) || validNames.includes(strVal);

        if (!matches) {
          throw new Error(
            `Invalid value "${strVal}" for dropdown field "${key}" in content type "${contentTypeName}". Allowed option values: [${validValues.join(
              ", "
            )}]`
          );
        }
      }
    }
  }

  async validateConversion(sourceTypeName: string, targetTypeName: string): Promise<void> {
    const source = await this.getContentType(sourceTypeName);
    if (!source) {
      throw new Error(`Source content type "${sourceTypeName}" does not exist.`);
    }

    const allowedTargets = source.convertible_to || [];
    if (!allowedTargets.includes(targetTypeName)) {
      throw new Error(
        `Cannot convert block of type "${sourceTypeName}" to "${targetTypeName}". Allowed convertible types: [${allowedTargets.join(
          ", "
        ) || "none"}]`
      );
    }
  }
}
