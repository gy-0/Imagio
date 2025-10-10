# Imagio - OCR Application

A modern desktop OCR (Optical Character Recognition) application built with Tauri, React, and Tesseract. This is a rewrite of the [Tesseract-macOS](https://github.com/scott0123/Tesseract-macOS) app using modern web technologies and Rust.

## ✨ Features

- 🖼️ **Multiple Input Methods**
  - Select images from your filesystem
  - Capture screenshots directly (macOS screencapture integration)
  
- 🔍 **Advanced OCR**
  - Powered by Tesseract 5.5.1
  - Multi-language support (English, Chinese, Japanese, Korean, French, German, Spanish)
  - Real-time text extraction
  
- 🎨 **Image Processing Controls** (UI Ready)
  - Contrast adjustment (0.5 - 2.0x)
  - Brightness adjustment (-0.5 - +0.5)
  - Sharpness enhancement (0.5 - 2.0x)
  - Adaptive threshold toggle
  
- 📝 **Text Management**
  - Copy extracted text to clipboard
  - Save results to text files
  - Read-only text display with monospace font
  
- 🎨 **Modern UI**
  - Clean, responsive interface
  - Light/Dark mode support
  - Smooth animations and transitions
  - Collapsible advanced controls
  - Live image preview

## 📸 Screenshots

*(Coming soon)*

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v20.19+ or v22.12+
- [Rust](https://www.rust-lang.org/tools/install) 1.77.2+
- [Tesseract OCR](https://github.com/tesseract-ocr/tesseract) 5.5.1+

### macOS Installation

```bash
# Install Tesseract via Homebrew
brew install tesseract

# Clone the repository
git clone https://github.com/yourusername/Imagio.git
cd Imagio

# Install dependencies
npm install

# Run in development mode
npm run tauri:dev
```

## 🎯 Usage

1. **Select an Image**
   - Click "📁 Select Image" to choose an image file
   - OR click "📸 Take Screenshot" to capture a screenshot

2. **Adjust Processing** (Optional)
   - Click "⚙️ Show Advanced" to reveal processing controls
   - Adjust contrast, brightness, and sharpness
   - Select recognition language
   - Enable adaptive threshold if needed

3. **Extract Text**
   - Click "🔍 Extract Text" to perform OCR
   - Wait for processing to complete

4. **Export Results**
   - Click "📋 Copy" to copy text to clipboard
   - Click "💾 Save" to save as a text file

## 📦 Supported Image Formats

- PNG
- JPG/JPEG
- GIF
- BMP
- TIFF
- WebP

## 🌍 Supported Languages

- 🇬🇧 English (eng)
- 🇨🇳 Chinese Simplified (chi_sim)
- 🇹🇼 Chinese Traditional (chi_tra)
- 🇯🇵 Japanese (jpn)
- 🇰🇷 Korean (kor)
- 🇫🇷 French (fra)
- 🇩🇪 German (deu)
- 🇪🇸 Spanish (spa)

*Note: Additional language packs can be installed via Tesseract*

## 🏗️ Building

### Development
```bash
npm run tauri:dev
```

### Production Build
```bash
npm run tauri:build
```

The built application will be available in `src-tauri/target/release/bundle/`.

## 📂 Project Structure

```
Imagio/
├── src/                    # React frontend source code
│   ├── App.tsx            # Main application component
│   ├── App.css            # Application styles
│   └── main.tsx           # React entry point
├── src-tauri/             # Tauri/Rust backend
│   ├── src/
│   │   ├── lib.rs         # Main Rust code with OCR functionality
│   │   └── main.rs        # Tauri entry point
│   ├── Cargo.toml         # Rust dependencies
│   ├── tauri.conf.json    # Tauri configuration
│   └── icons/             # App icons
├── index.html             # HTML entry point
├── package.json           # Node.js dependencies
├── vite.config.ts         # Vite configuration
├── README.md              # This file
└── FEATURES.md            # Feature tracking document
```

## 🛠️ Technology Stack

### Frontend
- **React 19** - UI framework
- **TypeScript** - Type-safe JavaScript
- **Vite 7** - Fast build tool and dev server

### Backend
- **Rust** - Systems programming language
- **Tauri 2.8** - Desktop app framework
- **Tesseract 5.5.1** - OCR engine

### Tauri Plugins
- `tauri-plugin-dialog` - File picker and dialogs
- `tauri-plugin-fs` - Filesystem access
- `tauri-plugin-log` - Logging utilities

## 🔄 Development Status

See [FEATURES.md](FEATURES.md) for detailed feature implementation progress.

### ✅ Completed (Phase 1)
- Core OCR functionality
- Screenshot capture
- Image preview
- Multi-language support
- Advanced controls UI
- Text export (copy/save)
- Modern UI/UX

### 🚧 In Progress (Phase 2)
- Image preprocessing implementation
- Advanced OCR features
- Performance optimizations

## 🤝 Acknowledgments

- Original [Tesseract-macOS](https://github.com/scott0123/Tesseract-macOS) project by [Scott Liu](https://github.com/scott0123)
- [Tauri](https://tauri.app/) - For the amazing framework
- [Tesseract OCR](https://github.com/tesseract-ocr/tesseract) - For the OCR engine
- [React](https://react.dev/) - For the UI framework

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🐛 Known Issues

1. Image preprocessing parameters (contrast, brightness, sharpness) are UI-only and don't yet affect the actual image processing
2. Adaptive threshold toggle is non-functional (pending implementation)

See [FEATURES.md](FEATURES.md) for full issue tracking.

## 💡 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Contact

For questions or feedback, please open an issue on GitHub.
