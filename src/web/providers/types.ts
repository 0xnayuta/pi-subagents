import type {
  WebSearchProviderName as ConfiguredWebSearchProviderName,
  ResolvedExtensionConfig,
} from "../../shared/types.ts";
import type { SearchResultItem } from "../types.ts";

export type WebSearchProviderName = Exclude<ConfiguredWebSearchProviderName, "auto">;

export interface ProviderSearchParams {
  query: string;
  numResults: number;
  signal?: AbortSignal;
}

export interface SearchProviderAdapter {
  name: WebSearchProviderName;
  isAvailable?(config: ResolvedExtensionConfig): boolean | Promise<boolean>;
  search(
    params: ProviderSearchParams,
    config: ResolvedExtensionConfig
  ): Promise<SearchResultItem[]>;
}
