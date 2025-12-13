# Timeshift Studio - Browser-Based Video Editor v0.02

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

## Prerequisites

- Docker installed on your system. If you don't have Docker, install it from the official Docker website:
  - [Windows](https://docs.docker.com/desktop/install/windows-install/)
  - [Mac](https://docs.docker.com/desktop/install/mac-install/)
  - [Linux](https://docs.docker.com/engine/install/)

## Getting Started

1. Clone the repository and navigate into the project directory:

```bash
git clone https://github.com/rick-blaine1/timeshift-studio.git
cd timeshift-studio
```

2. Start the development environment:

```bash
npm run docker:dev
```

This command builds and starts the Docker containers for development. The application will be available at `http://localhost:3000`.

## Additional Commands

### Running Tests

To run the tests in a dedicated Docker container:

```bash
npm run docker:test
```

### Production Build and Run

To build and run the production image:

```bash
npm run docker:prod
```

This will start the production server. The application will be available at `http://localhost:80`.

## Note

- This application is designed to run entirely in the browser and is intended for single-user use. The Docker setup is for convenience in development and deployment.

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
