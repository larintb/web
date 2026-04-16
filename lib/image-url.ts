const BASE = process.env.NEXT_PUBLIC_IMAGES_BASE_URL ?? '';

/**
 * Resolves an image path to a full URL.
 * - Full URLs (http/https) are returned as-is.
 * - Relative paths are prefixed with NEXT_PUBLIC_IMAGES_BASE_URL.
 *
 * Images are served directly from Supabase Storage CDN (unoptimized: true in next.config).
 * Supabase image transformation (/render/image/) requires Pro plan — not used here.
 */
export function imgUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const filename = path.replace(/^\/images\//, '');
  return `${BASE}/${filename}`;
}
