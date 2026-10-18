/**
 * Picks a Monaco language id from a file path.
 */
export function languageForPath(path: string): string {
  if (/\.(json|tsbuildinfo)$/.test(path) || path.endsWith("tsconfig.json")) return "json";
  if (/\.[cm]?tsx?$/.test(path)) return "typescript";
  if (/\.[cm]?jsx?$/.test(path)) return "javascript";
  if (path.endsWith(".map")) return "json";
  return "plaintext";
}
