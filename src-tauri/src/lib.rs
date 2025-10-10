use tesseract::Tesseract;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::fs;
use image::{DynamicImage, GenericImageView, ImageBuffer, Rgba};
use imageproc::contrast::adaptive_threshold;

#[derive(Debug, Deserialize)]
struct ProcessingParams {
    contrast: f32,
    brightness: f32,
    sharpness: f32,
    use_adaptive_threshold: bool,
    language: String,
}

#[derive(Debug, Serialize)]
struct ScreenshotResult {
    path: String,
    text: String,
}

/// Apply image preprocessing based on parameters
fn preprocess_image(img: DynamicImage, params: &ProcessingParams) -> Result<DynamicImage, String> {
    let mut processed = img;
    
    // Apply brightness adjustment
    if params.brightness != 0.0 {
        processed = adjust_brightness(&processed, params.brightness);
    }
    
    // Apply contrast adjustment
    if params.contrast != 1.0 {
        processed = adjust_contrast(&processed, params.contrast);
    }
    
    // Apply sharpness (using unsharp mask)
    if params.sharpness != 1.0 {
        processed = adjust_sharpness(&processed, params.sharpness);
    }
    
    // Apply adaptive threshold if enabled
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

/// Adjust image contrast
fn adjust_contrast(img: &DynamicImage, contrast: f32) -> DynamicImage {
    let (width, height) = img.dimensions();
    let mut output = ImageBuffer::new(width, height);
    let factor = (259.0 * (contrast * 255.0 + 255.0)) / (255.0 * (259.0 - contrast * 255.0));
    
    for (x, y, pixel) in img.pixels() {
        let rgba = pixel.0;
        let adjusted = [
            ((factor * (rgba[0] as f32 - 128.0) + 128.0).clamp(0.0, 255.0)) as u8,
            ((factor * (rgba[1] as f32 - 128.0) + 128.0).clamp(0.0, 255.0)) as u8,
            ((factor * (rgba[2] as f32 - 128.0) + 128.0).clamp(0.0, 255.0)) as u8,
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

#[tauri::command]
fn perform_ocr(image_path: String, params: ProcessingParams) -> Result<String, String> {
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
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let processed_path = temp_dir.join(format!("imagio_processed_{}.png", timestamp));
    
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
    
    // Clean up temp file
    let _ = fs::remove_file(processed_path);
    
    Ok(result)
}

#[tauri::command]
async fn take_screenshot() -> Result<ScreenshotResult, String> {
    // Use macOS screencapture command
    use std::process::Command;
    
    let temp_dir = std::env::temp_dir();
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let screenshot_path = temp_dir.join(format!("imagio_screenshot_{}.png", timestamp));
    
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
    
    // Automatically perform OCR on the screenshot
    let params = ProcessingParams {
        contrast: 1.0,
        brightness: 0.0,
        sharpness: 1.0,
        use_adaptive_threshold: false,
        language: "eng".to_string(),
    };
    
    let text = perform_ocr(path_str.clone(), params).unwrap_or_default();
    
    Ok(ScreenshotResult {
        path: path_str,
        text,
    })
}

#[tauri::command]
async fn save_text(text: String) -> Result<(), String> {
    // Use dialog to save file
    let file_path = tauri::async_runtime::block_on(async {
        // For now, save to default location
        let home_dir = dirs::home_dir().ok_or("Failed to get home directory")?;
        let desktop = home_dir.join("Desktop");
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        Ok::<PathBuf, String>(desktop.join(format!("ocr_result_{}.txt", timestamp)))
    })?;
    
    fs::write(&file_path, text)
        .map_err(|e| format!("Failed to save file: {}", e))?;
    
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
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
    .invoke_handler(tauri::generate_handler![perform_ocr, take_screenshot, save_text])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
