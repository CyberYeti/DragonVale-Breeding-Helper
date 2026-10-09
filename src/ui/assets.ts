// URLs for the files under public/ (snapshot images, icons).

/**
 * A snapshot image path (relative, under public/) as a URL that works under
 * Vite's `base`. Paths that already carry a scheme (data:, https:) pass through.
 */
export function assetUrl(path: string): string {
  return /^[a-z][a-z0-9+.-]*:/i.test(path) ? path : import.meta.env.BASE_URL + path.replace(/^\/+/, '');
}
