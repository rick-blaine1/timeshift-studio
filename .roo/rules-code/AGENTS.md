# Project Coding Rules (Non-Obvious Only)

- **Data Modeling:** All data models must be defined as TypeScript interfaces in `src/types/schema/` and use Zod for runtime validation (refer to `src/types/schema/validation.ts`).
- **State Management:** Global application state is managed primarily through custom React hooks, notably `useEditorState`. Avoid external state management libraries unless explicitly approved.
- **Storage:** Data persistence relies on the `StorageService` interface (e.g., `IndexedDBStorageService`) for IndexedDB and browser `localStorage`. Do not attempt to use server-side databases.
- **Video Processing:** Client-side video manipulation must be performed using FFmpeg.wasm and/or WebCodecs, offloaded to Web Workers where possible. Direct DOM manipulation for heavy video operations should be avoided.
- **UI Components:** Adhere to Shadcn/UI component structure and styling conventions, leveraging Tailwind CSS classes and custom utilities defined in `tailwind.config.ts`.
- **Absolute Imports:** Use `@/*` for absolute imports from the `src/` directory.