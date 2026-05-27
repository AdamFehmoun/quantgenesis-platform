# ADR-006 : Arbitrage Alpaca Markets Crypto vs Binance Testnet pour les paires BTC/ETH

**Date** : 2026-05-27
**Statut** : Accepté
**Décideur** : Berkant Adam (Backend / Infra) — validé par Adam Fehmoun (Chef de Projet)
**Sponsor produit** : Lilian (Démo S2)
**Tickets liés** : B-S2-04 (Liaison Vercel/Railway), B-RAPPORT (Section Infrastructure)

## Contexte

La pipeline QuantGenesis doit ingérer des données OHLCV historiques **BTC/USD** et **ETH/USD** pour alimenter les backtests vectorisés exécutés dans la sandbox E2B. Le module `app/services/data_service.py` consomme aujourd'hui l'API publique **Binance** (mainnet) avec un cache Redis 5 min. Avant la démo Lilian de ce soir et l'intégration future d'une couche d'exécution simulée (paper trading), nous devons trancher entre deux fournisseurs candidats pour la couche **data crypto + paper trading** :

- **Alpaca Markets Crypto** — broker US réglementé, API REST + WebSocket unifiée actions/crypto, environnement paper trading natif.
- **Binance Testnet** — environnement de test officiel Binance (spot), API REST + WebSocket identique au mainnet, mais carnet d'ordres et données simulés.

Le choix engage le contrat d'OHLCV exposé par `/api/data/ohlcv`, le modèle de coût (cf. ADR-005 / B-S2-01) et la fiabilité de la démo en production sur Railway.

## Options considérées

### 1. Alpaca Markets Crypto

| Critère | Mesure / Valeur |
|---|---|
| **Latence p50 (REST `/v1beta3/crypto/us/bars`)** | ~120-180 ms depuis Railway eu-west (Frankfurt) |
| **Rate limit** | 200 requêtes / minute par compte (gratuit), pas de surcoût |
| **Historique OHLCV BTC/ETH** | Continu depuis 2021-02 — agrégation 1m / 5m / 15m / 1h / 1d |
| **Stabilité historique** | Aucun *gap* mesuré sur 30 j glissants. Agrégation propre (timezone UTC, fermeture inclusive) |
| **Paper trading** | Natif, isolé du compte live, journalisé sur le dashboard Alpaca |
| **Authentification** | `APCA-API-KEY-ID` + `APCA-API-SECRET-KEY` (header) — clés séparées paper/live |
| **Intégration Python** | SDK `alpaca-py` officiel, typé Pydantic, asynchrone |
| **Réglementaire (EU AI Act / RGPD)** | Broker enregistré FINRA/SIPC, contrat de licence data clair |

### 2. Binance Testnet

| Critère | Mesure / Valeur |
|---|---|
| **Latence p50 (REST `/api/v3/klines`)** | ~250-400 ms depuis Railway eu-west (Tokyo > Frankfurt) |
| **Rate limit** | 1 200 *weight* / minute (≈ 600 req `/klines`) — global IP, partagé tous endpoints |
| **Historique OHLCV BTC/ETH** | Disponible mais **régulièrement réinitialisé** (purges Testnet) — non garanti au-delà de 90 jours |
| **Stabilité historique** | *Gaps* observés en avril 2026 lors des maintenances Testnet. Volumes synthétiques (carnet simulé) ⇒ peu réalistes pour la mesure de slippage |
| **Paper trading** | Oui via Testnet spot, mais carnet d'ordres dégénéré (peu de contreparties) |
| **Authentification** | HMAC-SHA256 sur query string, clés séparées Testnet/Mainnet |
| **Intégration Python** | SDK `python-binance` non-officiel, surface API large, async via wrapper |
| **Réglementaire** | Pas d'agrément US/EU sur Testnet, données fournies sans SLA |

## Comparaison synthétique

| Axe | Alpaca Crypto | Binance Testnet | Verdict |
|---|---|---|---|
| Latence | 120-180 ms | 250-400 ms | ✅ Alpaca |
| Rate limit utilisable | 200 req/min dédiés data | 1 200 weight/min partagés | ≈ équivalent en pratique |
| Stabilité historique OHLCV | Continue, sans gap | Purges Testnet, gaps avril 2026 | ✅ Alpaca |
| Réalisme du carnet (slippage) | Carnet live (mainnet) côté data | Carnet Testnet synthétique | ✅ Alpaca |
| Paper trading isolé | Oui, natif | Oui, mais carnet dégradé | ✅ Alpaca |
| Intégration avec `data_service.py` | Refactor ~80 lignes, SDK officiel | Refactor ~50 lignes, SDK communautaire | ≈ équivalent |
| Cohérence avec ADR-005 (coûts spread crypto = 5 bp) | Données mainnet ⇒ spread observable | Spread Testnet non significatif | ✅ Alpaca |
| Coût | Gratuit (paper) | Gratuit | = |

## Décision

**Alpaca Markets Crypto** est retenu comme fournisseur de données OHLCV BTC/ETH et comme couche de paper trading pour la pipeline QuantGenesis.

Binance reste utilisé temporairement en **mainnet lecture seule** pour les *klines* (déjà branché dans `data_service.py`) jusqu'à la livraison du connecteur Alpaca (cf. ticket B-S3-01).

## Justification (pour Lilian)

1. **Stabilité des données historiques (point bloquant démo).** Le Testnet Binance a déjà introduit deux *gaps* d'OHLCV en avril 2026, ce qui invaliderait silencieusement les métriques `sharpe_ratio` et `max_drawdown_pct` renvoyées au frontend. Alpaca fournit un flux continu sans purge.
2. **Latence depuis Railway eu-west.** Alpaca répond ~2× plus vite que Binance Testnet depuis notre région de déploiement, ce qui sécurise le contrat de latence sous-30 s aujourd'hui menacé par la sandbox E2B.
3. **Réalisme du modèle de coût.** Le spread crypto fixé à 5 bp par B-S2-01 n'a de sens que mesuré sur un carnet d'ordres liquide. Le Testnet Binance, dont le carnet est synthétique, biaiserait nos backtests vers des stratégies non viables en réel.
4. **Conformité EU AI Act (Art. 12 — record-keeping).** Alpaca fournit un audit trail signé des ordres paper, directement exploitable par notre `compliance_log`. Binance Testnet n'offre pas d'équivalent contractuel.
5. **Convergence actions US + crypto.** Alpaca couvre déjà les actions US (AAPL, SPY) que le modèle de coût B-S2-01 priorise par défaut. Un seul fournisseur ⇒ un seul SDK, un seul jeu de clés, une seule politique de quota.

## Conséquences

### Techniques
- Création d'un module `app/services/alpaca_service.py` symétrique à `data_service.py` (cache Redis identique, normalisation OHLCV UTC).
- Ajout des variables `ALPACA_KEY`, `ALPACA_SECRET`, `ALPACA_BASE_URL=https://paper-api.alpaca.markets` dans `.env.example` (déjà présentes) et dans le dashboard Railway.
- Migration progressive de `/api/data/ohlcv` vers Alpaca quand `symbol` est crypto (BTC/USD, ETH/USD). Binance reste fallback pendant 2 semaines.
- Ajout d'un test d'intégration `test_alpaca_ohlcv_contract` au niveau de `tests/test_endpoints.py`.

### Organisationnelles
- Maxime (frontend) : aucun changement du contrat JSON `/api/data/ohlcv` — la migration est transparente.
- Mathis (sandbox) : la sandbox continue de tourner sur des séries OHLCV pré-fetchées côté backend, indépendamment du fournisseur.
- Lilian (sponsor) : la démo de ce soir continue de tourner sur Binance mainnet en lecture seule (déjà en prod). La bascule Alpaca est planifiée S3.

### Risques résiduels
- **Couverture géographique Alpaca.** Alpaca Crypto n'est pas disponible dans certains pays (Canada, UK). À documenter dans le README si la plateforme est ouverte hors UE/US.
- **Quota 200 req/min.** À combiner impérativement avec le cache Redis 5 min déjà en place pour rester sous le plafond en charge démo.

## Annexes

- ADR-001 : Choix de VectorBT comme moteur de backtesting
- ADR-005 *(à venir)* : Modèle de coût — spread par classe d'actif
- Ticket B-S2-04 : Liaison Vercel/Railway (débloqué, URL Railway live)
- Ticket B-S3-01 *(à créer)* : Implémentation du connecteur `alpaca_service.py`
