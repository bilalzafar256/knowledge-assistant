---
name: shadcn-tailwind-v4
description: UI component conventions for this repo — shadcn/ui primitives and Tailwind CSS v4. Use when building or restyling components.
---

# shadcn/ui + Tailwind v4 (this repo)

## When to use
Adding or restyling UI components.

## Rules
- **Reuse primitives in `src/components/ui/`** (button, card, dialog, dropdown-menu, tabs, toast, popover, scroll-area, input, textarea, badge, skeleton) before hand-rolling.
- Feature components live in `src/components/` (`chat-*`, `document-*`, `collections-*`, `settings-*`, `dashboard-shell`, `sidebar-nav`).
- Compose class names with `cn()` from `@/lib/utils` (clsx + tailwind-merge).
- Tailwind **v4** — config in `tailwind.config.ts`, PostCSS via `@tailwindcss/postcss`; design tokens/theme in `src/app/globals.css`.
- Add new shadcn primitives via the CLI (`components.json` is configured); don't paste arbitrary versions.

## Rules of thumb
- Server Component by default; add `"use client"` only for interactive components.
- Match the existing component's structure, variants (`class-variance-authority`), and naming.

## Anchors
- `src/components/ui/**`, `src/components/**`, `tailwind.config.ts`, `components.json`, `src/lib/utils.ts`
