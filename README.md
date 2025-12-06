# Timeshift Studio - Docker Setup Guide

Timeshift Studio is a browser-based video editor that runs entirely in the browser. All video processing happens client-side, so no server is required. This guide covers setting up the development and production environments using Docker.

## Prerequisites

- Docker installed on your system. If you don't have Docker, install it from the official Docker website:
  - [Windows](https://docs.docker.com/desktop/install/windows-install/)
  - [Mac](https://docs.docker.com/desktop/install/mac-install/)
  - [Linux](https://docs.docker.com/engine/install/)

## Getting Started

1. Clone the repository and navigate into the project directory:

```bash
git clone https://github.com/your-org/timeshift-studio.git
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
