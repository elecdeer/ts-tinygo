import { PROJECT_DIR } from "./runner";

/**
 * Normalizes a path printed by tsc into a project-relative path.
 */
export function toProjectPath(path: string): string {
  let normalized = path.replace(/\\/g, "/");
  if (normalized.startsWith(`${PROJECT_DIR}/`)) normalized = normalized.slice(PROJECT_DIR.length + 1);
  while (normalized.startsWith("./")) normalized = normalized.slice(2);
  return normalized;
}

/**
 * Validates a user-entered file name, returning an error message or undefined when valid.
 */
export function validateFileName(name: string, existing: readonly string[]): string | undefined {
  const trimmed = name.trim();
  if (trimmed === "") return "File name is empty";
  if (trimmed.startsWith("/") || trimmed.split("/").some((s) => s === ".." || s === "")) {
    return "Use a relative path without '..' or empty segments";
  }
  if (existing.includes(trimmed)) return `${trimmed} already exists`;
  return undefined;
}
