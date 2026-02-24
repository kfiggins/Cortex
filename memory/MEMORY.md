# Cortex Project Memory

## Environment
- Node.js v18.20.7 — `import.meta.dirname` is NOT available (added in Node 20/21)
  - Use this pattern instead: `import { fileURLToPath } from 'url'; import { dirname } from 'path'; const __dirname = dirname(fileURLToPath(import.meta.url));`

## ESLint Setup (v9 flat config)
- Config file: `eslint.config.js` (not `.eslintrc`)
- Test files need their own `tests/tsconfig.json` extending root tsconfig with `"exclude"` override to remove `"../tests"` exclusion
- `tests/tsconfig.json` must NOT exclude itself (override parent's exclude with `["../node_modules", "../dist"]`)

## Tech Decisions Made
- Module system: ESM (`"type": "module"` in package.json, `"module": "NodeNext"` in tsconfig)
- Test runner: Vitest
- TUI library: TBD (Phase 5)
