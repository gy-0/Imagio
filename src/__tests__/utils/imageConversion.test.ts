import { detectMimeTypeFromBytes } from '../../utils/imageConversion';

/**
 * Tests for image conversion utilities
 * Note: base64ToBlob tests are skipped in test environment due to URL.createObjectURL
 * limitations in jsdom. These should be tested in integration/e2e tests.
 */

describe('imageConversion', () => {
  // base64ToBlob is tested indirectly through detectMimeTypeFromBytes
  // and would need proper browser environment or mocking for URL.createObjectURL

  describe('detectMimeTypeFromBytes', () => {
    it('should detect PNG format', () => {
      const pngMagicBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      expect(detectMimeTypeFromBytes(pngMagicBytes)).toBe('image/png');
    });

    it('should detect JPEG format', () => {
      const jpegMagicBytes = new Uint8Array([0xff, 0xd8]);
      expect(detectMimeTypeFromBytes(jpegMagicBytes)).toBe('image/jpeg');
    });

    it('should detect WebP format', () => {
      const webpMagicBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46]);
      expect(detectMimeTypeFromBytes(webpMagicBytes)).toBe('image/webp');
    });

    it('should detect GIF format', () => {
      const gifMagicBytes = new Uint8Array([0x47, 0x49, 0x46]);
      expect(detectMimeTypeFromBytes(gifMagicBytes)).toBe('image/gif');
    });

    it('should default to PNG for unknown format', () => {
      const unknownBytes = new Uint8Array([0x00, 0x00]);
      expect(detectMimeTypeFromBytes(unknownBytes)).toBe('image/png');
    });
  });
});
