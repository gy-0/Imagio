//! Morphological operations for image preprocessing
//!
//! Provides basic morphological operations:
//! - Erosion: Shrinks foreground regions
//! - Dilation: Expands foreground regions
//! - Opening: Erosion followed by dilation (removes noise)
//! - Closing: Dilation followed by erosion (fills holes)

use image::{DynamicImage, ImageBuffer, Rgba};
use imageproc::distance_transform::Norm;
use imageproc::morphology::{dilate, erode};

/// Apply erosion morphological operation
///
/// Erodes (shrinks) the foreground pixels. Useful for
/// separating connected text characters.
///
/// # Arguments
/// * `img` - The input image
///
/// # Returns
/// An eroded image
pub fn apply_erosion(img: &DynamicImage) -> DynamicImage {
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
///
/// Dilates (expands) the foreground pixels. Useful for
/// connecting broken text strokes.
///
/// # Arguments
/// * `img` - The input image
///
/// # Returns
/// A dilated image
pub fn apply_dilation(img: &DynamicImage) -> DynamicImage {
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

/// Apply opening morphological operation
///
/// Opening = Erosion followed by Dilation.
/// Removes small noise points while preserving text shape.
///
/// # Arguments
/// * `img` - The input image
///
/// # Returns
/// An opened image
pub fn apply_opening(img: &DynamicImage) -> DynamicImage {
    let gray = img.to_luma8();
    let (width, height) = gray.dimensions();

    let eroded = erode(&gray, Norm::LInf, 1);
    let opened = dilate(&eroded, Norm::LInf, 1);

    let mut output = ImageBuffer::new(width, height);
    for (x, y, pixel) in opened.enumerate_pixels() {
        let val = pixel.0[0];
        output.put_pixel(x, y, Rgba([val, val, val, 255]));
    }

    DynamicImage::ImageRgba8(output)
}

/// Apply closing morphological operation
///
/// Closing = Dilation followed by Erosion.
/// Fills small holes and cracks in text.
///
/// # Arguments
/// * `img` - The input image
///
/// # Returns
/// A closed image
pub fn apply_closing(img: &DynamicImage) -> DynamicImage {
    let gray = img.to_luma8();
    let (width, height) = gray.dimensions();

    let dilated = dilate(&gray, Norm::LInf, 1);
    let closed = erode(&dilated, Norm::LInf, 1);

    let mut output = ImageBuffer::new(width, height);
    for (x, y, pixel) in closed.enumerate_pixels() {
        let val = pixel.0[0];
        output.put_pixel(x, y, Rgba([val, val, val, 255]));
    }

    DynamicImage::ImageRgba8(output)
}
