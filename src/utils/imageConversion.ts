/**
 * Image conversion utilities
 * Handles various image format conversions needed across the application
 */

/**
 * Convert base64 string to Blob
 * Automatically detects MIME type from magic bytes
 * Handles both data URL and raw base64 formats
 */
export function base64ToBlob(base64Data: string): { blob: Blob; objectUrl: string } {
  // Remove data URL prefix if present
  let cleanBase64 = base64Data;
  const dataUrlMatch = base64Data.match(/^data:image\/[a-z]+;base64,(.+)$/i);
  if (dataUrlMatch) {
    cleanBase64 = dataUrlMatch[1];
  }

  // Convert base64 to blob
  const binaryData = atob(cleanBase64);
  const bytes = new Uint8Array(binaryData.length);
  for (let i = 0; i < binaryData.length; i++) {
    bytes[i] = binaryData.charCodeAt(i);
  }

  // Determine MIME type from magic bytes
  let mimeType = 'image/png'; // Default to PNG
  if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
    mimeType = 'image/jpeg';
  } else if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    mimeType = 'image/png';
  } else if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    mimeType = 'image/webp';
  }

  const blob = new Blob([bytes], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);

  return { blob, objectUrl };
}

/**
 * Detect image MIME type from bytes
 * Supports: JPEG, PNG, WebP, GIF
 */
export function detectMimeTypeFromBytes(bytes: Uint8Array): string {
  if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
    return 'image/jpeg';
  } else if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return 'image/png';
  } else if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    return 'image/webp';
  } else if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return 'image/gif';
  }
  return 'image/png'; // Default fallback
}
