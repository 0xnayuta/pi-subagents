import type { ExtractedContent } from "./types.ts";

export interface ExtractOptions {
  maxContentChars: number;
  contentType?: string;
}

export function truncateContent(
  content: string,
  maxContentChars: number
): Pick<ExtractedContent, "content" | "truncated"> {
  if (content.length <= maxContentChars) {
    return { content, truncated: false };
  }
  return { content: content.slice(0, maxContentChars), truncated: true };
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2f;/gi, "/");
}

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractTitle(html: string): string | undefined {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (!match) return undefined;
  const title = normalizeWhitespace(decodeHtmlEntities(match[1].replace(/<[^>]+>/g, "")));
  return title || undefined;
}

function htmlToText(html: string): string {
  const withoutNoise = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  const withBreaks = withoutNoise
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|section|article|header|footer|main|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return normalizeWhitespace(decodeHtmlEntities(withBreaks));
}

export function extractPlainText(
  url: string,
  text: string,
  options: ExtractOptions
): ExtractedContent {
  return {
    url,
    contentType: options.contentType,
    ...truncateContent(normalizeWhitespace(text), options.maxContentChars),
  };
}

export function extractHtml(url: string, html: string, options: ExtractOptions): ExtractedContent {
  return {
    url,
    title: extractTitle(html),
    contentType: options.contentType,
    ...truncateContent(htmlToText(html), options.maxContentChars),
  };
}
