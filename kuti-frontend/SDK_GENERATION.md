# SDK Generation Guide

## Overview

The frontend uses a **generated TypeScript SDK** from the backend's OpenAPI specification to ensure type safety and consistency between frontend and backend.

## Prerequisites

1. Backend server must be running: `cd ../kuti-backend && uv run uvicorn kuti_backend.api.main:app`
2. Backend must expose OpenAPI spec at: `http://localhost:8000/api/openapi.json`

## Generating the SDK

### Method 1: Using npm script (recommended)

```bash
npm run generate:api
```

This will:
- Fetch the OpenAPI spec from the running backend
- Generate TypeScript types and client code
- Output to `app/lib/api/generated/`

### Method 2: Manual configuration

Edit `openapi-ts.config.ts` if you need to customize:
- Input URL (default: `http://localhost:8000/api/openapi.json`)
- Output path (default: `./app/lib/api/generated`)
- Client type (default: `fetch`)
- Type generation options

## Generated Files

The SDK generation creates:

```
app/lib/api/generated/
├── index.ts          # Main entry point
├── types.ts          # TypeScript interfaces for all schemas
├── services/         # API service methods
│   ├── ProjectsService.ts
│   ├── CharactersService.ts
│   ├── StoryService.ts
│   └── ...
└── models/           # Additional model types
```

## Usage in the App

### Direct SDK usage

```typescript
import { ProjectsService } from './lib/api/generated';

const projects = await ProjectsService.getProjects();
```

### Via React Query hooks (recommended)

```typescript
import { useProjects } from './lib/api/hooks';

function MyComponent() {
  const { data: projects, isLoading } = useProjects();
  // ...
}
```

## Workflow

1. **Backend changes**: Modify backend models, schemas, or endpoints
2. **Restart backend**: Ensure changes are reflected in OpenAPI spec
3. **Regenerate SDK**: Run `npm run generate:api`
4. **Update hooks**: Modify `app/lib/api/hooks.ts` if new endpoints added
5. **TypeScript checks**: Run `npm run typecheck` to catch any issues

## Troubleshooting

### Error: "Cannot fetch OpenAPI spec"

**Solution**: Ensure backend is running at `http://localhost:8000`

```bash
cd ../kuti-backend
uv run uvicorn kuti_backend.api.main:app --reload
```

### Error: "Generated types conflict with existing code"

**Solution**: 
1. Check for breaking changes in backend schemas
2. Update transformation logic in `app/lib/api/api.ts`
3. Update React Query hooks in `app/lib/api/hooks.ts`

### Generated files are outdated

**Solution**: Delete generated folder and regenerate

```bash
rm -rf app/lib/api/generated
npm run generate:api
```

## Best Practices

1. **Regenerate after backend changes**: Always regenerate the SDK when backend schemas change
2. **Don't edit generated files**: Never manually modify files in `generated/`
3. **Use hooks layer**: Prefer React Query hooks over direct SDK calls
4. **Transform data when needed**: Use `app/lib/api/api.ts` for data transformations
5. **Commit generated files**: Include generated SDK in git for consistency

## Migration from Manual Client

The current `app/lib/api/api.ts` contains a manual API client. To migrate:

1. Generate the SDK: `npm run generate:api`
2. Review generated types in `generated/types.ts`
3. Update hooks in `hooks.ts` to use generated services
4. Gradually replace manual fetch calls with SDK methods
5. Keep transformation logic for UI-optimized data structures

## Configuration Reference

### openapi-ts.config.ts

```typescript
import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  client: 'fetch',                    // Use native fetch API
  input: 'http://localhost:8000/api/openapi.json',
  output: {
    path: './app/lib/api/generated',
    format: 'prettier',              // Format with prettier
    lint: 'eslint',                  // Lint with eslint
  },
  types: {
    enums: 'javascript',             // Generate JS enums
    dates: true,                     // Parse date strings
  },
  services: {
    asClass: false,                  // Generate service functions
  },
});
```

## CI/CD Integration

For automated workflows:

```yaml
# .github/workflows/frontend.yml
- name: Generate SDK
  run: |
    cd kuti-backend && uv run uvicorn kuti_backend.api.main:app &
    sleep 5
    cd ../kuti-frontend && npm run generate:api
```

## Next Steps

After SDK generation:

1. ✅ SDK generated successfully
2. 🔧 Update React Query hooks to use SDK
3. 🔧 Implement workspace pages (Characters, Story, etc.)
4. 🔧 Add i18n support
5. 🔧 Build advanced components (ProseMirror, Three.js)
