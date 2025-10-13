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
    use_adaptive_threshold: bool,
    use_clahe: bool,
    gaussian_blur: f32,
    bilateral_filter: bool,
    morphology: String, // "none", "erode", "dilate"
    language: String,
}

#[derive(Debug, Serialize)]
struct ScreenshotResult {
    path: String,
    text: String,
}

/// Apply image preprocessing based on parameters
/// Following best practices for OCR preprocessing:
/// 1. Noise reduction (Gaussian blur or bilateral filter)
/// 2. Brightness/Contrast adjustment
/// 3. Sharpening
/// 4. Contrast enhancement (CLAHE)
/// 5. Morphological operations
/// 6. Binarization (Adaptive threshold) - always last
fn preprocess_image(img: DynamicImage, params: &ProcessingParams) -> Result<DynamicImage, String> {
    let mut processed = img;

    // Step 1: Noise reduction
    // Bilateral filter preserves edges better than Gaussian blur
    if params.bilateral_filter {
        processed = apply_bilateral_filter(&processed);
    } else if params.gaussian_blur > 0.0 {
        processed = apply_gaussian_blur(&processed, params.gaussian_blur);
    }

    // Step 2: Brightness and contrast adjustment
    // Adjust brightness first, then contrast for better results
    if params.brightness != 0.0 {
        processed = adjust_brightness(&processed, params.brightness);
    }

    if params.contrast != 1.0 {
        processed = adjust_contrast(&processed, params.contrast);
    }

    // Step 3: Sharpening (enhance text edges)
    if params.sharpness > 1.0 {
        processed = adjust_sharpness(&processed, params.sharpness);
    }

    // Step 4: CLAHE for local contrast enhancement
    // This works well on grayscale and should come after basic adjustments
    if params.use_clahe {
        processed = apply_clahe(&processed)?;
    }

    // Step 5: Morphological operations (refine text shape)
    if params.morphology == "erode" {
        processed = apply_erosion(&processed);
    } else if params.morphology == "dilate" {
        processed = apply_dilation(&processed);
    }

    // Step 6: Binarization (always last step)
    // Adaptive threshold converts to black/white for optimal OCR
    if params.use_adaptive_threshold {
        processed = apply_adaptive_threshold(&processed)?;
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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct OcrResult {
    text: String,
    processed_image_path: String,
}

#[tauri::command]
fn perform_ocr(image_path: String, params: ProcessingParams) -> Result<OcrResult, String> {
    // Initialize Tesseract with the specified language
    let lang = if params.language.is_empty() {
        "eng"
    } else {
        &params.language
    };

    // Load the image
    let img = image::open(&image_path)
        .map_err(|e| format!("Failed to load image: {}", e))?;

    // Apply preprocessing
    let processed = preprocess_image(img, &params)?;

    // Save processed image to temp file
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

    let processed_path_str = processed_path.to_string_lossy().to_string();

    // Perform OCR on processed image
    let tesseract = Tesseract::new(None, Some(lang))
        .map_err(|e| format!("Failed to initialize Tesseract: {}", e))?;

    let result = tesseract
        .set_image(&processed_path_str)
        .map_err(|e| format!("Failed to set image: {}", e))?
        .get_text()
        .map_err(|e| format!("Failed to extract text: {}", e))?;

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
        use_adaptive_threshold: true,  // Critical for OCR: binarize text
        use_clahe: true,            // Adaptive histogram equalization
        gaussian_blur: 0.5,         // Light noise reduction
        bilateral_filter: false,    // Off by default (use Gaussian instead)
        morphology: "none".to_string(),
        language: "eng".to_string(),
    };
    
    let ocr_result = perform_ocr(path_str.clone(), params).unwrap_or(OcrResult {
        text: String::new(),
        processed_image_path: String::new(),
    });

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
// 自动化测试 API
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

    // 如果没有提供测试图片，创建一个简单的测试图片
    let image_path = if let Some(path) = test_image_path {
        path
    } else {
        // 创建一个包含文本的测试图片
        let temp_dir = std::env::temp_dir();
        let test_path = temp_dir.join("imagio_test.png");

        // 创建简单的测试图片（白底黑字）
        let width = 400;
        let height = 100;
        let img = ImageBuffer::from_fn(width, height, |_, _| {
            Rgba([255u8, 255u8, 255u8, 255u8])
        });

        // 这里应该画文字，但为了简单起见，我们就用一个纯色块
        // 在实际应用中，你需要使用 imageproc::drawing 来画文字

        let dynamic_img = DynamicImage::ImageRgba8(img);
        dynamic_img.save(&test_path)
            .map_err(|e| format!("Failed to create test image: {}", e))?;

        test_path.to_string_lossy().to_string()
    };

    // 运行 OCR
    let params = ProcessingParams {
        contrast: 1.3,
        brightness: 0.0,
        sharpness: 1.2,
        use_adaptive_threshold: true,
        use_clahe: true,
        gaussian_blur: 0.5,
        bilateral_filter: false,
        morphology: "none".to_string(),
        language: "eng".to_string(),
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
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
      run_automated_test
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
