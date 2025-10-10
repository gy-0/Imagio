use tesseract::Tesseract;

#[tauri::command]
fn perform_ocr(image_path: String) -> Result<String, String> {
    let tesseract = Tesseract::new(None, Some("eng"))
        .map_err(|e| format!("Failed to initialize Tesseract: {}", e))?;
    
    let result = tesseract
        .set_image(&image_path)
        .map_err(|e| format!("Failed to set image: {}", e))?
        .get_text()
        .map_err(|e| format!("Failed to extract text: {}", e))?;
    
    Ok(result)
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
    .invoke_handler(tauri::generate_handler![perform_ocr])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
