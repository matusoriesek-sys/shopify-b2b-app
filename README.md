# B2B Pricing & Registration — Shopify App

Plnohodnotná B2B aplikácia pre Shopify s registráciou zákazníkov, schvaľovaním, cenovými segmentmi a automatickými zľavami.

## 🚀 Funkcie

### Registrácia & Schvaľovanie
- Registračný formulár na storefront (cez App Proxy)
- Admin panel na schvaľovanie/zamietanie registrácií
- Automatické vytvorenie/prepojenie Shopify zákazníka
- Customer metafield `custom.b2b` = true/false

### Cenové segmenty
- Vytváranie skupín zákazníkov (napr. Gold, Silver, Bronze)
- Základná percentuálna zľava pre segment
- Priradenie zákazníkov do segmentov

### Cenové pravidlá
- **Percentuálne** — zľava na všetky produkty v segmente
- **Po značkách/dodávateľoch** — rôzne zľavy pre rôzne brandy
- **Po type produktu** — špeciálne ceny pre kategórie
- Priorita pravidiel (vyššia = aplikuje sa prvá)

### Automatické ceny
- Shopify Function pre automatickú aplikáciu zliav
- Zákazník s `custom.b2b = true` dostane automatickú zľavu
- Žiadne kupóny — ceny sa zobrazia priamo

## 📋 Customer Metafieldy

| Metafield | Typ | Popis |
|-----------|-----|-------|
| `custom.b2b` | boolean | Je B2B zákazník |
| `custom.b2b_status` | text | pending / approved / rejected |
| `custom.b2b_segment` | text | Názov cenového segmentu |
| `custom.b2b_company` | text | Názov firmy |
| `custom.b2b_discount` | number | Percentuálna zľava |

## 🛠️ Setup

### 1. Inštalácia závislostí
```bash
npm install
```

### 2. Konfigurácia
```bash
# Prepojenie s Shopify Partners app
shopify app config link

# Development
shopify app dev
```

### 3. Databáza
```bash
npx prisma generate
npx prisma migrate dev
```

### 4. Metafieldy
Po prvom spustení appky klikni v Settings na "Vytvoriť metafieldy automaticky".

### 5. Deployment
```bash
# Deploy na Shopify (extensions + app)
shopify app deploy

# Alebo na Fly.io
fly launch
fly deploy
```

## 🏗️ Štruktúra

```
├── app/
│   ├── routes/
│   │   ├── app._index.tsx        # Dashboard
│   │   ├── app.registrations.tsx  # Registrácie management
│   │   ├── app.segments.tsx       # Cenové segmenty
│   │   ├── app.pricing.tsx        # Cenové pravidlá
│   │   ├── app.settings.tsx       # Nastavenia + metafieldy
│   │   ├── proxy.register.tsx     # Registračný formulár (App Proxy)
│   │   └── webhooks.tsx           # Webhook handlers
│   ├── shopify.server.ts          # Shopify config
│   └── db.server.ts               # Prisma client
├── extensions/
│   └── b2b-discount/              # Shopify Function pre zľavy
│       └── src/main.rs            # Rust WASM funkcia
├── prisma/
│   └── schema.prisma              # DB schéma
├── shopify.app.toml                # Shopify app config
└── package.json
```

## 🔧 Technológie

- **Remix** — full-stack React framework
- **Shopify App Remix** — Shopify SDK
- **Polaris** — Shopify UI komponenty
- **Prisma + SQLite** — databáza
- **Shopify Functions (Rust/WASM)** — serverless cenové pravidlá
- **App Proxy** — registračný formulár na storefront

## 📝 Dôležité poznámky

- App Proxy URL: `https://your-store.myshopify.com/apps/b2b/register`
- Shopify Function vyžaduje `shopify app deploy` pre aktiváciu
- SQLite databáza je lokálna — pre production odporúčam PostgreSQL
- Metafieldy sa dajú vytvoriť automaticky cez Settings

## 🔄 Workflow

1. Zákazník vyplní B2B registračný formulár na storefront
2. Admin vidí novú registráciu v appke
3. Admin schváli a priradí segment (napr. Gold — 30%)
4. Automaticky sa nastavia customer metafieldy
5. Pri ďalšom nákupe Shopify Function aplikuje zľavu
