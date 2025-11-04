use tesseract::Tesseract;
use serde::{Deserialize, Serialize};
use std::fs;
use image::{DynamicImage, GenericImageView, ImageBuffer, Rgba};
use imageproc::contrast::adaptive_threshold;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProcessingParams {
    contrast: f32,
    brightness: f32,
    sharpness: f32,
    binarization_method: String, // "none", "adaptive", "otsu", "mean", "sauvola"
    use_clahe: bool,
    gaussian_blur: f32,
    bilateral_filter: bool,
    morphology: String, // "none", "erode", "dilate", "opening", "closing"
    language: String,
    correct_skew: bool, // Deskew using Hough transform or projection
    skew_method: String, // "hough", "projection"
    remove_borders: bool, // Remove black borders using projection
    adaptive_mode: bool, // Enable adaptive preprocessing based on image quality
}

#[derive(Debug, Serialize)]
struct ScreenshotResult {
    path: String,
    text: String,
}

/// Image quality metrics for adaptive preprocessing
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ImageQualityMetrics {
    blur_score: f32,        // 0-100, higher is sharper
    contrast_score: f32,    // 0-100, higher is better
    noise_level: f32,       // 0-100, lower is better
    brightness_level: f32,  // 0-255, average brightness
}

/// Apply image preprocessing based on parameters
/// Following best practices for OCR preprocessing:
/// -1. Border removal (if enabled) - Remove black borders
/// 0. Geometric correction (deskewing) - FIRST, before any filtering
/// 1. Noise reduction (Gaussian blur or bilateral filter)
/// 2. Brightness/Contrast adjustment
/// 3. Sharpening
/// 4. Contrast enhancement (CLAHE)
/// 5. Morphological operations
/// 6. Binarization (Adaptive threshold) - always last
fn preprocess_image(img: DynamicImage, params: &ProcessingParams) -> Result<DynamicImage, String> {
    use std::time::Instant;
    let mut processed = img;

    // Step -1: Border removal (FIRST - before any processing)
    if params.remove_borders {
        let start = Instant::now();
        processed = remove_borders(&processed);
        println!("[Performance]   - Border removal: {}ms", start.elapsed().as_millis());
    }

    // Step 0: Deskew (FIRST - before any other processing)
    if params.correct_skew {
        let start = Instant::now();
        processed = if params.skew_method == "projection" {
            correct_skew_projection(&processed)?
        } else {
            correct_skew(&processed)?  // Default: Hough transform
        };
        println!("[Performance]   - Skew correction ({}): {}ms",
                 params.skew_method, start.elapsed().as_millis());
    }

    // Step 1: Noise reduction
    // Bilateral filter preserves edges better than Gaussian blur
    if params.bilateral_filter {
        let start = Instant::now();
        processed = apply_bilateral_filter(&processed);
        println!("[Performance]   - Bilateral filter: {}ms", start.elapsed().as_millis());
    } else if params.gaussian_blur > 0.0 {
        let start = Instant::now();
        processed = apply_gaussian_blur(&processed, params.gaussian_blur);
        println!("[Performance]   - Gaussian blur: {}ms", start.elapsed().as_millis());
    }

    // Step 2: Brightness and contrast adjustment
    // Adjust brightness first, then contrast for better results
    if params.brightness != 0.0 {
        let start = Instant::now();
        processed = adjust_brightness(&processed, params.brightness);
        println!("[Performance]   - Brightness: {}ms", start.elapsed().as_millis());
    }

    if params.contrast != 1.0 {
        let start = Instant::now();
        processed = adjust_contrast(&processed, params.contrast);
        println!("[Performance]   - Contrast: {}ms", start.elapsed().as_millis());
    }

    // Step 3: Sharpening (enhance text edges)
    if params.sharpness > 1.0 {
        let start = Instant::now();
        processed = adjust_sharpness(&processed, params.sharpness);
        println!("[Performance]   - Sharpness: {}ms", start.elapsed().as_millis());
    }

    // Step 4: CLAHE for local contrast enhancement
    // This works well on grayscale and should come after basic adjustments
    if params.use_clahe {
        let start = Instant::now();
        processed = apply_clahe(&processed)?;
        println!("[Performance]   - CLAHE: {}ms", start.elapsed().as_millis());
    }

    // Step 5: Morphological operations (refine text shape)
    if params.morphology == "erode" {
        let start = Instant::now();
        processed = apply_erosion(&processed);
        println!("[Performance]   - Erosion: {}ms", start.elapsed().as_millis());
    } else if params.morphology == "dilate" {
        let start = Instant::now();
        processed = apply_dilation(&processed);
        println!("[Performance]   - Dilation: {}ms", start.elapsed().as_millis());
    } else if params.morphology == "opening" {
        let start = Instant::now();
        processed = apply_opening(&processed);
        println!("[Performance]   - Opening: {}ms", start.elapsed().as_millis());
    } else if params.morphology == "closing" {
        let start = Instant::now();
        processed = apply_closing(&processed);
        println!("[Performance]   - Closing: {}ms", start.elapsed().as_millis());
    }

    // Step 6: Binarization (always last step)
    // Different binarization methods for different scenarios
    match params.binarization_method.as_str() {
        "adaptive" => {
            let start = Instant::now();
            processed = apply_adaptive_threshold(&processed)?;
            println!("[Performance]   - Adaptive threshold: {}ms", start.elapsed().as_millis());
        },
        "otsu" => {
            // Otsu's method (Chinese-OCR3's approach)
            let start = Instant::now();
            processed = apply_otsu_threshold(&processed)?;
            println!("[Performance]   - Otsu threshold: {}ms", start.elapsed().as_millis());
        },
        "mean" => {
            let start = Instant::now();
            processed = apply_mean_threshold(&processed)?;
            println!("[Performance]   - Mean threshold: {}ms", start.elapsed().as_millis());
        },
        "sauvola" => {
            // Sauvola's method - better for uneven illumination
            let start = Instant::now();
            processed = apply_sauvola_threshold(&processed)?;
            println!("[Performance]   - Sauvola threshold: {}ms", start.elapsed().as_millis());
        },
        _ => {
            // "none" or any other value - no binarization
        }
    }

    Ok(processed)
}

/// Adjust image brightness
fn adjust_brightness(img: &DynamicImage, brightness: f32) -> DynamicImage {
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
/// contrast > 1.0 increases contrast, < 1.0 decreases contrast
fn adjust_contrast(img: &DynamicImage, contrast: f32) -> DynamicImage {
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
fn adjust_sharpness(img: &DynamicImage, sharpness: f32) -> DynamicImage {
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
                let sum = 
                    img.get_pixel(x - 1, y).0[i] as f32 +
                    img.get_pixel(x + 1, y).0[i] as f32 +
                    img.get_pixel(x, y - 1).0[i] as f32 +
                    img.get_pixel(x, y + 1).0[i] as f32;
                let avg = sum / 4.0;
                sharp[i] = (center[i] as f32 + amount * (center[i] as f32 - avg)).clamp(0.0, 255.0);
            }
            sharp[3] = center[3] as f32;
            
            output.put_pixel(x, y, Rgba([
                sharp[0] as u8,
                sharp[1] as u8,
                sharp[2] as u8,
                sharp[3] as u8,
            ]));
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

/// Apply adaptive threshold for better text recognition
fn apply_adaptive_threshold(img: &DynamicImage) -> Result<DynamicImage, String> {
    // Convert to grayscale
    let gray = img.to_luma8();
    let (width, height) = gray.dimensions();

    // Apply adaptive threshold using imageproc
    let block_size = 15; // Size of the local region
    let thresholded = adaptive_threshold(&gray, block_size);

    // Convert back to RGBA
    let mut output = ImageBuffer::new(width, height);
    for (x, y, pixel) in thresholded.enumerate_pixels() {
        let val = pixel.0[0];
        output.put_pixel(x, y, Rgba([val, val, val, 255]));
    }

    Ok(DynamicImage::ImageRgba8(output))
}

/// Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
fn apply_clahe(img: &DynamicImage) -> Result<DynamicImage, String> {
    use imageproc::contrast::equalize_histogram;

    // Convert to grayscale
    let gray = img.to_luma8();
    let (width, height) = gray.dimensions();

    // Apply histogram equalization (simplified CLAHE)
    let equalized = equalize_histogram(&gray);

    // Convert back to RGBA
    let mut output = ImageBuffer::new(width, height);
    for (x, y, pixel) in equalized.enumerate_pixels() {
        let val = pixel.0[0];
        output.put_pixel(x, y, Rgba([val, val, val, 255]));
    }

    Ok(DynamicImage::ImageRgba8(output))
}

/// Apply Gaussian blur for noise reduction
fn apply_gaussian_blur(img: &DynamicImage, sigma: f32) -> DynamicImage {
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
fn apply_bilateral_filter(img: &DynamicImage) -> DynamicImage {
    // Simplified implementation using weighted averaging
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
                    let space_weight = (-space_dist * space_dist / (2.0 * sigma_space * sigma_space)).exp();

                    // Color distance
                    let color_dist = (
                        (center.0[0] as f32 - neighbor.0[0] as f32).powi(2) +
                        (center.0[1] as f32 - neighbor.0[1] as f32).powi(2) +
                        (center.0[2] as f32 - neighbor.0[2] as f32).powi(2)
                    ).sqrt();
                    let color_weight = (-color_dist * color_dist / (2.0 * sigma_color * sigma_color)).exp();

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

/// Apply erosion morphological operation
fn apply_erosion(img: &DynamicImage) -> DynamicImage {
    use imageproc::morphology::erode;
    use imageproc::distance_transform::Norm;

    let gray = img.to_luma8();
    let (width, height) = gray.dimensions();

    let eroded = erode(&gray, Norm::LInf, 1);

    let mut output = ImageBuffer::new(width, height);
    for (x, y, pixel) in eroded.enumerate_pixels() {
        let val = pixel.0[0];
        output.put_pixel(x, y, Rgba([val, val, val, 255]));
    }

    DynamicImage::ImageRgba8(output)
}

/// Apply dilation morphological operation
fn apply_dilation(img: &DynamicImage) -> DynamicImage {
    use imageproc::morphology::dilate;
    use imageproc::distance_transform::Norm;

    let gray = img.to_luma8();
    let (width, height) = gray.dimensions();

    let dilated = dilate(&gray, Norm::LInf, 1);

    let mut output = ImageBuffer::new(width, height);
    for (x, y, pixel) in dilated.enumerate_pixels() {
        let val = pixel.0[0];
        output.put_pixel(x, y, Rgba([val, val, val, 255]));
    }

    DynamicImage::ImageRgba8(output)
}

/// Apply opening morphological operation (erode then dilate)
/// Opening - Erosion followed by dilation, used to remove small noise points
fn apply_opening(img: &DynamicImage) -> DynamicImage {
    use imageproc::morphology::{erode, dilate};
    use imageproc::distance_transform::Norm;

    let gray = img.to_luma8();
    let (width, height) = gray.dimensions();

    // Opening = Erosion -> Dilation
    let eroded = erode(&gray, Norm::LInf, 1);
    let opened = dilate(&eroded, Norm::LInf, 1);

    let mut output = ImageBuffer::new(width, height);
    for (x, y, pixel) in opened.enumerate_pixels() {
        let val = pixel.0[0];
        output.put_pixel(x, y, Rgba([val, val, val, 255]));
    }

    DynamicImage::ImageRgba8(output)
}

/// Apply closing morphological operation (dilate then erode)
/// Closing - Dilation followed by erosion, used to fill small holes and cracks in text
fn apply_closing(img: &DynamicImage) -> DynamicImage {
    use imageproc::morphology::{erode, dilate};
    use imageproc::distance_transform::Norm;

    let gray = img.to_luma8();
    let (width, height) = gray.dimensions();

    // Closing = Dilation -> Erosion
    let dilated = dilate(&gray, Norm::LInf, 1);
    let closed = erode(&dilated, Norm::LInf, 1);

    let mut output = ImageBuffer::new(width, height);
    for (x, y, pixel) in closed.enumerate_pixels() {
        let val = pixel.0[0];
        output.put_pixel(x, y, Rgba([val, val, val, 255]));
    }

    DynamicImage::ImageRgba8(output)
}

/// Apply Otsu's automatic threshold (Chinese-OCR3's method)
/// Otsu algorithm - Automatically calculates optimal threshold for binarization
fn apply_otsu_threshold(img: &DynamicImage) -> Result<DynamicImage, String> {
    use imageproc::contrast::{threshold, ThresholdType};
    
    // Convert to grayscale
    let gray = img.to_luma8();
    let (width, height) = gray.dimensions();
    
    // Calculate Otsu threshold
    let threshold_value = calculate_otsu_threshold(&gray);
    println!("[Otsu] Calculated threshold: {}", threshold_value);
    
    // Apply threshold
    let thresholded = threshold(&gray, threshold_value, ThresholdType::Binary);
    
    // Convert back to RGBA
    let mut output = ImageBuffer::new(width, height);
    for (x, y, pixel) in thresholded.enumerate_pixels() {
        let val = pixel.0[0];
        output.put_pixel(x, y, Rgba([val, val, val, 255]));
    }
    
    Ok(DynamicImage::ImageRgba8(output))
}

/// Calculate Otsu threshold value
/// Implements Otsu algorithm to calculate optimal threshold
/// Uses Kahan summation for improved numerical stability with large images
fn calculate_otsu_threshold(img: &image::GrayImage) -> u8 {
    let (width, height) = img.dimensions();
    let total_pixels = (width * height) as f64;

    // Calculate histogram
    let mut histogram = [0u32; 256];
    for pixel in img.pixels() {
        histogram[pixel.0[0] as usize] += 1;
    }

    // Calculate cumulative sums using Kahan summation algorithm
    // This improves numerical stability for large images
    let mut sum = 0.0;
    let mut compensation = 0.0; // Running compensation for lost low-order bits

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
        
        // Calculate between-class variance
        let variance = w_b * w_f * (m_b - m_f) * (m_b - m_f);
        
        if variance > max_variance {
            max_variance = variance;
            threshold = t as u8;
        }
    }
    
    threshold
}

/// Apply mean threshold
/// Mean threshold - Uses image average grayscale as threshold
fn apply_mean_threshold(img: &DynamicImage) -> Result<DynamicImage, String> {
    use imageproc::contrast::{threshold, ThresholdType};
    
    // Convert to grayscale
    let gray = img.to_luma8();
    let (width, height) = gray.dimensions();
    
    // Calculate mean value
    let sum: u64 = gray.pixels().map(|p| p.0[0] as u64).sum();
    let mean = (sum / (width * height) as u64) as u8;
    
    println!("[Mean] Threshold: {}", mean);
    
    // Apply threshold
    let thresholded = threshold(&gray, mean, ThresholdType::Binary);
    
    // Convert back to RGBA
    let mut output = ImageBuffer::new(width, height);
    for (x, y, pixel) in thresholded.enumerate_pixels() {
        let val = pixel.0[0];
        output.put_pixel(x, y, Rgba([val, val, val, 255]));
    }
    
    Ok(DynamicImage::ImageRgba8(output))
}

/// Correct skew using Hough transform
/// Based on Chinese-OCR3's approach: https://github.com/Vincent131499/Chinese-OCR3
/// Steps:
/// 1. Convert to grayscale
/// 2. Apply Canny edge detection
/// 3. Detect lines using Hough transform
/// 4. Calculate average angle from detected lines
/// 5. Rotate image to correct skew
fn correct_skew(img: &DynamicImage) -> Result<DynamicImage, String> {
    use imageproc::edges::canny;
    use imageproc::hough::{detect_lines, LineDetectionOptions};
    
    // Convert to grayscale
    let gray = img.to_luma8();
    
    // Apply Canny edge detection
    // Using moderate thresholds to detect text edges
    let edges = canny(&gray, 50.0, 150.0);
    
    // Detect lines using Hough transform
    let options = LineDetectionOptions {
        vote_threshold: 200,    // Higher threshold for stronger lines (following Chinese-OCR3)
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
        // Extract angle from polar representation (rho, theta)
        let theta = line.angle_in_degrees as f32;
        
        // Convert to standard angle range
        // We want angles close to 0° (horizontal) or 90° (vertical)
        let normalized_angle = if theta > 45.0 && theta < 135.0 {
            theta - 90.0  // Vertical lines
        } else if theta >= 135.0 {
            theta - 180.0  // Normalize to [-45, 45] range
        } else {
            theta
        };
        
        // Filter outliers - only keep angles close to horizontal (< 45 degrees deviation)
        if normalized_angle.abs() < 45.0 {
            angles.push(normalized_angle);
        }
    }
    
    // If no valid angles found, return original
    if angles.is_empty() {
        println!("[Deskew] No valid angles found after filtering");
        return Ok(img.clone());
    }
    
    // Calculate average angle (following Chinese-OCR3 approach)
    let sum: f32 = angles.iter().sum();
    let avg_angle = sum / angles.len() as f32;
    
    println!("[Deskew] Average skew angle: {:.2}°", avg_angle);
    
    // Only rotate if skew is significant (> 0.5 degrees)
    if avg_angle.abs() < 0.5 {
        println!("[Deskew] Skew angle too small, skipping correction");
        return Ok(img.clone());
    }
    
    // Rotate image to correct skew
    // Using bilinear interpolation and white background (for documents)
    use imageproc::geometric_transformations::{rotate_about_center, Interpolation};
    
    let rgba = img.to_rgba8();
    let rotated = rotate_about_center(
        &rgba,
        -avg_angle.to_radians(),  // Negative to correct the skew
        Interpolation::Bilinear,
        Rgba([255u8, 255u8, 255u8, 255u8])  // White background
    );
    
    println!("[Deskew] Image rotated by {:.2}° to correct skew", -avg_angle);

    Ok(DynamicImage::ImageRgba8(rotated))
}

/// Correct skew using projection profile method
/// More robust for text-heavy documents without complex graphics
/// Based on variance maximization of horizontal projection
fn correct_skew_projection(img: &DynamicImage) -> Result<DynamicImage, String> {
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
            image::Luma([255u8])
        );

        // Compute horizontal projection
        let (w, h) = rotated.dimensions();
        let mut projection = vec![0u32; h as usize];
        for y in 0..h {
            for x in 0..w {
                if rotated.get_pixel(x, y).0[0] == 0 {  // Count black pixels
                    projection[y as usize] += 1;
                }
            }
        }

        // Calculate variance of projection
        let mean: f32 = projection.iter().map(|&v| v as f32).sum::<f32>() / h as f32;
        let variance: f32 = projection.iter()
            .map(|&v| {
                let diff = v as f32 - mean;
                diff * diff
            })
            .sum::<f32>() / h as f32;

        if variance > max_variance {
            max_variance = variance;
            best_angle = angle;
        }
    }

    println!("[Deskew-Projection] Best angle: {:.2}° (variance: {:.0})",
             best_angle, max_variance);

    // Only rotate if skew is significant (> 0.3 degrees)
    if best_angle.abs() < 0.3 {
        println!("[Deskew-Projection] Skew angle too small, skipping correction");
        return Ok(img.clone());
    }

    // Rotate original image
    let rgba = img.to_rgba8();
    let rotated = rotate_about_center(
        &rgba,
        -best_angle.to_radians(),  // Negative to correct the skew
        Interpolation::Bilinear,
        image::Rgba([255u8, 255u8, 255u8, 255u8])  // White background
    );

    println!("[Deskew-Projection] Image rotated by {:.2}° to correct skew", -best_angle);

    Ok(DynamicImage::ImageRgba8(rotated))
}

/// Remove black borders using projection profile analysis
/// Detects content area and crops to remove scanning artifacts
fn remove_borders(img: &DynamicImage) -> DynamicImage {
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
    // Use 10% of max possible value as threshold
    let h_threshold = (width * 255 / 10) as u32;
    let v_threshold = (height * 255 / 10) as u32;

    let top = h_proj.iter().position(|&v| v > h_threshold).unwrap_or(0);
    let bottom = h_proj.iter().rposition(|&v| v > h_threshold)
        .unwrap_or(height as usize - 1);
    let left = v_proj.iter().position(|&v| v > v_threshold).unwrap_or(0);
    let right = v_proj.iter().rposition(|&v| v > v_threshold)
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

    println!("[Border] Detected content area: {}x{} -> {}x{} (removed {:.1}%)",
             width, height, crop_width, crop_height,
             (1.0 - (crop_width * crop_height) as f32 / (width * height) as f32) * 100.0);

    // Only crop if we're removing a significant border (>5%)
    if crop_width * crop_height > (width * height * 95 / 100) {
        println!("[Border] Border too small, skipping removal");
        return img.clone();
    }

    // Crop to content area
    img.crop_imm(crop_left, crop_top, crop_width, crop_height)
}

/// Apply Sauvola binarization - better for uneven illumination
/// Paper: Sauvola, J., & Pietikäinen, M. (2000)
/// Adaptive document image binarization
fn apply_sauvola_threshold(img: &DynamicImage) -> Result<DynamicImage, String> {
    let gray = img.to_luma8();
    let (width, height) = gray.dimensions();

    let window_size = 15;  // Local window size
    let k = 0.5;           // Sensitivity parameter (0.2-0.5)
    let r = 128.0;         // Dynamic range of standard deviation

    let mut output = ImageBuffer::new(width, height);

    println!("[Sauvola] Processing with window={}, k={}, R={}", window_size, k, r);

    for y in 0..height {
        for x in 0..width {
            // Compute local mean and standard deviation
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

            // Sauvola threshold formula: T(x,y) = m(x,y) * [1 + k * ((s(x,y) / R) - 1)]
            let threshold = mean * (1.0 + k * ((std_dev / r) - 1.0));

            let pixel_val = gray.get_pixel(x, y).0[0] as f32;
            let binary_val = if pixel_val > threshold { 255 } else { 0 };

            output.put_pixel(x, y, image::Rgba([binary_val, binary_val, binary_val, 255]));
        }
    }

    Ok(DynamicImage::ImageRgba8(output))
}

/// Assess image quality for adaptive preprocessing
/// Returns metrics: blur_score, contrast_score, noise_level, brightness_level
fn assess_image_quality(img: &DynamicImage) -> ImageQualityMetrics {
    let gray = img.to_luma8();
    let (width, height) = gray.dimensions();

    // 1. Blur detection using Laplacian variance
    let mut laplacian_sum = 0.0;
    for y in 1..height-1 {
        for x in 1..width-1 {
            let center = gray.get_pixel(x, y).0[0] as f32;

            // 3x3 Laplacian kernel
            let laplacian =
                -1.0 * gray.get_pixel(x-1, y-1).0[0] as f32 +
                -1.0 * gray.get_pixel(x, y-1).0[0] as f32 +
                -1.0 * gray.get_pixel(x+1, y-1).0[0] as f32 +
                -1.0 * gray.get_pixel(x-1, y).0[0] as f32 +
                 8.0 * center +
                -1.0 * gray.get_pixel(x+1, y).0[0] as f32 +
                -1.0 * gray.get_pixel(x-1, y+1).0[0] as f32 +
                -1.0 * gray.get_pixel(x, y+1).0[0] as f32 +
                -1.0 * gray.get_pixel(x+1, y+1).0[0] as f32;
            laplacian_sum += laplacian * laplacian;
        }
    }
    let laplacian_var = laplacian_sum / ((width-2) * (height-2)) as f32;
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
    let contrast_score = (std_dev / 2.55).min(100.0); // Normalize to 0-100

    // 3. Noise estimation (local variance)
    let mut noise_sum = 0.0;
    let window = 3;
    let sample_step = 5;  // Sample every 5 pixels to speed up

    for y in (window..height-window).step_by(sample_step) {
        for x in (window..width-window).step_by(sample_step) {
            let mut local_sum = 0.0;
            let mut local_sq_sum = 0.0;
            let mut count = 0;

            for dy in -(window as i32)..=(window as i32) {
                for dx in -(window as i32)..=(window as i32) {
                    let val = gray.get_pixel(
                        (x as i32 + dx) as u32,
                        (y as i32 + dy) as u32
                    ).0[0] as f32;
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

    let samples = ((height - 2*window) / sample_step as u32) *
                  ((width - 2*window) / sample_step as u32);
    let noise_level = (noise_sum / samples as f32).min(100.0);

    ImageQualityMetrics {
        blur_score,
        contrast_score,
        noise_level,
        brightness_level: mean,
    }
}

/// Adaptive preprocessing based on image quality assessment
/// Automatically selects optimal parameters based on detected image characteristics
fn adaptive_preprocess(img: DynamicImage, base_params: &ProcessingParams) -> Result<DynamicImage, String> {
    let metrics = assess_image_quality(&img);

    println!("[Quality] Blur: {:.1}, Contrast: {:.1}, Noise: {:.1}, Brightness: {:.1}",
             metrics.blur_score, metrics.contrast_score, metrics.noise_level, metrics.brightness_level);

    // Create adaptive parameters based on quality metrics
    let mut params = ProcessingParams {
        contrast: base_params.contrast,
        brightness: base_params.brightness,
        sharpness: base_params.sharpness,
        binarization_method: base_params.binarization_method.clone(),
        use_clahe: base_params.use_clahe,
        gaussian_blur: base_params.gaussian_blur,
        bilateral_filter: base_params.bilateral_filter,
        morphology: base_params.morphology.clone(),
        language: base_params.language.clone(),
        correct_skew: base_params.correct_skew,
        skew_method: base_params.skew_method.clone(),
        remove_borders: base_params.remove_borders,
        adaptive_mode: false,  // Prevent recursive adaptive processing
    };

    // Adaptive strategy based on quality metrics

    // 1. Handle blurry images
    if metrics.blur_score < 30.0 {
        params.sharpness = 2.0;
        println!("[Adaptive] Detected blur -> Increasing sharpness to 2.0");
    } else if metrics.blur_score < 50.0 {
        params.sharpness = 1.5;
        println!("[Adaptive] Moderate blur -> Setting sharpness to 1.5");
    }

    // 2. Handle low contrast
    if metrics.contrast_score < 40.0 {
        params.use_clahe = true;
        params.contrast = 1.5;
        println!("[Adaptive] Low contrast -> Enabling CLAHE and increasing contrast to 1.5");
    } else if metrics.contrast_score < 60.0 {
        params.contrast = 1.3;
        println!("[Adaptive] Moderate contrast -> Setting contrast to 1.3");
    }

    // 3. Handle noisy images
    if metrics.noise_level > 20.0 {
        params.bilateral_filter = true;
        params.morphology = "opening".to_string();
        println!("[Adaptive] High noise -> Enabling bilateral filter and opening");
    } else if metrics.noise_level > 12.0 {
        params.gaussian_blur = 1.0;
        println!("[Adaptive] Moderate noise -> Applying Gaussian blur");
    }

    // 4. Handle brightness issues
    if metrics.brightness_level < 80.0 {
        params.brightness = 0.2;
        println!("[Adaptive] Dark image -> Increasing brightness");
    } else if metrics.brightness_level > 200.0 {
        params.brightness = -0.1;
        println!("[Adaptive] Bright image -> Decreasing brightness");
    }

    // 5. Choose optimal binarization method
    if metrics.brightness_level < 100.0 || metrics.brightness_level > 180.0 {
        // Uneven illumination - use Sauvola
        if params.binarization_method != "none" {
            params.binarization_method = "sauvola".to_string();
            println!("[Adaptive] Uneven illumination -> Using Sauvola binarization");
        }
    } else if params.binarization_method == "none" {
        // Good conditions - Otsu works well
        params.binarization_method = "otsu".to_string();
        println!("[Adaptive] Good conditions -> Using Otsu binarization");
    }

    // Apply preprocessing with adaptive parameters
    preprocess_image(img, &params)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct OcrResult {
    text: String,
    processed_image_path: String,
    quality_metrics: Option<ImageQualityMetrics>,
}

#[tauri::command]
fn perform_ocr(image_path: String, params: ProcessingParams) -> Result<OcrResult, String> {
    use std::time::Instant;
    let total_start = Instant::now();

    // Initialize Tesseract with the specified language
    let lang = if params.language.is_empty() {
        "eng"
    } else {
        &params.language
    };

    // Load the image
    let load_start = Instant::now();
    let img = image::open(&image_path)
        .map_err(|e| format!("Failed to load image: {}", e))?;
    println!("[Performance] Image loading took: {}ms", load_start.elapsed().as_millis());

    // Assess image quality first
    let quality_metrics = if params.adaptive_mode {
        Some(assess_image_quality(&img))
    } else {
        None
    };

    // Apply preprocessing (adaptive or standard)
    let preprocess_start = Instant::now();
    let processed = if params.adaptive_mode {
        adaptive_preprocess(img, &params)?
    } else {
        preprocess_image(img, &params)?
    };
    println!("[Performance] Image preprocessing took: {}ms", preprocess_start.elapsed().as_millis());

    // Save processed image to temp file
    let save_start = Instant::now();
    let temp_dir = std::env::temp_dir();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap();
    let processed_path = temp_dir.join(format!(
        "imagio_processed_{}_{}.png",
        now.as_secs(),
        now.subsec_nanos()
    ));

    processed.save(&processed_path)
        .map_err(|e| format!("Failed to save processed image: {}", e))?;
    println!("[Performance] Saving processed image took: {}ms", save_start.elapsed().as_millis());

    let processed_path_str = processed_path.to_string_lossy().to_string();

    // Perform OCR on processed image
    let ocr_start = Instant::now();
    let tesseract = Tesseract::new(None, Some(lang))
        .map_err(|e| format!("Failed to initialize Tesseract: {}", e))?;

    let result = tesseract
        .set_image(&processed_path_str)
        .map_err(|e| format!("Failed to set image: {}", e))?
        .get_text()
        .map_err(|e| format!("Failed to extract text: {}", e))?;
    println!("[Performance] Tesseract OCR took: {}ms", ocr_start.elapsed().as_millis());

    println!("[Performance] Total OCR operation took: {}ms", total_start.elapsed().as_millis());

    // Don't clean up temp file - we'll use it for preview
    // let _ = fs::remove_file(&processed_path);

    Ok(OcrResult {
        text: result,
        processed_image_path: processed_path_str,
        quality_metrics,
    })
}

#[tauri::command]
async fn take_screenshot() -> Result<ScreenshotResult, String> {
    // Use macOS screencapture command
    use std::process::Command;
    
    let temp_dir = std::env::temp_dir();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap();
    let screenshot_path = temp_dir.join(format!(
        "imagio_screenshot_{}_{}.png",
        now.as_secs(),
        now.subsec_nanos()
    ));
    
    // Execute screencapture with interactive selection (-i) and cursor (-C)
    let output = Command::new("screencapture")
        .arg("-i")  // Interactive mode (user selects area)
        .arg("-C")  // Include cursor
        .arg(&screenshot_path)
        .output()
        .map_err(|e| format!("Failed to execute screencapture: {}", e))?;
    
    if !output.status.success() {
        return Err("Screenshot was cancelled or failed".to_string());
    }
    
    if !screenshot_path.exists() {
        return Err("Screenshot file was not created".to_string());
    }
    
    let path_str = screenshot_path.to_string_lossy().to_string();

    // Automatically perform OCR on the screenshot with best practice defaults
    let params = ProcessingParams {
        contrast: 1.3,              // Enhance text/background separation
        brightness: 0.0,            // No brightness adjustment by default
        sharpness: 1.2,             // Slight sharpening for text clarity
        binarization_method: "otsu".to_string(),  // Otsu automatic threshold
        use_clahe: true,            // Adaptive histogram equalization
        gaussian_blur: 0.5,         // Light noise reduction
        bilateral_filter: false,    // Off by default (use Gaussian instead)
        morphology: "none".to_string(),
        language: "eng".to_string(),
        correct_skew: true,         // Skew correction
        skew_method: "projection".to_string(),  // Use projection method (faster and more reliable)
        remove_borders: true,       // Remove borders for screenshot
        adaptive_mode: true,        // Enable adaptive preprocessing
    };

    // Perform OCR and properly propagate errors instead of silently failing
    let ocr_result = perform_ocr(path_str.clone(), params)
        .map_err(|e| format!("Screenshot OCR failed: {}", e))?;

    Ok(ScreenshotResult {
        path: path_str,
        text: ocr_result.text,
    })
}

#[tauri::command]
async fn save_text_to_path(text: String, file_path: String) -> Result<(), String> {
    fs::write(&file_path, text)
        .map_err(|e| format!("Failed to save file: {}", e))?;

    Ok(())
}

// ============================================
// Automated Testing API
// ============================================

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AppHealthCheck {
    status: String,
    timestamp: u64,
    version: String,
    features: Vec<String>,
}

#[tauri::command]
fn health_check() -> Result<AppHealthCheck, String> {
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("Time error: {}", e))?
        .as_secs();

    Ok(AppHealthCheck {
        status: "healthy".to_string(),
        timestamp,
        version: env!("CARGO_PKG_VERSION").to_string(),
        features: vec![
            "ocr".to_string(),
            "screenshot".to_string(),
            "image_processing".to_string(),
        ],
    })
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TestImageResult {
    success: bool,
    ocr_text: String,
    error: Option<String>,
    processing_time_ms: u128,
}

#[tauri::command]
async fn run_automated_test(test_image_path: Option<String>) -> Result<TestImageResult, String> {
    use std::time::Instant;

    let start = Instant::now();

    // If no test image provided, create a simple test image
    let image_path = if let Some(path) = test_image_path {
        path
    } else {
        // Create a test image containing text
        let temp_dir = std::env::temp_dir();
        let test_path = temp_dir.join("imagio_test.png");

        // Create simple test image (white background, black text)
        let width = 400;
        let height = 100;
        let img = ImageBuffer::from_fn(width, height, |_, _| {
            Rgba([255u8, 255u8, 255u8, 255u8])
        });

        // Text should be drawn here, but for simplicity we use a solid color block
        // In actual applications, you need to use imageproc::drawing to draw text

        let dynamic_img = DynamicImage::ImageRgba8(img);
        dynamic_img.save(&test_path)
            .map_err(|e| format!("Failed to create test image: {}", e))?;

        test_path.to_string_lossy().to_string()
    };

    // Run OCR
    let params = ProcessingParams {
        contrast: 1.3,
        brightness: 0.0,
        sharpness: 1.2,
        binarization_method: "otsu".to_string(),
        use_clahe: true,
        gaussian_blur: 0.5,
        bilateral_filter: false,
        morphology: "none".to_string(),
        language: "eng".to_string(),
        correct_skew: true,
        skew_method: "projection".to_string(),
        remove_borders: false,
        adaptive_mode: true,
    };

    match perform_ocr(image_path, params) {
        Ok(result) => {
            let duration = start.elapsed();
            Ok(TestImageResult {
                success: true,
                ocr_text: result.text,
                error: None,
                processing_time_ms: duration.as_millis(),
            })
        }
        Err(e) => {
            let duration = start.elapsed();
            Ok(TestImageResult {
                success: false,
                ocr_text: String::new(),
                error: Some(e),
                processing_time_ms: duration.as_millis(),
            })
        }
    }
}

#[tauri::command]
async fn copy_image_from_bytes(image_bytes: Vec<u8>) -> Result<(), String> {
    use std::time::Instant;
    let start = Instant::now();

    // Decode image
    let t0 = Instant::now();
    let img = image::load_from_memory(&image_bytes)
        .map_err(|e| format!("Failed to decode image: {}", e))?;
    println!("[Performance] Decode: {}ms", t0.elapsed().as_millis());

    // Convert to RGBA
    let t0 = Instant::now();
    let rgba_img = img.to_rgba8();
    let (width, height) = rgba_img.dimensions();
    let raw_data = rgba_img.into_raw();
    println!("[Performance] Convert to RGBA: {}ms ({}x{})", t0.elapsed().as_millis(), width, height);

    // Write to clipboard
    let t0 = Instant::now();
    use arboard::{Clipboard, ImageData as ArboardImageData};

    let mut clipboard = Clipboard::new()
        .map_err(|e| format!("Failed to access clipboard: {}", e))?;

    let img_data = ArboardImageData {
        width: width as usize,
        height: height as usize,
        bytes: raw_data.into(),
    };

    clipboard.set_image(img_data)
        .map_err(|e| format!("Failed to write to clipboard: {}", e))?;

    println!("[Performance] Clipboard write: {}ms", t0.elapsed().as_millis());
    println!("[Performance] TOTAL: {}ms", start.elapsed().as_millis());

    Ok(())
}

/// Clean up old temporary files created by the application
/// This prevents disk space exhaustion from accumulated temp files
/// Currently disabled by user preference - see comments in run() function
#[allow(dead_code)]
fn cleanup_old_temp_files() {
    use std::time::{SystemTime, Duration};

    let temp_dir = std::env::temp_dir();
    let max_age = Duration::from_secs(24 * 60 * 60); // 24 hours
    let now = SystemTime::now();

    // Clean up processed images
    if let Ok(entries) = fs::read_dir(&temp_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let filename = path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("");

            // Only clean up our own temp files
            if filename.starts_with("imagio_processed_") || filename.starts_with("imagio_screenshot_") {
                // Check file age
                if let Ok(metadata) = fs::metadata(&path) {
                    if let Ok(modified) = metadata.modified() {
                        if let Ok(age) = now.duration_since(modified) {
                            if age > max_age {
                                // File is older than max_age, delete it
                                let _ = fs::remove_file(&path);
                                println!("[Cleanup] Removed old temp file: {:?}", path);
                            }
                        }
                    }
                }
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  // Temp file cleanup intentionally disabled by user preference
  // User has confirmed sufficient disk space and prefers to preserve
  // processed images for debugging/reference purposes.
  //
  // To re-enable automatic cleanup, uncomment the following line:
  // cleanup_old_temp_files();
  //
  // Note: Processed images are stored in system temp directory with
  // prefix "imagio_processed_" and "imagio_screenshot_".
  // Monitor disk usage with: du -sh $TMPDIR/imagio_*

  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_clipboard_manager::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      perform_ocr,
      take_screenshot,
      save_text_to_path,
      health_check,
      run_automated_test,
      copy_image_from_bytes
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
