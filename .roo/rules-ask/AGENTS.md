# Project Documentation Rules (Non-Obvious Only)

- **Backend Absence:** This application is strictly client-side. There is no traditional backend API for processing or persistent data storage beyond browser-local mechanisms (IndexedDB, LocalStorage, File System API).
- **Core Plans:** The primary source of truth for design and implementation details are [`docs/SOFTWARE_ARCHITECTURE_PLAN.md`](docs/SOFTWARE_ARCHITECTURE_PLAN.md:1) and [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md:1). Always cross-reference these for context.
- **Data Schemas:** Detailed data schemas for project, timeline, and video files are formally defined in `src/types/schema/`.
- **UI Framework:** Components in `src/components/ui/` are based on Shadcn/UI, which abstracts Radix UI primitives and uses Tailwind CSS for styling.
- **File System API Usage:** Direct access to `FileSystemFileHandle` is used for saving/loading projects, which may require specific user permissions or browser settings.