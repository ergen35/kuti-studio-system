const UNIX_ABSOLUTE_PATH_PATTERN = /(^|[\s"'`(])((?:\/(?:[^/\s"'`]+)){2,})/g;
const WINDOWS_ABSOLUTE_PATH_PATTERN = /(^|[\s"'`(])([A-Za-z]:\\(?:[^\\\s"'`]+\\){1,}[^\\\s"'`]+)/g;
const FILE_URL_PATTERN = /file:\/\/\/[^\s"'`]+/g;

const SAFE_UNIX_PREFIXES = ["/api/", "/projects/"];

function shouldKeepUnixPath(path: string): boolean {
  return SAFE_UNIX_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function redactUnixPaths(value: string): string {
  return value.replace(UNIX_ABSOLUTE_PATH_PATTERN, (match, prefix, path) => {
    if (shouldKeepUnixPath(path)) {
      return `${prefix}${path}`;
    }

    return `${prefix}[redacted-path]`;
  });
}

function redactWindowsPaths(value: string): string {
  return value.replace(WINDOWS_ABSOLUTE_PATH_PATTERN, (match, prefix, path) => `${prefix}[redacted-path]`);
}

export function redactSensitivePaths(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return redactWindowsPaths(redactUnixPaths(value).replace(FILE_URL_PATTERN, "file://[redacted-path]"));
}
