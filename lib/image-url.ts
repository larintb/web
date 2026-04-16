const BASE = process.env.NEXT_PUBLIC_IMAGES_BASE_URL ?? '';

interface ImgOptions {
  width?:   number;
  quality?: number;
}

/**
 * Resolves an image path to a full URL.
 * - Relative paths are prefixed with NEXT_PUBLIC_IMAGES_BASE_URL.
 * - Supabase Storage URLs (/storage/v1/object/) are rewritten to the
 *   image transformation endpoint (/storage/v1/render/image/) so that
 *   Supabase serves a compressed/resized version instead of the raw file.
 */
export function imgUrl(
  path: string | null | undefined,
  { width = 800, quality = 80 }: ImgOptions = {},
): string | null {
  if (!path) return null;

  const raw = path.startsWith('http') ? path : `${BASE}/${path.replace(/^\/images\//, '')}`;

  // Rewrite Supabase object URL → render/image endpoint
  const transformed = raw.replace(
    /\/storage\/v1\/object\/(public\/)/,
    '/storage/v1/render/image/$1',
  );

  const url = new URL(transformed);
  url.searchParams.set('width',   String(width));
  url.searchParams.set('quality', String(quality));
  url.searchParams.set('format',  'webp');

  return url.toString();
}
