/**
 * Sanitizes a filename to prevent path traversal and remove dangerous characters.
 * Keeps only alphanumeric characters, hyphens, underscores, and a single dot for extension.
 */
export function sanitizeFilename(filename: string): string {
  // Strip path separators and null bytes
  const stripped = filename.replace(/[/\\?%*:|"<>\x00]/g, '');

  // Split on last dot to isolate extension
  const lastDot = stripped.lastIndexOf('.');
  const name = lastDot >= 0 ? stripped.slice(0, lastDot) : stripped;
  const ext = lastDot >= 0 ? stripped.slice(lastDot + 1) : '';

  // Sanitize name: keep alphanumeric, hyphens, underscores, spaces (replaced with _)
  const safeName = name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '') || 'file';
  const safeExt = ext.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

  return safeExt ? `${safeName}.${safeExt}` : safeName;
}

/**
 * Allowed 3D printing file formats (MIME-like format identifiers).
 */
export const ALLOWED_PRINT_FORMATS = ['stl', 'obj', '3mf', 'gcode', 'step', 'stp', 'iges', 'igs', 'amf'] as const;
export type PrintFormat = (typeof ALLOWED_PRINT_FORMATS)[number];

export function isAllowedPrintFormat(format: string): format is PrintFormat {
  return ALLOWED_PRINT_FORMATS.includes(format.toLowerCase() as PrintFormat);
}
