# Phase 0 — Project Foundation

## Status: Complete

---

## Goal

Establish the repository structure and development environment so every subsequent phase has a stable, consistent foundation to build on.

This phase is about discipline, not features. A sloppy Phase 0 creates debt in every phase after it.

---

## Deliverables

- [ ] TypeScript project initialized (`tsconfig.json`)
- [ ] `package.json` with all base dependencies
- [ ] ESLint configured
- [ ] Prettier configured
- [ ] Vitest configured and running
- [ ] Executable CLI entrypoint (`index.ts`)
- [ ] Directory structure in place (empty dirs with `.gitkeep` as needed)
- [ ] One trivial test passing
- [ ] Dev script working (`npm run dev` or equivalent)

---

## Directory Structure to Create

```
Cortex/
├── src/
│   ├── core/          # Shared types, interfaces, constants
│   ├── agents/        # Agent config loading
│   ├── runtime/       # Claude process management
│   ├── ui/            # TUI components
│   └── storage/       # Transcript persistence
├── agents/            # Agent definition files (runtime data)
├── tests/             # Test files mirroring src/
├── docs/              # Phase plans (this directory)
├── index.ts           # CLI entrypoint
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .eslintrc.json
├── .prettierrc
└── CLAUDE.md
```

---

## Dependencies to Install

### Runtime
```
typescript
tsx           # for running TS directly during dev
```

### Dev
```
vitest
@types/node
eslint
@typescript-eslint/parser
@typescript-eslint/eslint-plugin
prettier
eslint-config-prettier
```

---

## CLI Entrypoint (`index.ts`)

Keep it trivial for now. No logic. Just proof it runs.

```ts
// index.ts
async function main() {
  console.log('Cortex starting...');
}

main().catch(console.error);
```

---

## `tsconfig.json` Requirements

- `strict: true`
- `target: ES2022` or later (for top-level await)
- `module: NodeNext` or `CommonJS` — decide and document in CLAUDE.md
- `outDir: dist/`
- `rootDir: ./`
- Include `src/**/*` and `index.ts`

---

## `vitest.config.ts` Requirements

- Point to `tests/` directory
- Enable globals for `describe`, `it`, `expect`
- No coverage required yet

---

## ESLint Requirements

- No `any` rule enabled
- No unused variables
- TypeScript-aware rules via `@typescript-eslint`

---

## Acceptance Criteria

- [ ] `npm run dev` prints "Cortex starting..." without errors
- [ ] `npm test` runs and one trivial test passes
- [ ] `npm run lint` passes with no errors
- [ ] TypeScript compiles without errors (`tsc --noEmit`)

---

## Test to Write

```ts
// tests/core/sanity.test.ts
import { describe, it, expect } from 'vitest';

describe('sanity', () => {
  it('true is true', () => {
    expect(true).toBe(true);
  });
});
```

Then immediately write the real Phase 0 tests:

```ts
// tests/cli/boot.test.ts
// Test that main() can be called without throwing
// Test that the process doesn't exit with code 1 on clean run
```

---

## What NOT to Do in This Phase

- Do not scaffold agent loading logic
- Do not connect to Claude
- Do not build any UI
- Do not add more dependencies than listed
- Do not add a barrel `index.ts` inside `src/`

---

## Completion Steps

1. Initialize project
2. Install dependencies
3. Configure tooling
4. Write trivial test, verify it passes
5. Write CLI boot tests
6. Run lint, fix any issues
7. Review structure — is it clean and extensible?
8. Update CLAUDE.md Phase Status table
9. Commit with message: `feat: phase 0 - project foundation`

---

## Next Phase

[Phase 1 — Agent Configuration System](./phase-1.md)
