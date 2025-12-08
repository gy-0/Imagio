//! Noise reduction filters for image preprocessing

use image::{DynamicImage, GenericImageView, ImageBuffer, Rgba};

/// Apply Gaussian blur for noise reduction
///
/// # Arguments
/// * `img` - The input image
/// * `sigma` - Standard deviation for Gaussian kernel
///
/// # Returns
/// A new blurred image
pub fn apply_gaussian_blur(img: &DynamicImage, sigma: f32) -> DynamicImage {
    use imageproc::filter::gaussian_blur_f32;

    let rgba = img.to_rgba8();
    let (width, height) = rgba.dimensions();

    // Process each channel separately
    let mut output: ImageBuffer<Rgba<u8>, Vec<u8>> = ImageBuffer::new(width, height);

    // Initialize with zeros
    for y in 0..height {
        for x in 0..width {
            output.put_pixel(x, y, Rgba([0, 0, 0, 255]));
        }
    }

    for c in 0..3 {
        let mut channel = ImageBuffer::new(width, height);
        for (x, y, pixel) in rgba.enumerate_pixels() {
            channel.put_pixel(x, y, image::Luma([pixel.0[c]]));
        }

        let blurred = gaussian_blur_f32(&channel, sigma);

        for (x, y, pixel) in blurred.enumerate_pixels() {
            let current = output.get_pixel(x, y).0;
            let mut new_pixel = current;
            new_pixel[c] = pixel.0[0];
            output.put_pixel(x, y, Rgba(new_pixel));
        }
    }

    // Copy alpha channel
    for (x, y, pixel) in rgba.enumerate_pixels() {
        let mut current = output.get_pixel(x, y).0;
        current[3] = pixel.0[3];
        output.put_pixel(x, y, Rgba(current));
    }

    DynamicImage::ImageRgba8(output)
}

/// Apply bilateral filter (simplified edge-preserving blur)
///
/// Bilateral filtering preserves edges while reducing noise,
/// making it ideal for text document preprocessing.
///
/// # Arguments
/// * `img` - The input image
///
/// # Returns
/// A new filtered image with reduced noise but preserved edges
pub fn apply_bilateral_filter(img: &DynamicImage) -> DynamicImage {
    let (width, height) = img.dimensions();
    let mut output = ImageBuffer::new(width, height);
    let radius = 5;
    let sigma_color = 75.0;
    let sigma_space = 75.0;

    for y in 0..height {
        for x in 0..width {
            let center = img.get_pixel(x, y);
            let mut sum = [0.0_f32; 4];
            let mut weight_sum = 0.0_f32;

            for dy in -(radius as i32)..=(radius as i32) {
                for dx in -(radius as i32)..=(radius as i32) {
                    let nx = (x as i32 + dx).clamp(0, width as i32 - 1) as u32;
                    let ny = (y as i32 + dy).clamp(0, height as i32 - 1) as u32;
                    let neighbor = img.get_pixel(nx, ny);

                    // Spatial distance
                    let space_dist = ((dx * dx + dy * dy) as f32).sqrt();
                    let space_weight =
                        (-space_dist * space_dist / (2.0 * sigma_space * sigma_space)).exp();

                    // Color distance
                    let color_dist = ((center.0[0] as f32 - neighbor.0[0] as f32).powi(2)
                        + (center.0[1] as f32 - neighbor.0[1] as f32).powi(2)
                        + (center.0[2] as f32 - neighbor.0[2] as f32).powi(2))
                    .sqrt();
                    let color_weight =
                        (-color_dist * color_dist / (2.0 * sigma_color * sigma_color)).exp();

                    let weight = space_weight * color_weight;
                    weight_sum += weight;

                    for i in 0..4 {
                        sum[i] += neighbor.0[i] as f32 * weight;
                    }
                }
            }

            let result = [
                (sum[0] / weight_sum) as u8,
                (sum[1] / weight_sum) as u8,
                (sum[2] / weight_sum) as u8,
                (sum[3] / weight_sum) as u8,
            ];
            output.put_pixel(x, y, Rgba(result));
        }
    }

    DynamicImage::ImageRgba8(output)
}
