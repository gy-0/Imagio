# Imagio - OCR Application

A modern desktop OCR (Optical Character Recognition) application built with Tauri, React, and Tesseract. This is a rewrite of the Tesseract-macOS app using modern web technologies and Rust.

## Features

- 🖼️ **Image File Picker** - Select images from your macOS system
- 🔍 **OCR Text Recognition** - Extract text from images using Tesseract OCR
- 📝 **Text Display** - View and copy extracted text
- 🎨 **Modern UI** - Clean, responsive interface built with React
- ⚡ **Fast Performance** - Powered by Tauri and Rust backend
- 🍎 **macOS Optimized** - Native macOS application

## Supported Image Formats

- PNG
- JPG/JPEG
- GIF
- BMP
- TIFF

## Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js](https://nodejs.org/) (v18 or later)
- [Rust](https://www.rust-lang.org/tools/install)
- [Tesseract OCR](https://github.com/tesseract-ocr/tesseract)

### Installing Tesseract on macOS

```bash
brew install tesseract
```

## Installation

1. Clone the repository:
```bash
cd /Users/gaoyuan/Imagio
```

2. Install dependencies:
```bash
npm install
```

## Development

To run the application in development mode:

```bash
npm run tauri:dev
```

This will start the Vite dev server and launch the Tauri application.

## Building

To create a production build:

```bash
npm run tauri:build
```

The built application will be available in `src-tauri/target/release/bundle/`.

## Project Structure

```
Imagio/
├── src/                    # React frontend source code
│   ├── App.tsx            # Main application component
│   ├── App.css            # Application styles
│   └── main.tsx           # React entry point
├── src-tauri/             # Tauri/Rust backend
│   ├── src/
│   │   └── lib.rs         # Main Rust code with OCR functionality
│   ├── Cargo.toml         # Rust dependencies
│   └── tauri.conf.json    # Tauri configuration
├── index.html             # HTML entry point
├── package.json           # Node.js dependencies
└── vite.config.ts         # Vite configuration
```

## Technology Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Rust + Tauri 2.0
- **OCR Engine**: Tesseract
- **UI Styling**: CSS with native theming support

## How It Works

1. User selects an image file using the native file picker
2. The image path is sent to the Rust backend via Tauri commands
3. Tesseract OCR processes the image and extracts text
4. Results are displayed in the React frontend
5. User can copy or save the extracted text

## Scripts

- `npm run dev` - Start Vite dev server
- `npm run build` - Build frontend for production
- `npm run preview` - Preview production build
- `npm run tauri:dev` - Run Tauri app in development mode
- `npm run tauri:build` - Build Tauri app for production

## License

MIT

## Acknowledgments

- Original Tesseract-macOS project
- [Tauri](https://tauri.app/) - For the amazing framework
- [Tesseract OCR](https://github.com/tesseract-ocr/tesseract) - For the OCR engine
- [React](https://react.dev/) - For the UI framework
