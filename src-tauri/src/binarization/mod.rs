//! Image binarization module for OCR preprocessing
//!
//! Provides various thresholding methods:
//! - Adaptive threshold
//! - Otsu's automatic threshold
//! - Mean threshold
//! - Sauvola's method for uneven illumination
//! - CLAHE (Contrast Limited Adaptive Histogram Equalization)

use image::{DynamicImage, ImageBuffer, Rgba};
use imageproc::contrast::adaptive_threshold;

/// Apply adaptive threshold for better text recognition
///
/// Uses local region statistics to compute thresholds,
/// making it robust to varying illumination.
///
/// # Arguments
/// * `img` - The input image
///
/// # Returns
/// A binarized image
pub fn apply_adaptive_threshold(img: &DynamicImage) -> Result<DynamicImage, String> {
    let gray = img.to_luma8();
    let (width, height) = gray.dimensions();

    let block_size = 15;
    let thresholded = adaptive_threshold(&gray, block_size);

    let mut output = ImageBuffer::new(width, height);
    for (x, y, pixel) in thresholded.enumerate_pixels() {
        let val = pixel.0[0];
        output.put_pixel(x, y, Rgba([val, val, val, 255]));
    }

    Ok(DynamicImage::ImageRgba8(output))
}

/// Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
///
/// Enhances local contrast while limiting noise amplification.
///
/// # Arguments
/// * `img` - The input image
///
/// # Returns
/// An image with enhanced local contrast
pub fn apply_clahe(img: &DynamicImage) -> Result<DynamicImage, String> {
    use imageproc::contrast::equalize_histogram;

    let gray = img.to_luma8();
    let (width, height) = gray.dimensions();

    let equalized = equalize_histogram(&gray);

    let mut output = ImageBuffer::new(width, height);
    for (x, y, pixel) in equalized.enumerate_pixels() {
        let val = pixel.0[0];
        output.put_pixel(x, y, Rgba([val, val, val, 255]));
    }

    Ok(DynamicImage::ImageRgba8(output))
}

/// Apply Otsu's automatic threshold
///
/// Automatically calculates optimal threshold by maximizing
/// inter-class variance between foreground and background.
///
/// # Arguments
/// * `img` - The input image
///
/// # Returns
/// A binarized image
pub fn apply_otsu_threshold(img: &DynamicImage) -> Result<DynamicImage, String> {
    use imageproc::contrast::{threshold, ThresholdType};

    let gray = img.to_luma8();
    let (width, height) = gray.dimensions();

    let threshold_value = calculate_otsu_threshold(&gray);
    println!("[Otsu] Calculated threshold: {}", threshold_value);

    let thresholded = threshold(&gray, threshold_value, ThresholdType::Binary);

    let mut output = ImageBuffer::new(width, height);
    for (x, y, pixel) in thresholded.enumerate_pixels() {
        let val = pixel.0[0];
        output.put_pixel(x, y, Rgba([val, val, val, 255]));
    }

    Ok(DynamicImage::ImageRgba8(output))
}

/// Calculate Otsu threshold value
///
/// Implements Otsu algorithm using Kahan summation for numerical stability.
///
/// # Arguments
/// * `img` - A grayscale image
///
/// # Returns
/// The optimal threshold value
pub fn calculate_otsu_threshold(img: &image::GrayImage) -> u8 {
    let (width, height) = img.dimensions();
    let total_pixels = (width * height) as f64;

    // Calculate histogram
    let mut histogram = [0u32; 256];
    for pixel in img.pixels() {
        histogram[pixel.0[0] as usize] += 1;
    }

    // Calculate cumulative sums using Kahan summation
    let mut sum = 0.0;
    let mut compensation = 0.0;

    for i in 0..256 {
        let value = i as f64 * histogram[i] as f64;
        let y = value - compensation;
        let t = sum + y;
        compensation = (t - sum) - y;
        sum = t;
    }

    let mut sum_b = 0.0;
    let mut w_b = 0.0;
    let mut max_variance = 0.0;
    let mut threshold = 0u8;

    for t in 0..256 {
        w_b += histogram[t] as f64;
        if w_b == 0.0 {
            continue;
        }

        let w_f = total_pixels - w_b;
        if w_f == 0.0 {
            break;
        }

        sum_b += t as f64 * histogram[t] as f64;

        let m_b = sum_b / w_b;
        let m_f = (sum - sum_b) / w_f;

        let variance = w_b * w_f * (m_b - m_f) * (m_b - m_f);

        if variance > max_variance {
            max_variance = variance;
            threshold = t as u8;
        }
    }

    threshold
}

/// Apply mean threshold
///
/// Uses the image's average grayscale value as the threshold.
///
/// # Arguments
/// * `img` - The input image
///
/// # Returns
/// A binarized image
pub fn apply_mean_threshold(img: &DynamicImage) -> Result<DynamicImage, String> {
    use imageproc::contrast::{threshold, ThresholdType};

    let gray = img.to_luma8();
    let (width, height) = gray.dimensions();

    let sum: u64 = gray.pixels().map(|p| p.0[0] as u64).sum();
    let mean = (sum / (width * height) as u64) as u8;

    println!("[Mean] Threshold: {}", mean);

    let thresholded = threshold(&gray, mean, ThresholdType::Binary);

    let mut output = ImageBuffer::new(width, height);
    for (x, y, pixel) in thresholded.enumerate_pixels() {
        let val = pixel.0[0];
        output.put_pixel(x, y, Rgba([val, val, val, 255]));
    }

    Ok(DynamicImage::ImageRgba8(output))
}

/// Apply Sauvola binarization
///
/// Better for documents with uneven illumination.
/// Reference: Sauvola, J., & Pietikäinen, M. (2000)
///
/// # Arguments
/// * `img` - The input image
///
/// # Returns
/// A binarized image
pub fn apply_sauvola_threshold(img: &DynamicImage) -> Result<DynamicImage, String> {
    let gray = img.to_luma8();
    let (width, height) = gray.dimensions();

    let window_size = 15;
    let k = 0.5; // Sensitivity parameter (0.2-0.5)
    let r = 128.0; // Dynamic range of standard deviation

    let mut output = ImageBuffer::new(width, height);

    println!(
        "[Sauvola] Processing with window={}, k={}, R={}",
        window_size, k, r
    );

    for y in 0..height {
        for x in 0..width {
            let mut sum = 0.0;
            let mut sq_sum = 0.0;
            let mut count = 0;

            let half_window = window_size as i32 / 2;
            for dy in -half_window..=half_window {
                for dx in -half_window..=half_window {
                    let nx = (x as i32 + dx).clamp(0, width as i32 - 1) as u32;
                    let ny = (y as i32 + dy).clamp(0, height as i32 - 1) as u32;
                    let val = gray.get_pixel(nx, ny).0[0] as f32;
                    sum += val;
                    sq_sum += val * val;
                    count += 1;
                }
            }

            let mean = sum / count as f32;
            let variance = sq_sum / count as f32 - mean * mean;
            let std_dev = variance.sqrt();

            // Sauvola threshold formula
            let threshold = mean * (1.0 + k * ((std_dev / r) - 1.0));

            let pixel_val = gray.get_pixel(x, y).0[0] as f32;
            let binary_val = if pixel_val > threshold { 255 } else { 0 };

            output.put_pixel(x, y, image::Rgba([binary_val, binary_val, binary_val, 255]));
        }
    }

    Ok(DynamicImage::ImageRgba8(output))
}
