# Note technique — B-SANDBOX-TIMEOUT

**Auteur :** Berkant (backend)
**Date :** 2026-05-28 (J8, jour de la démo Lilian)
**Destinataire :** Mathis (sandbox E2B), CC Adam
**Statut :** Audit terminé — action requise côté sandbox

---

## 1. Contexte

Les 3 runs E2E joués en production ce matin contre Railway (`POST /api/pipeline/run`, intent `"RSI Bitcoin"`) renvoient tous un HTTP 200 avec une spec complète, mais `metrics.sharpe_ratio = 0.0`, `total_return_pct = 0.0`, `max_drawdown_pct = 0.0`. Le portfolio vectorbt ne s'exécute pas jusqu'au bout côté E2B.

Le but de cette note est de confirmer **d'où vient la coupure**, et en particulier que **notre backend n'interrompt pas la requête avant E2B**.

---

## 2. Chaîne de timeouts (du client vers E2B)

| Couche | Fichier | Valeur | Comment |
|---|---|---|---|
| Client de test E2E | `backend/tests/test_production_e2e.py:24` | **180 s** | Volontairement large pour absorber les 2 min du pipeline complet. |
| Worker uvicorn / Railway | (infra) | défaut Railway (>120 s observé) | Les 3 runs prod ont mis 118–125 s, ils passent. |
| Handler FastAPI `/api/pipeline/run` | `backend/app/api/pipeline.py:102-186` | **aucun timeout explicite** | Pas de `asyncio.wait_for`, pas de `httpx.Timeout`. Le handler est synchrone. |
| Bridge backend → sandbox | `backend/app/api/pipeline.py:72-87` (`_run_sandbox_backtest`) | **aucun timeout transmis** | Signature actuelle : `_run_sandbox_backtest(code, spread=spread)`. **Le kwarg `timeout` n'est jamais passé.** |
| Sandbox E2B | `sandbox/executor.py:56` (`run_backtest`) | **`timeout: int = 30`** (défaut) | Valeur appliquée à `s.run_code(..., timeout=timeout)` ligne 80. Le code de gestion d'erreur ligne 131–157 hardcode le label `'timeout_30s'`. |

**Conclusion factuelle :** la seule borne effective est **les 30 s par défaut dans `sandbox/executor.py`**, exécutés à l'intérieur d'E2B. Notre backend ne coupe rien en amont.

---

## 3. Preuve d'observation (runs prod J8)

```
[OK] /api/pipeline/run #1 -> 200 in 124666 ms (status=success, sharpe=0.0)
[OK] /api/pipeline/run #2 -> 200 in 118778 ms (status=success, sharpe=0.0)
[OK] /api/pipeline/run #3 -> 200 in 118029 ms (status=success, sharpe=0.0)
```

Sharpe à 0.0 sur 3 runs consécutifs alors que le code embarqué exécute un `vbt.Portfolio.from_signals` non trivial sur 1 an de BTC → signature classique d'un timeout E2B avalé silencieusement, le bloc `metrics` retombant sur le défaut `0.0` via `_build_metrics()` (`backend/app/api/pipeline.py:90-99`).

---

## 4. Demande à Mathis

Pour obtenir des métriques réelles (Sharpe non nul) en production :

1. **Passer le défaut de `run_backtest` à 60 s** dans `sandbox/executor.py:56` :
   ```python
   def run_backtest(code: str, timeout: int = 60, spread: float = 0.0001) -> dict:
   ```
2. **Mettre à jour le label d'erreur** ligne 134 et 154 de `'timeout_30s'` vers `'timeout_60s'` (sinon les logs et le frontend renverront un label trompeur).

Côté backend, **aucune modification n'est requise** : `_run_sandbox_backtest` ne passe pas de `timeout` explicite, donc bumper le défaut suffit. Si on veut un kill-switch côté backend, on ajoutera `timeout=60` au call site `pipeline.py:154` une fois la PR de Mathis mergée — pas avant, pour éviter de masquer le défaut.

**Marge confortable côté HTTP :** notre client E2E utilise 180 s, Railway ne coupe pas avant ~120 s observés. 60 s d'E2B + ~60 s d'agents LLM = ~120 s end-to-end, on reste sous tous les plafonds.

---

## 5. Action immédiate

- [ ] Mathis : PR pour bumper `timeout: int = 30` → `60` dans `sandbox/executor.py`.
- [ ] Berkant : revalider 1 run prod après merge, vérifier Sharpe ≠ 0.
- [ ] Si Sharpe toujours à 0 après bump : creuser la sortie `stderr`/`logs.stderr` du sandbox (`executor.py:128`) — pourrait être un crash silencieux côté vectorbt et pas un timeout.
