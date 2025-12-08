//! Imagio - OCR and Image Generation Application
//!
//! This is the Rust backend for the Imagio Tauri application.
//! It provides image preprocessing, OCR, and utility functions.

mod binarization;
mod morphology;
mod ocr;
mod preprocessing;
mod quality;

use image::{DynamicImage, ImageBuffer, Rgba};
use serde::Serialize;
use std::fs;
use tesseract::Tesseract;

use ocr::{adaptive_preprocess, preprocess_image, OcrResult, ProcessingParams};
use quality::assess_image_quality;

/// Screenshot result containing path and OCR text
#[derive(Debug, Serialize)]
struct ScreenshotResult {
    path: String,
    text: String,
}

/// Perform OCR on an image with preprocessing
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
    let img =
        image::open(&image_path).map_err(|e| format!("Failed to load image: {}", e))?;
    println!(
        "[Performance] Image loading took: {}ms",
        load_start.elapsed().as_millis()
    );

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
    println!(
        "[Performance] Image preprocessing took: {}ms",
        preprocess_start.elapsed().as_millis()
    );

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

    processed
        .save(&processed_path)
        .map_err(|e| format!("Failed to save processed image: {}", e))?;
    println!(
        "[Performance] Saving processed image took: {}ms",
        save_start.elapsed().as_millis()
    );

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
    println!(
        "[Performance] Tesseract OCR took: {}ms",
        ocr_start.elapsed().as_millis()
    );

    println!(
        "[Performance] Total OCR operation took: {}ms",
        total_start.elapsed().as_millis()
    );

    Ok(OcrResult {
        text: result,
        processed_image_path: processed_path_str,
        quality_metrics,
    })
}

/// Take a screenshot with interactive selection
#[tauri::command]
async fn take_screenshot() -> Result<ScreenshotResult, String> {
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

    // Execute screencapture with interactive selection
    let output = Command::new("screencapture")
        .arg("-i")
        .arg("-C")
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

    // Automatically perform OCR with best practice defaults
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
        remove_borders: true,
        adaptive_mode: true,
    };

    let ocr_result =
        perform_ocr(path_str.clone(), params).map_err(|e| format!("Screenshot OCR failed: {}", e))?;

    Ok(ScreenshotResult {
        path: path_str,
        text: ocr_result.text,
    })
}

/// Save text to a file path
#[tauri::command]
async fn save_text_to_path(text: String, file_path: String) -> Result<(), String> {
    use std::path::Path;

    let path = Path::new(&file_path);

    let parent_dir = path
        .parent()
        .ok_or_else(|| "Invalid file path: no parent directory".to_string())?;

    if !parent_dir.exists() {
        return Err(format!(
            "Parent directory does not exist: {}",
            parent_dir.display()
        ));
    }

    let canonical_parent = parent_dir
        .canonicalize()
        .map_err(|e| format!("Failed to resolve parent path: {}", e))?;

    let canonical_path = canonical_parent
        .join(path.file_name().ok_or_else(|| "Invalid file name".to_string())?);

    fs::write(&canonical_path, text).map_err(|e| format!("Failed to save file: {}", e))?;

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

/// Health check endpoint for automated testing
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

/// Run automated test with optional test image
#[tauri::command]
async fn run_automated_test(test_image_path: Option<String>) -> Result<TestImageResult, String> {
    use std::time::Instant;

    let start = Instant::now();

    let image_path = if let Some(path) = test_image_path {
        path
    } else {
        // Create a test image
        let temp_dir = std::env::temp_dir();
        let test_path = temp_dir.join("imagio_test.png");

        let width = 400;
        let height = 100;
        let img = ImageBuffer::from_fn(width, height, |_, _| Rgba([255u8, 255u8, 255u8, 255u8]));

        let dynamic_img = DynamicImage::ImageRgba8(img);
        dynamic_img
            .save(&test_path)
            .map_err(|e| format!("Failed to create test image: {}", e))?;

        test_path.to_string_lossy().to_string()
    };

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

/// Copy image from bytes to clipboard
#[tauri::command]
async fn copy_image_from_bytes(image_bytes: Vec<u8>) -> Result<(), String> {
    use arboard::{Clipboard, ImageData as ArboardImageData};
    use std::time::Instant;

    let start = Instant::now();

    let t0 = Instant::now();
    let img = image::load_from_memory(&image_bytes)
        .map_err(|e| format!("Failed to decode image: {}", e))?;
    println!("[Performance] Decode: {}ms", t0.elapsed().as_millis());

    let t0 = Instant::now();
    let rgba_img = img.to_rgba8();
    let (width, height) = rgba_img.dimensions();
    let raw_data = rgba_img.into_raw();
    println!(
        "[Performance] Convert to RGBA: {}ms ({}x{})",
        t0.elapsed().as_millis(),
        width,
        height
    );

    let t0 = Instant::now();
    let mut clipboard =
        Clipboard::new().map_err(|e| format!("Failed to access clipboard: {}", e))?;

    let img_data = ArboardImageData {
        width: width as usize,
        height: height as usize,
        bytes: raw_data.into(),
    };

    clipboard
        .set_image(img_data)
        .map_err(|e| format!("Failed to write to clipboard: {}", e))?;

    println!(
        "[Performance] Clipboard write: {}ms",
        t0.elapsed().as_millis()
    );
    println!("[Performance] TOTAL: {}ms", start.elapsed().as_millis());

    Ok(())
}

/// Clean up old temporary files created by the application
#[allow(dead_code)]
fn cleanup_old_temp_files() {
    use std::time::{Duration, SystemTime};

    let temp_dir = std::env::temp_dir();
    let max_age = Duration::from_secs(24 * 60 * 60);
    let now = SystemTime::now();

    if let Ok(entries) = fs::read_dir(&temp_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let filename = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

            if filename.starts_with("imagio_processed_") || filename.starts_with("imagio_screenshot_")
            {
                if let Ok(metadata) = fs::metadata(&path) {
                    if let Ok(modified) = metadata.modified() {
                        if let Ok(age) = now.duration_since(modified) {
                            if age > max_age {
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
    // cleanup_old_temp_files();

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
