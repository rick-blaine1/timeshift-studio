# Project Documentation Rules (Non-Obvious Only)

- **Backend Absence**: No server API - all processing is client-side
- **Core Plans**: Refer to `docs/SOFTWARE_ARCHITECTURE_PLAN.md` for constraints
- **Data Schemas**: Defined in `src/types/schema/` with Zod validation
- **UI Framework**: Shadcn/UI components with Radix primitives
- **File System API**: Requires user permission grants
- **Video Processing**: Limited to modern browsers (Chrome/Edge)
- **Storage Limits**: IndexedDB has browser-specific quotas
- **Error Codes**: Defined in `src/utils/errorHandling.ts`
- **Memory Constraints**: Projects capped at 4GB total size