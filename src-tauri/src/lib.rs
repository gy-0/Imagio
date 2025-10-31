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
    binarization_method: String, // "none", "adaptive", "otsu", "mean"  
    use_clahe: bool,
    gaussian_blur: f32,
    bilateral_filter: bool,
    morphology: String, // "none", "erode", "dilate", "opening", "closing"
    language: String,
    correct_skew: bool, // Deskew using Hough transform
}

#[derive(Debug, Serialize)]
struct ScreenshotResult {
    path: String,
    text: String,
}

/// Apply image preprocessing based on parameters
/// Following best practices for OCR preprocessing:
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

    // Step 0: Deskew (FIRST - before any other processing)
    // Based on Chinese-OCR3's Hough transform approach
    if params.correct_skew {
        let start = Instant::now();
        processed = correct_skew(&processed)?;
        println!("[Performance]   - Skew correction: {}ms", start.elapsed().as_millis());
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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct OcrResult {
    text: String,
    processed_image_path: String,
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

    // Apply preprocessing
    let preprocess_start = Instant::now();
    let processed = preprocess_image(img, &params)?;
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
        binarization_method: "otsu".to_string(),  // Otsu automatic threshold (Chinese-OCR3 method)
        use_clahe: true,            // Adaptive histogram equalization
        gaussian_blur: 0.5,         // Light noise reduction
        bilateral_filter: false,    // Off by default (use Gaussian instead)
        morphology: "none".to_string(),
        language: "eng".to_string(),
        correct_skew: true,         // Skew correction (referencing Chinese-OCR3)
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
