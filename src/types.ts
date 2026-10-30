export interface FieldOptionObject {
  name: string;
  value: string;
}

export type FieldOption = string | FieldOptionObject;

export interface ContentTypeField {
  name: string;
  kind: string;
  options?: FieldOption[];
}

export interface ContentType {
  id: number;
  name: string;
  fields: ContentTypeField[];
  convertible_to: string[];
  featured_image: boolean;
}

export interface FileAttachment {
  filename: string;
  content_type: string;
  byte_size: number;
  url: string;
}

export interface BackgroundOptions {
  repeat?: "no-repeat" | "repeat" | "repeat-x" | "repeat-y";
  size?: "cover" | "contain" | "auto";
  position?: "center" | "top" | "bottom" | "left" | "right";
  attachment?: "scroll" | "fixed";
}

export interface ArticleMetadata {
  id: number;
  title: string;
  slug: string;
  published_at?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  background_color?: string | null;
  text_color?: string | null;
  background_options?: BackgroundOptions;
  featured_image?: FileAttachment | null;
  background_image?: FileAttachment | null;
  blocks_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ContentBlock {
  id: number;
  content_type: string;
  sort_order: number;
  payload: Record<string, unknown>;
  attached_file?: FileAttachment;
}

export interface ArticleWithBlocks {
  article: ArticleMetadata;
  content_blocks: ContentBlock[];
}

export interface ArticleListResponse {
  articles: (ArticleMetadata & { content_blocks?: ContentBlock[] })[];
  meta: {
    page: number;
    per_page: number;
    total_count: number;
    total_pages: number;
  };
}

export interface InlineFileUpload {
  filename: string;
  content_type: string;
  data_base64: string;
}

export interface ContentBlockInput {
  id?: number;
  content_type: string;
  sort_order?: number;
  payload?: Record<string, unknown>;
  replace_payload?: boolean;
  purge_attachment?: boolean;
  file_url?: string;
  file_path?: string;
  file_upload?: InlineFileUpload;
}
