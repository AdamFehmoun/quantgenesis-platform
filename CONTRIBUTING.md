# Guide de contribution — QuantGenesis

## Setup en 10 minutes

```bash
git clone https://github.com/AdamFehmoun/quantgenesis-platform
cd quantgenesis-platform
cp .env.example .env
# Demander les clés API à Adam sur Discord
docker compose up
```

## Workflow quotidien

```bash
# Début de journée — toujours partir de main à jour
git checkout main
git pull origin main

# Créer sa branche
git checkout -b feat/ma-feature

# Bosser... commits réguliers (toutes les 45 min minimum)
git add .
git commit -m "feat(backend): description claire de ce qui a changé"

# Fin de journée — push + PR
git push origin feat/ma-feature
# → Ouvrir PR sur GitHub → assigner un reviewer
```

## Convention de commits

```
feat(scope):     nouvelle fonctionnalité
fix(scope):      correction de bug  
refactor(scope): refactoring
docs(scope):     documentation
test(scope):     tests
chore(scope):    maintenance
```

**Scopes valides** : `backend` `frontend` `sandbox` `data` `agents` `infra` `docs`

**Exemples :**
```
feat(backend): add /api/backtest endpoint
fix(frontend): correct Sharpe ratio display
docs(adr): add ADR-002 for E2B sandboxing choice
test(agents): add brainstormer unit tests
```

## Ownership des fichiers

| Dossier | Owner | Règle |
|---------|-------|-------|
| `/backend/app/agents/` | Adam + Paul | PR review obligatoire par Adam |
| `/backend/app/api/` | Berkant | |
| `/data/` | Berkant | |
| `/sandbox/` | Mathis | |
| `/frontend/` | Maxime | |
| `/docs/` | Tout le monde | |

**Modifier un fichier hors de son ownership** → ouvrir une issue d'abord.

## Definition of Done

Une issue est **Done** quand :

- [ ] Tests unitaires écrits et verts
- [ ] Tests d'intégration passent
- [ ] Code reviewé et approuvé par 1 autre membre
- [ ] Pas de secrets dans le code
- [ ] `docker compose up` fonctionne toujours
- [ ] Démo live devant au moins 1 autre membre
- [ ] Issue Linear fermée avec commentaire

## Règles absolues

- **Jamais de push direct sur `main`** — toujours une PR
- **Jamais de clé API dans le code** — Infisical uniquement
- **Règle des 30 min** : bloqué → #blocages Discord immédiatement
- **Feature freeze semaine 6** — aucune nouvelle feature après S6

## Branches

```
main        → stable, déployable, protégée
dev         → intégration des features
feat/xxx    → nouvelle feature
fix/xxx     → correction de bug
docs/xxx    → documentation
```
