import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { ResolvedExtensionConfig } from "../shared/types.ts";

export interface WebSecurityLimits {
  timeoutMs: number;
  maxResponseBytes: number;
  maxContentChars: number;
  maxResults: number;
}

export function getWebSecurityLimits(config: ResolvedExtensionConfig): WebSecurityLimits {
  return {
    timeoutMs: config.webTools.timeoutMs,
    maxResponseBytes: config.webTools.maxResponseBytes,
    maxContentChars: config.webTools.maxContentChars,
    maxResults: config.webTools.maxResults,
  };
}

function isPrivateIPv4(address: string): boolean {
  const parts = address.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return true;
  const [a, b] = parts;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

function isPrivateIPv6(address: string): boolean {
  const normalized = address.toLowerCase();
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:192.168.")
  );
}

function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isPrivateIPv4(address);
  if (family === 6) return isPrivateIPv6(address);
  return true;
}

function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  return normalized === "localhost" || normalized.endsWith(".localhost");
}

export async function validatePublicHttpUrl(input: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error(`Invalid URL: ${input}`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Unsupported URL protocol: ${parsed.protocol}`);
  }

  if (isBlockedHostname(parsed.hostname)) {
    throw new Error(`Blocked private hostname: ${parsed.hostname}`);
  }

  if (isIP(parsed.hostname)) {
    if (isBlockedAddress(parsed.hostname)) {
      throw new Error(`Blocked private address: ${parsed.hostname}`);
    }
    return parsed;
  }

  const addresses = await lookup(parsed.hostname, { all: true, verbatim: true });
  if (addresses.length === 0) {
    throw new Error(`Unable to resolve hostname: ${parsed.hostname}`);
  }

  for (const address of addresses) {
    if (isBlockedAddress(address.address)) {
      throw new Error(`Blocked private address for ${parsed.hostname}: ${address.address}`);
    }
  }

  return parsed;
}
