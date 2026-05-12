# Kuti Studio

Kuti Studio is a local-first narrative production platform for building projects with characters, storylines, assets, versions, warnings, exports, and AI-assisted generation. The repository is split into a Python backend and a React frontend.

## Project structure

- `kuti-backend/` - FastAPI application, SQLite persistence, OpenAPI generation, local job orchestration, and domain logic.
- `kuti-frontend/` - React Router v7 application, React Query data layer, Zustand UI state, and the local editing interface.
- The frontend design system is based on Adobe Spectrum S2, with React Query for server-state caching and mutations.
- `kuti-data/` - Local project storage used by the backend for projects, assets, exports, and generated artifacts.

## Environment variables

The repository includes example files you can copy and edit:

- `kuti-backend/.env.example`
- `kuti-frontend/.env.example`

### Backend env

Configure provider endpoints and API keys in `kuti-backend/.env`:

```env
KUTI_SORA_2_BASE_URL=https://example.invalid/sora-2
KUTI_SORA_2_API_KEY=replace-me

KUTI_SEEDANCE_2_BASE_URL=https://example.invalid/seedance-2
KUTI_SEEDANCE_2_API_KEY=replace-me

KUTI_GPT_IMAGES_1_5_BASE_URL=https://example.invalid/gpt-images-1-5
KUTI_GPT_IMAGES_1_5_API_KEY=replace-me

KUTI_GPT_IMAGES_2_BASE_URL=https://example.invalid/gpt-images-2
KUTI_GPT_IMAGES_2_API_KEY=replace-me

KUTI_ELEVEN_LABS_BASE_URL=https://example.invalid/eleven-labs
KUTI_ELEVEN_LABS_API_KEY=replace-me
```

You can also set `KUTI_DATA_DIR` to point the backend at a different local storage directory.

### Frontend env

Configure the API base URL in `kuti-frontend/.env`:

```env
VITE_KUTI_API_URL=http://localhost:8000
```

## How to run

### 1. Start the backend

From `kuti-backend/`:

```bash
uv run uvicorn kuti_backend.api.main:create_app --factory --reload
```

The backend serves the local API and OpenAPI document on port `8000` by default.

### 2. Start the frontend

From `kuti-frontend/`:

```bash
yarn install
yarn dev
```

The frontend connects to the backend through `VITE_KUTI_API_URL`.

### 3. Verify the build

From the repository root or each package directory:

```bash
cd kuti-backend && uv run pytest
cd kuti-frontend && yarn build
```

## Notes

- The app is designed to run locally without authentication.
- The backend is the source of truth for domain data and exposes the contract through OpenAPI.
- The frontend consumes the backend through the generated API client and local UI state.
