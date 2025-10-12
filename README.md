# Imagio - OCR Application

A modern desktop OCR (Optical Character Recognition) application built with Tauri, React, and Tesseract. This is a rewrite of the [Tesseract-macOS](https://github.com/scott0123/Tesseract-macOS) app using modern web technologies and Rust.

## ✨ Features

- 🖼️ **Multiple Input Methods**
  - Select images from your filesystem
  - Capture screenshots directly (macOS screencapture integration)
  - Drag & drop image support

- 🔍 **Advanced OCR**
  - Powered by Tesseract 5.5.1
  - Multi-language support (English, Chinese, Japanese, Korean, French, German, Spanish)
  - Real-time text extraction

- 🎨 **Advanced Image Processing**
  - Contrast adjustment (0.5 - 2.0x)
  - Brightness adjustment (-0.5 - +0.5)
  - Sharpness enhancement (0.5 - 2.0x, unsharp mask)
  - Adaptive threshold
  - CLAHE (Contrast Limited Adaptive Histogram Equalization)
  - Gaussian blur (0-5.0 sigma)
  - Bilateral filter (edge-preserving noise reduction)
  - Morphological operations (erosion/dilation)
  - Preset configurations for common scenarios

- 🤖 **AI-Powered Features**
  - **Prompt Optimization**: Transform OCR text into optimized image generation prompts using LLM
  - **Image Generation**: Generate images from optimized prompts using FLUX Pro 1.1 Ultra
  - Support for multiple aspect ratios (21:9, 16:9, 4:3, 1:1, 3:4, 9:16, 9:21)
  - Integration with Black Forest Labs API
  - Customizable image styles (realistic, artistic, anime, abstract, etc.)

- 📝 **Text Management**
  - Copy extracted text to clipboard
  - Save results to text files
  - Editable text display with monospace font

- 🎨 **Modern UI/UX**
  - Clean, responsive three-column layout
  - Light/Dark mode support
  - Smooth animations and transitions
  - Collapsible advanced controls
  - Before/after image comparison view
  - Processing progress indicator
  - Keyboard shortcuts (⌘O, ⌘⇧S, ⌘↵, etc.)
  - Settings persistence (localStorage)

## 📸 Screenshots

*(Coming soon)*

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v20.19+ or v22.12+
- [Rust](https://www.rust-lang.org/tools/install) 1.77.2+
- [Tesseract OCR](https://github.com/tesseract-ocr/tesseract) 5.5.1+

### macOS Installation

```
Imagio/
├── src/                        # React frontend source code
│   ├── App.tsx                # Application shell orchestrating feature modules
│   ├── components/            # Reusable UI building blocks (toolbar, status, overlays)
│   ├── features/              # Feature-oriented folders (ocr, promptOptimization, imageGeneration)
│   │   ├── ocr/
│   │   │   ├── components/    # OCR-specific panels and advanced controls
│   │   │   └── useOcrProcessing.ts
│   │   ├── promptOptimization/
│   │   │   ├── components/    # Prompt settings and optimized prompt panels
│   │   │   └── usePromptOptimization.ts
│   │   └── imageGeneration/
│   │       └── useImageGeneration.ts
│   ├── hooks/                 # Cross-cutting hooks (config loading, keyboard shortcuts)
│   ├── utils/                 # API clients for OCR-adjacent services
│   └── main.tsx               # React entry point
├── src-tauri/                 # Tauri/Rust backend
│   ├── src/
│   │   ├── lib.rs             # OCR bindings and command handlers
│   │   └── main.rs            # Tauri entry point
│   ├── Cargo.toml             # Rust dependencies
│   └── tauri.conf.json        # Tauri configuration
```

### 🧱 Frontend architecture

The React layer now follows a feature-first structure:

- **Shared UI components** live in `src/components` and stay presentation-only.
- **Feature folders** bundle logic, hooks, and screens for OCR, prompt optimization, and image generation.
- **Custom hooks** (`src/hooks`) encapsulate cross-cutting concerns such as config loading and keyboard shortcuts.
- `App.tsx` acts as a lightweight coordinator, composing features via the hooks and UI primitives.
```

## 🎯 Usage

### Basic OCR Workflow

1. **Select an Image**
   - Click "📁 Select Image" (⌘O) to choose an image file
   - OR click "📸 Take Screenshot" (⌘⇧S) to capture a screenshot
   - OR drag & drop an image file directly

2. **Adjust Processing** (Optional)
   - Click "⚙️ Show Advanced" (⌘A) to reveal processing controls
   - Configure LLM settings for prompt optimization
   - OR manually adjust OCR preprocessing parameters
   - Choose recognition language

3. **Extract Text**
   - OCR automatically runs when an image is selected
   - View the extracted text in the middle panel
   - Edit the text if needed

4. **Export Results**
   - Click "📋 Copy" (⌘C) to copy text to clipboard
   - Click "💾 Save" (⌘S) to save as a text file

### AI Image Generation Workflow

1. **Optimize Prompt**
   - After extracting text, configure your desired image style
   - Add additional description (optional)
   - Click "✨ Generate Prompt" to generate an optimized prompt using LLM

2. **Generate Image**
   - Review and edit the optimized prompt if needed
   - Select your desired aspect ratio (16:9, 1:1, etc.)
   - Click "🎨 Generate Image" to create an image using FLUX Pro 1.1 Ultra
   - Wait for the generation to complete (usually 10-30 seconds)
   - View the generated image in the right panel

**Note:** Image generation requires a valid BFL API key configured in `public/config.local.json`

## ⌨️ Keyboard Shortcuts

- `⌘O` - Open image file
- `⌘⇧S` - Take screenshot
- `⌘↵` - Extract text (when image loaded)
- `⌘C` - Copy text to clipboard (when text available)
- `⌘S` - Save text to file (when text available)
- `⌘A` - Toggle advanced settings (when no text)

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

## 🔐 Local API Configuration

Create a `public/config.local.json` file (this path is `.gitignore`d) to store your API credentials without committing them:

```json
{
  "llm": {
    "apiBaseUrl": "https://api.openai.com/v1",
    "apiKey": "sk-your-key",
    "modelName": "gpt-4"
  },
  "bflApiKey": "your-bfl-api-key-here"
}
```

**Configuration Options:**
- `llm.apiBaseUrl`: LLM API endpoint (default: `http://127.0.0.1:11434/v1` for local Ollama)
- `llm.apiKey`: Your LLM API key (optional for local models like Ollama)
- `llm.modelName`: Model name to use (e.g., `llama3.1:8b`, `gpt-4`)
- `bflApiKey`: Your [Black Forest Labs](https://api.bfl.ai/) API key for FLUX image generation

The app will merge these values with its defaults at startup. Keep this file local—never add it to git.

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

### ✅ Completed (Phase 1-3)
- ✅ Core OCR functionality with 8 languages
- ✅ Screenshot capture
- ✅ Image preview with before/after comparison
- ✅ Advanced image preprocessing (10+ algorithms)
- ✅ Preset configurations
- ✅ Text export (copy/save)
- ✅ Drag & drop support
- ✅ Keyboard shortcuts
- ✅ Settings persistence
- ✅ Processing progress indicator
- ✅ Modern responsive UI/UX

### 🎉 Status: **Production Ready!**

All core features are implemented and functional. The app now matches and exceeds the original Tesseract-macOS feature set.

## 🤝 Acknowledgments

- Original [Tesseract-macOS](https://github.com/scott0123/Tesseract-macOS) project by [Scott Liu](https://github.com/scott0123)
- [Tauri](https://tauri.app/) - For the amazing framework
- [Tesseract OCR](https://github.com/tesseract-ocr/tesseract) - For the OCR engine
- [React](https://react.dev/) - For the UI framework

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🐛 Known Issues

All major issues have been resolved! ✅

Minor considerations:
- Bilateral filter may be slow on very large images
- Temp processed images are cleaned up on app exit

See [FEATURES.md](FEATURES.md) for complete issue tracking.

## 💡 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Contact

For questions or feedback, please open an issue on GitHub.
