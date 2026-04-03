const BASE = process.env.NEXT_PUBLIC_IMAGES_BASE_URL ?? '';

/**
 * Resolves an image path to a full URL.
 * - Full URLs (http/https) are returned as-is.
 * - Relative paths like "/images/foo.jpg" or "foo.jpg" are prefixed with
 *   the Supabase Storage base URL from NEXT_PUBLIC_IMAGES_BASE_URL.
 */
export function imgUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const filename = path.replace(/^\/images\//, '');
  return `${BASE}/${filename}`;
}
