# VOID Pack — Next.js

## Setup

```bash
npm install
cp .env.example .env.local
# Remplir NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local
npm run dev
```

## Structure

- `src/app/(game)/` — vues du jeu (pack, collection, communauté, profil)
- `src/components/` — composants React (ui/, game/, layout/)
- `src/lib/` — clients Supabase, logique métier, utils
- `src/hooks/` — hooks React (auth, credits, collection...)
- `src/store/` — état global Zustand
- `src/types/` — types TypeScript

## Déploiement

Connecter le repo à Vercel, ajouter les variables d'env, déployer.
