//! Image preprocessing module for OCR optimization
//!
//! This module provides various image preprocessing techniques
//! to improve OCR accuracy, including:
//! - Brightness and contrast adjustment
//! - Sharpening
//! - Noise reduction (Gaussian blur, bilateral filter)
//! - Border removal
//! - Skew correction (deskewing)

mod adjustments;
mod filters;
mod geometric;

pub use adjustments::{adjust_brightness, adjust_contrast, adjust_sharpness};
pub use filters::{apply_gaussian_blur, apply_bilateral_filter};
pub use geometric::{correct_skew, correct_skew_projection, remove_borders};
