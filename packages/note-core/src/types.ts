export type OutputFormat = "json" | "md";

export interface NoteCoreConfig {
  baseUrl?: string;
  cookie?: string;
  xsrfToken?: string;
  userId?: string;
}

export interface SearchOptions {
  query: string;
  size?: number;
  start?: number;
  sort?: "new" | "popular" | "hot";
}
