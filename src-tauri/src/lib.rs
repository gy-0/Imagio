use tesseract::Tesseract;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::fs;

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

#[tauri::command]
fn perform_ocr(image_path: String, params: ProcessingParams) -> Result<String, String> {
    // Initialize Tesseract with the specified language
    let lang = if params.language.is_empty() {
        "eng"
    } else {
        &params.language
    };
    
    let tesseract = Tesseract::new(None, Some(lang))
        .map_err(|e| format!("Failed to initialize Tesseract: {}", e))?;
    
    // TODO: Apply image preprocessing based on params
    // For now, we'll use the basic OCR
    // In the future, we can add image processing libraries like image-rs
    
    let result = tesseract
        .set_image(&image_path)
        .map_err(|e| format!("Failed to set image: {}", e))?
        .get_text()
        .map_err(|e| format!("Failed to extract text: {}", e))?;
    
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
    use tauri_plugin_dialog::{DialogExt, MessageDialogKind};
    
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
