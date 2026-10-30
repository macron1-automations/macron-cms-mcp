import { MacronCmsConfig } from "./config.js";
import {
  ArticleListResponse,
  ArticleWithBlocks,
  ContentBlock,
  ContentType,
  FileAttachment,
} from "./types.js";

export class MacronCmsClient {
  constructor(public readonly config: MacronCmsConfig) {}

  private resolveUrl(relativeOrAbsoluteUrl?: string | null): string | undefined {
    if (!relativeOrAbsoluteUrl) return undefined;
    if (relativeOrAbsoluteUrl.startsWith("http://") || relativeOrAbsoluteUrl.startsWith("https://")) {
      return relativeOrAbsoluteUrl;
    }
    const cleanOrigin = this.config.originUrl.replace(/\/+$/, "");
    const cleanPath = relativeOrAbsoluteUrl.startsWith("/")
      ? relativeOrAbsoluteUrl
      : `/${relativeOrAbsoluteUrl}`;
    return `${cleanOrigin}${cleanPath}`;
  }

  private normalizeAttachment(file?: FileAttachment | null): FileAttachment | null | undefined {
    if (!file) return file;
    return {
      ...file,
      url: this.resolveUrl(file.url) || file.url,
    };
  }

  private normalizeArticle(article: any): any {
    if (!article) return article;
    return {
      ...article,
      featured_image: this.normalizeAttachment(article.featured_image),
      background_image: this.normalizeAttachment(article.background_image),
    };
  }

  private normalizeBlock(block: any): any {
    if (!block) return block;
    return {
      ...block,
      attached_file: this.normalizeAttachment(block.attached_file),
    };
  }

  async request<T>(endpointPath: string, options: RequestInit = {}): Promise<T> {
    const url = endpointPath.startsWith("http")
      ? endpointPath
      : `${this.config.apiBaseUrl}${endpointPath.startsWith("/") ? "" : "/"}${endpointPath}`;

    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
      ...(options.headers as Record<string, string>),
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      const text = await response.text();
      let data: any;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { raw: text };
      }

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(
            `Authentication failed (401 Unauthorized): ${data.error || "Missing or invalid API key. Set MACRON_CMS_API_KEY."}`
          );
        }
        if (response.status === 404) {
          throw new Error(`Resource not found (404): ${data.error || "The requested article or block was not found."}`);
        }
        if (response.status === 422) {
          const errList = Array.isArray(data.errors) ? data.errors.join("; ") : data.error || JSON.stringify(data);
          throw new Error(`Validation failed (422 Unprocessable Entity): ${errList}`);
        }
        throw new Error(`MacronCMS API request failed with status ${response.status}: ${data.error || text || response.statusText}`);
      }

      return data as T;
    } catch (err: any) {
      if (err.name === "AbortError") {
        throw new Error(`MacronCMS API request timed out after ${this.config.timeoutMs}ms: ${url}`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async getContentTypes(): Promise<ContentType[]> {
    const res = await this.request<{ content_types: ContentType[] }>("/content_types");
    return res.content_types || [];
  }

  async listArticles(params?: {
    q?: string;
    page?: number;
    per_page?: number;
    include_blocks?: boolean;
  }): Promise<ArticleListResponse> {
    const query = new URLSearchParams();
    if (params?.q) query.set("q", params.q);
    if (params?.page) query.set("page", params.page.toString());
    if (params?.per_page) query.set("per_page", params.per_page.toString());
    if (params?.include_blocks) query.set("include_blocks", "true");

    const qs = query.toString();
    const res = await this.request<ArticleListResponse>(`/articles${qs ? `?${qs}` : ""}`);

    return {
      ...res,
      articles: (res.articles || []).map((art) => ({
        ...this.normalizeArticle(art),
        content_blocks: art.content_blocks?.map((b) => this.normalizeBlock(b)),
      })),
    };
  }

  async getArticle(idOrSlug: string | number): Promise<ArticleWithBlocks> {
    const res = await this.request<ArticleWithBlocks>(`/articles/${encodeURIComponent(idOrSlug)}`);
    return {
      article: this.normalizeArticle(res.article),
      content_blocks: (res.content_blocks || []).map((b) => this.normalizeBlock(b)),
    };
  }

  async createArticle(body: Record<string, unknown>): Promise<ArticleWithBlocks> {
    const res = await this.request<ArticleWithBlocks>("/articles", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return {
      article: this.normalizeArticle(res.article),
      content_blocks: (res.content_blocks || []).map((b) => this.normalizeBlock(b)),
    };
  }

  async updateArticle(idOrSlug: string | number, body: Record<string, unknown>): Promise<ArticleWithBlocks> {
    const res = await this.request<ArticleWithBlocks>(`/articles/${encodeURIComponent(idOrSlug)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    return {
      article: this.normalizeArticle(res.article),
      content_blocks: (res.content_blocks || []).map((b) => this.normalizeBlock(b)),
    };
  }

  async deleteArticle(idOrSlug: string | number): Promise<{ deleted: boolean; id: number; slug: string }> {
    return this.request<{ deleted: boolean; id: number; slug: string }>(
      `/articles/${encodeURIComponent(idOrSlug)}`,
      {
        method: "DELETE",
      }
    );
  }

  async addContentBlock(
    articleIdOrSlug: string | number,
    block: Record<string, unknown>
  ): Promise<{ content_block: ContentBlock; article_id: number; blocks_count: number }> {
    const res = await this.request<{
      content_block: ContentBlock;
      article_id: number;
      blocks_count: number;
    }>(`/articles/${encodeURIComponent(articleIdOrSlug)}/content_blocks`, {
      method: "POST",
      body: JSON.stringify(block),
    });
    return {
      ...res,
      content_block: this.normalizeBlock(res.content_block),
    };
  }

  async updateContentBlock(
    articleIdOrSlug: string | number,
    blockId: number,
    block: Record<string, unknown>
  ): Promise<{ content_block: ContentBlock }> {
    const res = await this.request<{ content_block: ContentBlock }>(
      `/articles/${encodeURIComponent(articleIdOrSlug)}/content_blocks/${blockId}`,
      {
        method: "PATCH",
        body: JSON.stringify(block),
      }
    );
    return {
      content_block: this.normalizeBlock(res.content_block),
    };
  }

  async deleteContentBlock(
    articleIdOrSlug: string | number,
    blockId: number
  ): Promise<{ deleted: boolean; id: number }> {
    return this.request<{ deleted: boolean; id: number }>(
      `/articles/${encodeURIComponent(articleIdOrSlug)}/content_blocks/${blockId}`,
      {
        method: "DELETE",
      }
    );
  }

  async reorderContentBlocks(
    articleIdOrSlug: string | number,
    orderedIds: number[]
  ): Promise<{ content_blocks: ContentBlock[] }> {
    const res = await this.request<{ content_blocks: ContentBlock[] }>(
      `/articles/${encodeURIComponent(articleIdOrSlug)}/content_blocks/reorder`,
      {
        method: "PATCH",
        body: JSON.stringify({ ordered_ids: orderedIds }),
      }
    );
    return {
      content_blocks: (res.content_blocks || []).map((b) => this.normalizeBlock(b)),
    };
  }

  async moveContentBlock(
    articleIdOrSlug: string | number,
    blockId: number,
    opts: { direction?: "up" | "down"; position?: number }
  ): Promise<{ content_blocks: ContentBlock[] }> {
    const res = await this.request<{ content_blocks: ContentBlock[] }>(
      `/articles/${encodeURIComponent(articleIdOrSlug)}/content_blocks/${blockId}/move`,
      {
        method: "PATCH",
        body: JSON.stringify(opts),
      }
    );
    return {
      content_blocks: (res.content_blocks || []).map((b) => this.normalizeBlock(b)),
    };
  }

  async convertContentBlock(
    articleIdOrSlug: string | number,
    blockId: number,
    targetContentType: string
  ): Promise<{ content_block: ContentBlock }> {
    const res = await this.request<{ content_block: ContentBlock }>(
      `/articles/${encodeURIComponent(articleIdOrSlug)}/content_blocks/${blockId}/convert`,
      {
        method: "PATCH",
        body: JSON.stringify({ target_content_type: targetContentType }),
      }
    );
    return {
      content_block: this.normalizeBlock(res.content_block),
    };
  }
}
