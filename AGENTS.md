# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Project Overview
- **Stack:** React (TS), Vite, Shadcn/UI, Tailwind CSS, npm (for dependencies), Vitest (unit/integration), Playwright (E2E).
- **Architecture:** Purely client-side application, all video processing (FFmpeg.wasm, WebCodecs) runs in the browser via Web Workers.
- **Deployment:** Single Docker container for local development and deployment; no external backend services for core functionality.
- **Key Documentation:** Refer to [`docs/SOFTWARE_ARCHITECTURE_PLAN.md`](docs/SOFTWARE_ARCHITECTURE_PLAN.md:1) and [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md:1) for detailed design and roadmap.

## Commands
- **Testing:**
  - `npm test`: Runs Vitest for unit/integration tests.
  - `npm test:ui`: Runs Vitest with a UI.
  - `npm test:ci`: Runs Vitest with coverage for CI environments.
  - `npm test:e2e`: Runs Playwright for end-to-end tests.
  - `npm test:e2e:ui`: Runs Playwright with a UI.
  - `npm test:e2e:ci`: Runs Playwright for E2E tests with HTML reporter for CI environments.
- **Build & Lint:**
  - `npm run build:dev`: Performs a development build using Vite.
  - `npm run type-check`: Performs TypeScript type checking without emitting files (`tsc --noEmit`).
- **Docker:**
  - `npm docker:dev`: Starts the development environment using `compose.development.yaml` with `--build`.
  - `npm docker:test`: Runs tests in a dedicated Docker container using `compose.test.yaml` and exits (`--abort-on-container-exit`).
  - `npm docker:prod`: Builds and runs the production Docker image using `compose.yaml`.

## Code Style & Conventions
- **TypeScript Strictness:** Relaxed type-checking, with `noImplicitAny`, `strictNullChecks`, `noUnusedLocals`, `noUnusedParameters` explicitly set to `false` in `tsconfig.json`/`tsconfig.app.json`.
- **Imports:** Absolute imports are configured using `@/*` for the `src/` directory.
- **Styling:** Extensive custom Tailwind CSS color palette, `borderRadius`, `boxShadow`, and custom animation keyframes are defined in [`tailwind.config.ts`](tailwind.config.ts:1). Follow existing patterns.
- **Unused Variables:** ESLint rule `@typescript-eslint/no-unused-vars` is turned off, allowing unused variables in TypeScript files.