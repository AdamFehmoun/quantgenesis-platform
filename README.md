# QuantGenesis Platform

> Infrastructure de méta-trading "White-Box" pilotée par agents IA et sécurisée par isolation matérielle.

## Vision

QuantGenesis permet de convertir une intention stratégique en langage naturel en code Python complexe, auditable et exportable. L'utilisateur décrit sa stratégie, la plateforme génère, backteste et optimise le code sous-jacent dans un environnement sécurisé conforme à l'AI Act européen.

```
"Stratégie momentum Bitcoin, drawdown max 10%"
                    ↓
        Pipeline IA multi-agents
                    ↓
    Code VectorBT généré + audité
                    ↓
    Backtest vectorisé en < 30 secondes
                    ↓
    Export White-Box + Log conformité AI Act
```

## Stack Technique

| Couche | Technologie | Rôle |
|--------|------------|------|
| Backend | FastAPI + Python 3.11 | API transactionnelle |
| Frontend | Next.js 14 + Tailwind | Dashboard de supervision |
| Backtesting | VectorBT Pro | Moteur quantitatif vectorisé |
| Sandbox | E2B (Firecracker MicroVM) | Exécution sécurisée du code |
| Base de données | PostgreSQL (Supabase) | Persistance + historique |
| Cache | Redis (Upstash) | Cache données financières |
| Données | FMP + Alpaca | Flux historiques + paper trading |
| IA | Gemini Pro + Claude | Pipeline d'agents spécialisés |
| Infra | Docker + GitHub Actions | CI/CD + déploiement |

## Architecture

```
quantgenesis-platform/
├── backend/
│   └── app/
│       ├── api/          # Endpoints FastAPI
│       ├── agents/       # Intégration pipeline agents
│       ├── models/       # Modèles SQLModel
│       └── services/     # Logique métier (backtest, data, sandbox)
├── frontend/
│   └── src/
│       ├── components/   # Composants React réutilisables
│       ├── pages/        # Pages Next.js
│       └── hooks/        # Custom hooks
├── sandbox/              # Configuration E2B
├── data/                 # Pipelines données FMP/Alpaca
├── docs/
│   └── adr/              # Architecture Decision Records
└── .github/
    └── workflows/        # CI/CD GitHub Actions
```

## Équipe

| Membre | Filière | Rôle | Ownership |
|--------|---------|------|-----------|
| Adam Fehmoun | E3S | Chef de Projet + Lead IA | `/backend/app/agents/` |
| Paul Legeais | E3S | Lead Quant + IA | `/backend/app/agents/` |
| Berkant Baskin | E3FD | Lead Backend + Data | `/backend/app/api/` `/data/` |
| Mathis Gibouin | E3FD | Sandbox + Sécurité | `/sandbox/` |
| Maxime Pierrard | E3E | Lead Frontend + Finance | `/frontend/` |

## Démarrage rapide

### Prérequis
- Python 3.11+
- Node.js 18+
- Docker + Docker Compose
- uv (gestionnaire de paquets Python)

### Installation

```bash
# 1. Cloner le repo
git clone https://github.com/AdamFehmoun/quantgenesis-platform
cd quantgenesis-platform

# 2. Backend
cd backend
uv venv --python 3.11
source .venv/bin/activate
uv sync

# 3. Frontend
cd ../frontend
npm install

# 4. Variables d'environnement
cp .env.example .env
# Remplir les valeurs (voir Adam pour les clés)

# 5. Lancer l'environnement complet
docker compose up
```

## Workflow Git

```bash
# Toujours partir de main à jour
git checkout main && git pull

# Créer sa branche
git checkout -b feat/nom-de-la-feature

# Commiter régulièrement
git commit -m "feat(backend): add backtest endpoint"

# Ouvrir une PR → review obligatoire avant merge
```

### Convention de commits

```
feat(scope):     nouvelle fonctionnalité
fix(scope):      correction de bug
refactor(scope): refactoring sans changement fonctionnel
docs(scope):     documentation
test(scope):     ajout/modification de tests
chore(scope):    maintenance, dépendances
```

Scopes : `backend` `frontend` `sandbox` `data` `agents` `infra`

## Règles d'équipe

- **Standup** posté sur Discord avant midi chaque jour
- **Règle des 30 min** : bloqué → #blocages immédiatement
- **Pas de push direct sur main** — toujours une PR reviewée
- **Secrets uniquement dans Infisical** — jamais dans le code
- **Feature freeze semaine 6** — zéro nouvelle feature après S6
- **Tests passent** avant d'ouvrir une PR

## Jalons

| Semaine | Livrable |
|---------|----------|
| S1 | CLI end-to-end fonctionnel |
| S2 | 1re stratégie backtestée live |
| S3 | Alpha interne — Black-Litterman + HRP |
| S4 | Conformité AI Act + Walk-forward |
| S5 | Beta — Paper trading Alpaca |
| S6 | Feature freeze — démo prête |
| S7 | Jour des Projets (25 juin) + Soutenance |

## Conformité

QuantGenesis intègre nativement les exigences de l'AI Act européen (Article 12) via un agent de conformité dédié qui génère automatiquement les logs de traçabilité pour chaque décision IA.

---

*Projet E3 ESIEE Paris 2025-2026 — Université Gustave Eiffel*
