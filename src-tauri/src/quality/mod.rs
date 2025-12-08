//! Image quality assessment module
//!
//! Provides quality metrics for adaptive preprocessing:
//! - Blur detection (Laplacian variance)
//! - Contrast measurement (standard deviation)
//! - Noise estimation (local variance)
//! - Brightness analysis

use image::DynamicImage;
use serde::Serialize;

/// Image quality metrics for adaptive preprocessing
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ImageQualityMetrics {
    /// Sharpness score (0-100, higher is sharper)
    pub blur_score: f32,
    /// Contrast score (0-100, higher is better)
    pub contrast_score: f32,
    /// Noise level (0-100, lower is better)
    pub noise_level: f32,
    /// Average brightness (0-255)
    pub brightness_level: f32,
}

/// Assess image quality for adaptive preprocessing
///
/// Returns metrics that can be used to automatically
/// select optimal preprocessing parameters.
///
/// # Arguments
/// * `img` - The input image
///
/// # Returns
/// Quality metrics including blur, contrast, noise, and brightness scores
pub fn assess_image_quality(img: &DynamicImage) -> ImageQualityMetrics {
    let gray = img.to_luma8();
    let (width, height) = gray.dimensions();

    // 1. Blur detection using Laplacian variance
    let mut laplacian_sum = 0.0;
    for y in 1..height - 1 {
        for x in 1..width - 1 {
            let center = gray.get_pixel(x, y).0[0] as f32;

            // 3x3 Laplacian kernel
            let laplacian = -1.0 * gray.get_pixel(x - 1, y - 1).0[0] as f32
                + -1.0 * gray.get_pixel(x, y - 1).0[0] as f32
                + -1.0 * gray.get_pixel(x + 1, y - 1).0[0] as f32
                + -1.0 * gray.get_pixel(x - 1, y).0[0] as f32
                + 8.0 * center
                + -1.0 * gray.get_pixel(x + 1, y).0[0] as f32
                + -1.0 * gray.get_pixel(x - 1, y + 1).0[0] as f32
                + -1.0 * gray.get_pixel(x, y + 1).0[0] as f32
                + -1.0 * gray.get_pixel(x + 1, y + 1).0[0] as f32;
            laplacian_sum += laplacian * laplacian;
        }
    }
    let laplacian_var = laplacian_sum / ((width - 2) * (height - 2)) as f32;
    let blur_score = (laplacian_var / 1000.0).min(100.0);

    // 2. Contrast detection (standard deviation)
    let mut sum = 0.0;
    let mut sq_sum = 0.0;
    for pixel in gray.pixels() {
        let val = pixel.0[0] as f32;
        sum += val;
        sq_sum += val * val;
    }
    let pixel_count = (width * height) as f32;
    let mean = sum / pixel_count;
    let variance = sq_sum / pixel_count - mean * mean;
    let std_dev = variance.sqrt();
    let contrast_score = (std_dev / 2.55).min(100.0);

    // 3. Noise estimation (local variance)
    let mut noise_sum = 0.0;
    let window = 3;
    let sample_step = 5; // Sample every 5 pixels to speed up

    for y in (window..height - window).step_by(sample_step) {
        for x in (window..width - window).step_by(sample_step) {
            let mut local_sum = 0.0;
            let mut local_sq_sum = 0.0;
            let mut count = 0;

            for dy in -(window as i32)..=(window as i32) {
                for dx in -(window as i32)..=(window as i32) {
                    let val = gray
                        .get_pixel((x as i32 + dx) as u32, (y as i32 + dy) as u32)
                        .0[0] as f32;
                    local_sum += val;
                    local_sq_sum += val * val;
                    count += 1;
                }
            }

            let local_mean = local_sum / count as f32;
            let local_var = local_sq_sum / count as f32 - local_mean * local_mean;
            noise_sum += local_var.sqrt();
        }
    }

    let samples =
        ((height - 2 * window) / sample_step as u32) * ((width - 2 * window) / sample_step as u32);
    let noise_level = (noise_sum / samples as f32).min(100.0);

    ImageQualityMetrics {
        blur_score,
        contrast_score,
        noise_level,
        brightness_level: mean,
    }
}
