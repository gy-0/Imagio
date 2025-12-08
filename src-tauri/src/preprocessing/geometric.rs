//! Geometric transformations for image preprocessing
//!
//! Includes skew correction and border removal

use image::{DynamicImage, Rgba};

use crate::binarization::calculate_otsu_threshold;

/// Correct skew using Hough transform
///
/// Based on Chinese-OCR3's approach for document deskewing.
/// Steps:
/// 1. Convert to grayscale
/// 2. Apply Canny edge detection
/// 3. Detect lines using Hough transform
/// 4. Calculate average angle from detected lines
/// 5. Rotate image to correct skew
///
/// # Arguments
/// * `img` - The input image
///
/// # Returns
/// A deskewed image or the original if no significant skew detected
pub fn correct_skew(img: &DynamicImage) -> Result<DynamicImage, String> {
    use imageproc::edges::canny;
    use imageproc::hough::{detect_lines, LineDetectionOptions};

    // Convert to grayscale
    let gray = img.to_luma8();

    // Apply Canny edge detection
    let edges = canny(&gray, 50.0, 150.0);

    // Detect lines using Hough transform
    let options = LineDetectionOptions {
        vote_threshold: 200,
        suppression_radius: 8,
    };

    let lines = detect_lines(&edges, options);

    // If no lines detected, return original image
    if lines.is_empty() {
        println!("[Deskew] No lines detected, skipping correction");
        return Ok(img.clone());
    }

    println!("[Deskew] Detected {} lines", lines.len());

    // Calculate angles from detected lines
    let mut angles: Vec<f32> = Vec::new();

    for line in &lines {
        let theta = line.angle_in_degrees as f32;

        // Normalize angle to [-45, 45] range
        let normalized_angle = if theta > 45.0 && theta < 135.0 {
            theta - 90.0
        } else if theta >= 135.0 {
            theta - 180.0
        } else {
            theta
        };

        // Filter outliers
        if normalized_angle.abs() < 45.0 {
            angles.push(normalized_angle);
        }
    }

    if angles.is_empty() {
        println!("[Deskew] No valid angles found after filtering");
        return Ok(img.clone());
    }

    // Calculate average angle
    let sum: f32 = angles.iter().sum();
    let avg_angle = sum / angles.len() as f32;

    println!("[Deskew] Average skew angle: {:.2}°", avg_angle);

    // Only rotate if skew is significant (> 0.5 degrees)
    if avg_angle.abs() < 0.5 {
        println!("[Deskew] Skew angle too small, skipping correction");
        return Ok(img.clone());
    }

    // Rotate image to correct skew
    use imageproc::geometric_transformations::{rotate_about_center, Interpolation};

    let rgba = img.to_rgba8();
    let rotated = rotate_about_center(
        &rgba,
        -avg_angle.to_radians(),
        Interpolation::Bilinear,
        Rgba([255u8, 255u8, 255u8, 255u8]),
    );

    println!(
        "[Deskew] Image rotated by {:.2}° to correct skew",
        -avg_angle
    );

    Ok(DynamicImage::ImageRgba8(rotated))
}

/// Correct skew using projection profile method
///
/// More robust for text-heavy documents without complex graphics.
/// Uses variance maximization of horizontal projection.
///
/// # Arguments
/// * `img` - The input image
///
/// # Returns
/// A deskewed image or the original if no significant skew detected
pub fn correct_skew_projection(img: &DynamicImage) -> Result<DynamicImage, String> {
    use imageproc::contrast::{threshold, ThresholdType};
    use imageproc::geometric_transformations::{rotate_about_center, Interpolation};

    let gray = img.to_luma8();

    // Binary threshold first
    let threshold_value = calculate_otsu_threshold(&gray);
    let binary = threshold(&gray, threshold_value, ThresholdType::Binary);

    // Test angles from -10° to +10° in 0.1° steps
    let mut max_variance = 0.0;
    let mut best_angle = 0.0;

    for angle_tenths in -100..=100 {
        let angle = angle_tenths as f32 / 10.0;

        // Rotate and compute horizontal projection variance
        let rotated = rotate_about_center(
            &binary,
            angle.to_radians(),
            Interpolation::Bilinear,
            image::Luma([255u8]),
        );

        // Compute horizontal projection
        let (w, h) = rotated.dimensions();
        let mut projection = vec![0u32; h as usize];
        for y in 0..h {
            for x in 0..w {
                if rotated.get_pixel(x, y).0[0] == 0 {
                    projection[y as usize] += 1;
                }
            }
        }

        // Calculate variance of projection
        let mean: f32 = projection.iter().map(|&v| v as f32).sum::<f32>() / h as f32;
        let variance: f32 = projection
            .iter()
            .map(|&v| {
                let diff = v as f32 - mean;
                diff * diff
            })
            .sum::<f32>()
            / h as f32;

        if variance > max_variance {
            max_variance = variance;
            best_angle = angle;
        }
    }

    println!(
        "[Deskew-Projection] Best angle: {:.2}° (variance: {:.0})",
        best_angle, max_variance
    );

    // Only rotate if skew is significant (> 0.3 degrees)
    if best_angle.abs() < 0.3 {
        println!("[Deskew-Projection] Skew angle too small, skipping correction");
        return Ok(img.clone());
    }

    // Rotate original image
    let rgba = img.to_rgba8();
    let rotated = rotate_about_center(
        &rgba,
        -best_angle.to_radians(),
        Interpolation::Bilinear,
        image::Rgba([255u8, 255u8, 255u8, 255u8]),
    );

    println!(
        "[Deskew-Projection] Image rotated by {:.2}° to correct skew",
        -best_angle
    );

    Ok(DynamicImage::ImageRgba8(rotated))
}

/// Remove black borders using projection profile analysis
///
/// Detects content area and crops to remove scanning artifacts.
///
/// # Arguments
/// * `img` - The input image
///
/// # Returns
/// A cropped image with borders removed
pub fn remove_borders(img: &DynamicImage) -> DynamicImage {
    let gray = img.to_luma8();
    let (width, height) = gray.dimensions();

    // Horizontal projection (sum of pixel values in each row)
    let mut h_proj = vec![0u32; height as usize];
    for y in 0..height {
        for x in 0..width {
            h_proj[y as usize] += gray.get_pixel(x, y).0[0] as u32;
        }
    }

    // Vertical projection (sum of pixel values in each column)
    let mut v_proj = vec![0u32; width as usize];
    for x in 0..width {
        for y in 0..height {
            v_proj[x as usize] += gray.get_pixel(x, y).0[0] as u32;
        }
    }

    // Find content boundaries (non-zero projections)
    let h_threshold = (width * 255 / 10) as u32;
    let v_threshold = (height * 255 / 10) as u32;

    let top = h_proj.iter().position(|&v| v > h_threshold).unwrap_or(0);
    let bottom = h_proj
        .iter()
        .rposition(|&v| v > h_threshold)
        .unwrap_or(height as usize - 1);
    let left = v_proj.iter().position(|&v| v > v_threshold).unwrap_or(0);
    let right = v_proj
        .iter()
        .rposition(|&v| v > v_threshold)
        .unwrap_or(width as usize - 1);

    // Add small margin (2% of dimension)
    let margin_x = (width / 50).max(2);
    let margin_y = (height / 50).max(2);

    let crop_left = (left as i32 - margin_x as i32).max(0) as u32;
    let crop_top = (top as i32 - margin_y as i32).max(0) as u32;
    let crop_right = ((right + margin_x as usize).min(width as usize - 1)) as u32;
    let crop_bottom = ((bottom + margin_y as usize).min(height as usize - 1)) as u32;

    let crop_width = crop_right - crop_left;
    let crop_height = crop_bottom - crop_top;

    println!(
        "[Border] Detected content area: {}x{} -> {}x{} (removed {:.1}%)",
        width,
        height,
        crop_width,
        crop_height,
        (1.0 - (crop_width * crop_height) as f32 / (width * height) as f32) * 100.0
    );

    // Only crop if we're removing a significant border (>5%)
    if crop_width * crop_height > (width * height * 95 / 100) {
        println!("[Border] Border too small, skipping removal");
        return img.clone();
    }

    img.crop_imm(crop_left, crop_top, crop_width, crop_height)
}
