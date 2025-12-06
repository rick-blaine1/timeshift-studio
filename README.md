# Timeshift Studio - Browser-Based Video Editor

Timeshift Studio is a modern video editing application that runs entirely in the browser. It leverages client-side processing using FFmpeg.wasm and WebCodecs to provide powerful editing capabilities without requiring server-side processing.

## Key Features
- 🎬 **Client-Side Video Processing**: All editing operations happen in your browser
- 💾 **Local Storage**: Projects saved using IndexedDB/File System API
- ⚡ **Performance Optimized**: Web Workers for background processing
- 🧩 **Custom React Hooks**: State management via `useEditorState`
- 🎨 **Tailwind CSS Styling**: Custom palette (`timeline-bg`, `timeline-clip`)
- 📦 **Docker Deployment**: Containerized development and production environments

## System Requirements
- Modern browser (Chrome, Firefox, Edge)
- 4GB+ RAM recommended for larger projects

## Getting Started

### Prerequisites
- Node.js v18+
- npm v9+

### Installation
```bash
# Clone repository
git clone https://github.com/your-org/timeshift-studio.git
cd timeshift-studio

# Install dependencies
npm install
```

### Running Locally
```bash
# Start development server
npm run dev
```

## Docker Setup

### Development Environment
```bash
npm run docker:dev
```

### Production Build
```bash
npm run docker:prod
```

## Testing

### Unit Tests
```bash
npm test
```

### End-to-End Tests
```bash
npm run test:e2e
```

### Docker-Based Testing
```bash
npm run docker:test
```

## Deployment
Production deployments use the optimized Docker production image:
```bash
docker-compose -f compose.yaml up --build
```

## Important Notes
1. **FFmpeg Initialization**: Must call `initFFmpeg()` before using video processing features
2. **Memory Management**: 
   - Projects capped at 4GB total size
   - Memory-intensive operations use chunked processing
3. **Browser Limitations**: 
   - File System API permissions vary by browser
   - Speed adjustments require video re-encoding
4. **Performance Considerations**: 
   - Quality presets affect export performance and file size
   - Use sequential queues for batch operations

## Project Structure
```
timeshift-studio/
├── src/                 # Application source code
├── tests/               # Test files
├── public/              # Static assets
├── docker/              # Docker configuration files
├── .roo/                # Agent documentation
└── docs/                # Project documentation
```

## Contributing
Contributions are welcome! Please follow our coding standards and submit pull requests against the `main` branch.

## License
[MIT](https://choosealicense.com/licenses/mit/)
