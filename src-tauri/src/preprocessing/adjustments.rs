//! Image brightness, contrast, and sharpness adjustments

use image::{DynamicImage, GenericImageView, ImageBuffer, Rgba};

/// Adjust image brightness
///
/// # Arguments
/// * `img` - The input image
/// * `brightness` - Brightness adjustment value (-1.0 to 1.0)
///
/// # Returns
/// A new image with adjusted brightness
pub fn adjust_brightness(img: &DynamicImage, brightness: f32) -> DynamicImage {
    let (width, height) = img.dimensions();
    let mut output = ImageBuffer::new(width, height);

    for (x, y, pixel) in img.pixels() {
        let rgba = pixel.0;
        let adjusted = [
            (rgba[0] as f32 + brightness * 255.0).clamp(0.0, 255.0) as u8,
            (rgba[1] as f32 + brightness * 255.0).clamp(0.0, 255.0) as u8,
            (rgba[2] as f32 + brightness * 255.0).clamp(0.0, 255.0) as u8,
            rgba[3],
        ];
        output.put_pixel(x, y, Rgba(adjusted));
    }

    DynamicImage::ImageRgba8(output)
}

/// Adjust image contrast using standard formula
///
/// # Arguments
/// * `img` - The input image
/// * `contrast` - Contrast factor (> 1.0 increases, < 1.0 decreases)
///
/// # Returns
/// A new image with adjusted contrast
pub fn adjust_contrast(img: &DynamicImage, contrast: f32) -> DynamicImage {
    let (width, height) = img.dimensions();
    let mut output = ImageBuffer::new(width, height);

    // Standard contrast adjustment: new_value = (old_value - 128) * contrast + 128
    for (x, y, pixel) in img.pixels() {
        let rgba = pixel.0;
        let adjusted = [
            ((rgba[0] as f32 - 128.0) * contrast + 128.0).clamp(0.0, 255.0) as u8,
            ((rgba[1] as f32 - 128.0) * contrast + 128.0).clamp(0.0, 255.0) as u8,
            ((rgba[2] as f32 - 128.0) * contrast + 128.0).clamp(0.0, 255.0) as u8,
            rgba[3],
        ];
        output.put_pixel(x, y, Rgba(adjusted));
    }

    DynamicImage::ImageRgba8(output)
}

/// Adjust image sharpness using unsharp mask technique
///
/// # Arguments
/// * `img` - The input image
/// * `sharpness` - Sharpness factor (1.0 = no change, > 1.0 increases sharpness)
///
/// # Returns
/// A new image with adjusted sharpness
pub fn adjust_sharpness(img: &DynamicImage, sharpness: f32) -> DynamicImage {
    if sharpness <= 0.0 {
        return img.clone();
    }

    let (width, height) = img.dimensions();
    let mut output = ImageBuffer::new(width, height);
    let amount = (sharpness - 1.0) * 2.0; // Scale the sharpness factor

    for y in 1..height - 1 {
        for x in 1..width - 1 {
            let center = img.get_pixel(x, y).0;

            // Simple sharpening kernel (center weighted)
            let mut sharp = [0.0; 4];
            for i in 0..3 {
                let sum = img.get_pixel(x - 1, y).0[i] as f32
                    + img.get_pixel(x + 1, y).0[i] as f32
                    + img.get_pixel(x, y - 1).0[i] as f32
                    + img.get_pixel(x, y + 1).0[i] as f32;
                let avg = sum / 4.0;
                sharp[i] = (center[i] as f32 + amount * (center[i] as f32 - avg)).clamp(0.0, 255.0);
            }
            sharp[3] = center[3] as f32;

            output.put_pixel(
                x,
                y,
                Rgba([
                    sharp[0] as u8,
                    sharp[1] as u8,
                    sharp[2] as u8,
                    sharp[3] as u8,
                ]),
            );
        }
    }

    // Copy edges
    for x in 0..width {
        let top_pixel = img.get_pixel(x, 0);
        let bottom_pixel = img.get_pixel(x, height - 1);
        output.put_pixel(x, 0, Rgba(top_pixel.0));
        output.put_pixel(x, height - 1, Rgba(bottom_pixel.0));
    }
    for y in 0..height {
        let left_pixel = img.get_pixel(0, y);
        let right_pixel = img.get_pixel(width - 1, y);
        output.put_pixel(0, y, Rgba(left_pixel.0));
        output.put_pixel(width - 1, y, Rgba(right_pixel.0));
    }

    DynamicImage::ImageRgba8(output)
}
