//! OCR processing module
//!
//! Provides the main OCR pipeline including:
//! - Image preprocessing
//! - Adaptive preprocessing based on quality metrics
//! - Tesseract OCR integration

use image::DynamicImage;
use serde::{Deserialize, Serialize};
use std::time::Instant;

use crate::binarization::{
    apply_adaptive_threshold, apply_clahe, apply_mean_threshold, apply_otsu_threshold,
    apply_sauvola_threshold,
};
use crate::morphology::{apply_closing, apply_dilation, apply_erosion, apply_opening};
use crate::preprocessing::{
    adjust_brightness, adjust_contrast, adjust_sharpness, apply_bilateral_filter,
    apply_gaussian_blur, correct_skew, correct_skew_projection, remove_borders,
};
use crate::quality::{assess_image_quality, ImageQualityMetrics};

/// Image processing parameters for OCR
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessingParams {
    pub contrast: f32,
    pub brightness: f32,
    pub sharpness: f32,
    pub binarization_method: String,
    pub use_clahe: bool,
    pub gaussian_blur: f32,
    pub bilateral_filter: bool,
    pub morphology: String,
    pub language: String,
    pub correct_skew: bool,
    pub skew_method: String,
    pub remove_borders: bool,
    pub adaptive_mode: bool,
}

/// OCR result containing extracted text and metadata
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrResult {
    pub text: String,
    pub processed_image_path: String,
    pub quality_metrics: Option<ImageQualityMetrics>,
}

/// Apply image preprocessing based on parameters
///
/// Follows best practices for OCR preprocessing:
/// 1. Border removal (if enabled)
/// 2. Geometric correction (deskewing)
/// 3. Noise reduction (Gaussian blur or bilateral filter)
/// 4. Brightness/Contrast adjustment
/// 5. Sharpening
/// 6. Contrast enhancement (CLAHE)
/// 7. Morphological operations
/// 8. Binarization (always last)
pub fn preprocess_image(
    img: DynamicImage,
    params: &ProcessingParams,
) -> Result<DynamicImage, String> {
    let mut processed = img;

    // Step 1: Border removal
    if params.remove_borders {
        let start = Instant::now();
        processed = remove_borders(&processed);
        println!(
            "[Performance]   - Border removal: {}ms",
            start.elapsed().as_millis()
        );
    }

    // Step 2: Deskew
    if params.correct_skew {
        let start = Instant::now();
        processed = if params.skew_method == "projection" {
            correct_skew_projection(&processed)?
        } else {
            correct_skew(&processed)?
        };
        println!(
            "[Performance]   - Skew correction ({}): {}ms",
            params.skew_method,
            start.elapsed().as_millis()
        );
    }

    // Step 3: Noise reduction
    if params.bilateral_filter {
        let start = Instant::now();
        processed = apply_bilateral_filter(&processed);
        println!(
            "[Performance]   - Bilateral filter: {}ms",
            start.elapsed().as_millis()
        );
    } else if params.gaussian_blur > 0.0 {
        let start = Instant::now();
        processed = apply_gaussian_blur(&processed, params.gaussian_blur);
        println!(
            "[Performance]   - Gaussian blur: {}ms",
            start.elapsed().as_millis()
        );
    }

    // Step 4: Brightness and contrast adjustment
    if params.brightness != 0.0 {
        let start = Instant::now();
        processed = adjust_brightness(&processed, params.brightness);
        println!(
            "[Performance]   - Brightness: {}ms",
            start.elapsed().as_millis()
        );
    }

    if params.contrast != 1.0 {
        let start = Instant::now();
        processed = adjust_contrast(&processed, params.contrast);
        println!(
            "[Performance]   - Contrast: {}ms",
            start.elapsed().as_millis()
        );
    }

    // Step 5: Sharpening
    if params.sharpness > 1.0 {
        let start = Instant::now();
        processed = adjust_sharpness(&processed, params.sharpness);
        println!(
            "[Performance]   - Sharpness: {}ms",
            start.elapsed().as_millis()
        );
    }

    // Step 6: CLAHE
    if params.use_clahe {
        let start = Instant::now();
        processed = apply_clahe(&processed)?;
        println!(
            "[Performance]   - CLAHE: {}ms",
            start.elapsed().as_millis()
        );
    }

    // Step 7: Morphological operations
    match params.morphology.as_str() {
        "erode" => {
            let start = Instant::now();
            processed = apply_erosion(&processed);
            println!(
                "[Performance]   - Erosion: {}ms",
                start.elapsed().as_millis()
            );
        }
        "dilate" => {
            let start = Instant::now();
            processed = apply_dilation(&processed);
            println!(
                "[Performance]   - Dilation: {}ms",
                start.elapsed().as_millis()
            );
        }
        "opening" => {
            let start = Instant::now();
            processed = apply_opening(&processed);
            println!(
                "[Performance]   - Opening: {}ms",
                start.elapsed().as_millis()
            );
        }
        "closing" => {
            let start = Instant::now();
            processed = apply_closing(&processed);
            println!(
                "[Performance]   - Closing: {}ms",
                start.elapsed().as_millis()
            );
        }
        _ => {}
    }

    // Step 8: Binarization (always last)
    match params.binarization_method.as_str() {
        "adaptive" => {
            let start = Instant::now();
            processed = apply_adaptive_threshold(&processed)?;
            println!(
                "[Performance]   - Adaptive threshold: {}ms",
                start.elapsed().as_millis()
            );
        }
        "otsu" => {
            let start = Instant::now();
            processed = apply_otsu_threshold(&processed)?;
            println!(
                "[Performance]   - Otsu threshold: {}ms",
                start.elapsed().as_millis()
            );
        }
        "mean" => {
            let start = Instant::now();
            processed = apply_mean_threshold(&processed)?;
            println!(
                "[Performance]   - Mean threshold: {}ms",
                start.elapsed().as_millis()
            );
        }
        "sauvola" => {
            let start = Instant::now();
            processed = apply_sauvola_threshold(&processed)?;
            println!(
                "[Performance]   - Sauvola threshold: {}ms",
                start.elapsed().as_millis()
            );
        }
        _ => {}
    }

    Ok(processed)
}

/// Adaptive preprocessing based on image quality assessment
///
/// Automatically selects optimal parameters based on detected
/// image characteristics (blur, contrast, noise, brightness).
pub fn adaptive_preprocess(
    img: DynamicImage,
    base_params: &ProcessingParams,
) -> Result<DynamicImage, String> {
    let metrics = assess_image_quality(&img);

    println!(
        "[Quality] Blur: {:.1}, Contrast: {:.1}, Noise: {:.1}, Brightness: {:.1}",
        metrics.blur_score, metrics.contrast_score, metrics.noise_level, metrics.brightness_level
    );

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
        adaptive_mode: false, // Prevent recursive adaptive processing
    };

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
        if params.binarization_method != "none" {
            params.binarization_method = "sauvola".to_string();
            println!("[Adaptive] Uneven illumination -> Using Sauvola binarization");
        }
    } else if params.binarization_method == "none" {
        params.binarization_method = "otsu".to_string();
        println!("[Adaptive] Good conditions -> Using Otsu binarization");
    }

    preprocess_image(img, &params)
}
