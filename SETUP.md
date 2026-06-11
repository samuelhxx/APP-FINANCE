# Setup: Next.js + shadcn/ui + Tailwind + TypeScript

The current `app-finance` project is vanilla HTML/CSS/JS and does not support React,
TypeScript, Tailwind, or shadcn. The components in `components/ui/` require this stack.

## 1. Bootstrap a new Next.js project with shadcn

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir no --import-alias "@/*"
```

## 2. Initialize shadcn/ui

```bash
npx shadcn@latest init
```

Choose:
- Style: Default
- Base color: Neutral  
- CSS variables: Yes

This creates `components/ui/` automatically. **That folder is the standard path**
for all shadcn components — importing as `@/components/ui/<name>` works out of the box.

## 3. Install dependencies for the components

```bash
npm install next react react-dom
npm install -D typescript @types/react @types/node tailwindcss
```

## 4. Apply the config files (already in this branch)

- `tailwind.config.js` — already contains the extended theme tokens
- `app/globals.css` — already contains the extended CSS variables and animations

## 5. Add remote image domains (for scroll-cards)

In `next.config.ts`, allow Unsplash images:

```ts
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
}
export default nextConfig
```

## 6. Use the components

```tsx
// Entropy canvas animation
import { EntropyDemo } from '@/components/ui/entropy-demo'

// Sticky scroll cards
import { ScrollCardsDemo } from '@/components/ui/scroll-cards-demo'
```

Both components use `'use client'` so they work inside the Next.js App Router.
