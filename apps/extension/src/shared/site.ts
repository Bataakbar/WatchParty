export const SITE_ORIGIN_PATTERN = /^https:\/\/filmapik\.college\//;

export function isSupportedMediaPath(pathname: string): boolean {
  return /\/nonton-[^/]+/.test(pathname);
}

export function extractMediaId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/nonton-([^/]+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}
