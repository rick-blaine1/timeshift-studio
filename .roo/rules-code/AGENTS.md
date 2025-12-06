# Project Coding Rules (Non-Obvious Only)

- **Data Modeling**: Define models in `src/types/schema/` with Zod validation
- **State Management**: Use `useEditorState` hook instead of external libraries
- **Storage**: Implement `StorageService` interface for IndexedDB/localStorage
- **Video Processing**: Offload heavy operations to Web Workers
- **UI Components**: Follow Shadcn/UI conventions with Tailwind utilities
- **Absolute Imports**: Use `@/*` for `src/` directory imports
- **Memory Management**: Implement chunked processing for large files
- **Error Handling**: Use custom error classes (`VideoProcessingError`)
- **TypeScript Rules**: `@typescript-eslint/no-unused-vars` disabled
- **Thumbnail Generation**: Use `generateThumbnail()` utility
- **Metadata Extraction**: Use `extractVideoMetadata()` function