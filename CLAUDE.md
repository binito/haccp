# HACCP — Guia para Claude

## Visão geral

Monorepo (Turborepo + npm workspaces) com dois apps:

```
apps/
  api/        NestJS + Prisma + MariaDB  (porta 3003)
  web/        Next.js 14 App Router      (porta 3002)
```

## ⚠️ IMPORTANTE: a "app móvel" é a PWA em apps/web

**Não existe app nativa.** A interface usada no telemóvel é o **Next.js** (`apps/web`) acedido via browser. O routing deteta o dispositivo e redireciona:

- **Desktop/laptop** → `/(dashboard)/` — portal de gestão completo
- **Telemóvel** → `/app/` — interface mobile-first (PWA)

Qualquer trabalho de "interface móvel" deve ser feito em:
```
apps/web/src/app/app/
```

## Deploy

- **Servidor:** Raspberry Pi em `192.168.1.176`

Após alterações, reiniciar os servidores sem pedir confirmação:
```bash
# API (NestJS)
pkill -f "nest start" && cd /home/jorge/haccp && npm run dev --workspace=apps/api &

# Web (Next.js)
pkill -f "next dev" && cd /home/jorge/haccp && npm run dev --workspace=apps/web &
```

## Stack

| Camada | Tecnologia |
|---|---|
| API | NestJS, Prisma ORM, MariaDB, JWT, class-validator |
| Web dashboard | Next.js 14 App Router, Tailwind CSS, TanStack Query, Zustand |
| Web mobile (`/app/`) | Next.js 14, Tailwind CSS, TanStack Query, react-hot-toast |
| Auth | JWT guardado em localStorage; `useAuthStore` (Zustand) |

## Estrutura web — interfaces

### Dashboard (desktop) — `apps/web/src/app/(dashboard)/`
- Sidebar colapsável com grupos (`Sidebar.tsx`)
- Páginas: dashboard, users, clients, areas, checklists, anomalies, consumables, products, temperature, registos/*

### Mobile PWA — `apps/web/src/app/app/`
- Layout: header fixo + barra de navegação inferior
- Nav: Início, Checklists, Anomalias, Consumíveis, Registos
- Padrão de página: tabs "Histórico / Novo Registo" com bottom-sheet ou formulário inline
- Toast notifications (`react-hot-toast`) em vez de alerts
- Páginas: page.tsx (home), checklists/, anomalias/, consumiveis/, temperaturas/, registos/*

## Registos HACCP (`/registos/`)

Implementados tanto no dashboard como na interface móvel:

| Código | Nome | Rota dashboard | Rota móvel |
|---|---|---|---|
| R1 | Entradas | `/registos/entradas` | `/app/registos/entradas` |
| R2 | Temperaturas | `/registos/temperaturas` | `/app/registos/temperaturas` |
| R3 | Higienização | `/registos/higienizacao` | `/app/registos/higienizacao` |
| R4 | Desinfeção | `/registos/desinfecao` | `/app/registos/desinfecao` |
| R6 | Óleos de Fritura | `/registos/oleos` | `/app/registos/oleos` |

API endpoints: `GET/POST /registos/{entradas|higienizacao|desinfecao|oleos}`

## Base de dados (Prisma)

Modelos principais: `User`, `Client`, `Area`, `ChecklistTemplate`, `ChecklistTask`, `ChecklistEntry`, `ChecklistTaskResult`, `AnomalyReport`, `AnomalyPhoto`, `ConsumableStock`, `ConsumableReport`, `Consumption`, `TemperatureEquipment`, `TemperatureRecord`, `Product`

Modelos HACCP: `EntradaRecord`, `HigienizacaoRecord`, `DesinfecaoRecord`, `OleoFrituraRecord`

Migrations em: `apps/api/prisma/migrations/`

## Roles

- `SUPER_ADMIN` — acesso total, vê todos os clientes
- `CLIENT_ADMIN` — acesso total ao seu cliente
- `OPERATOR` — acesso operacional (registos, checklists, anomalias)
