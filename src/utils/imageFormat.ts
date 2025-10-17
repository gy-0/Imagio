/**
 * Utility functions for detecting and handling image formats
 */

export type ImageFormat = 'jpg' | 'png' | 'webp';

/**
 * Detect image format from magic bytes
 * @param bytes - First bytes of the image file
 * @param mimeType - Optional MIME type as fallback
 * @returns The detected image format extension
 */
export function detectImageFormat(bytes: Uint8Array, mimeType?: string): ImageFormat {
  if (bytes.length < 12) {
    // Not enough bytes to detect, fall back to MIME type
    return detectFormatFromMimeType(mimeType);
  }

  // JPEG magic bytes: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return 'jpg';
  }

  // PNG magic bytes: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return 'png';
  }

  // WebP magic bytes: RIFF ... WEBP
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return 'webp';
  }

  // Fallback to MIME type if magic bytes don't match known formats
  return detectFormatFromMimeType(mimeType);
}

/**
 * Detect format from MIME type string
 * @param mimeType - The MIME type string (e.g., 'image/jpeg')
 * @returns The detected image format extension
 */
function detectFormatFromMimeType(mimeType?: string): ImageFormat {
  if (!mimeType) {
    return 'png'; // Default fallback
  }

  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
    return 'jpg';
  }

  if (mimeType.includes('webp')) {
    return 'webp';
  }

  return 'png'; // Default fallback
}

/**
 * Generate a timestamped filename with the correct extension
 * @param format - The image format
 * @param prefix - Optional prefix for the filename
 * @returns A filename string
 */
export function generateImageFilename(format: ImageFormat, prefix: string = 'imagio'): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${prefix}-${timestamp}.${format}`;
}
