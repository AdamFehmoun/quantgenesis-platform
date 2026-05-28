# Note d'ingénierie — B-CACHE : Cache sélectif par agent (Redis)

**Auteur :** Berkant (backend)
**Date :** 2026-05-28 (J8)
**Destinataire :** Adam (optimisations S3) — pour intégration dans son Notion
**Objet :** Faisabilité et design d'un cache Redis par-agent avec TTL différenciés

---

## 1. Besoin (rappel)

Adam veut mutualiser les sorties LLM des agents (`brainstormer`, `architect`, `compliance`, `code_generator`, etc.) afin de :

- réduire la facture tokens sur les intents répétés ou très proches,
- raccourcir la latence du pipeline complet (aujourd'hui ~120 s observés en prod),
- garder la fraîcheur des agents dont la sortie dépend de données mouvantes (compliance, market data).

→ un seul TTL global est inadapté : un `brainstormer` peut sans risque réutiliser sa sortie pendant 24 h, alors qu'un agent qui lit le carnet d'ordres ne devrait pas dépasser quelques secondes.

---

## 2. Faisabilité — réponse courte

**Oui, faisable sans friction**, et la stack le supporte déjà :

- `redis>=5.0` est listé dans `backend/pyproject.toml` (donc le client est en place).
- Le bridge `_run_agents_pipeline` (`backend/app/api/pipeline.py:49-69`) est un wrapper isolé : on peut intercaler une couche cache en amont/aval sans toucher au repo agents.
- Les sorties d'agents sont des dicts JSON-sérialisables (vérifié sur `final_spec` et `compliance_log` retournés par `/api/pipeline/run`), donc directement stockables en Redis.

---

## 3. Nomenclature des clés

Format recommandé :

```
agent:{agent_id}:{intent_hash}:v{schema_version}
```

| Segment | Exemple | Rôle |
|---|---|---|
| `agent` | `agent` | Namespace global pour distinguer du reste de Redis (rate-limit, etc.). |
| `{agent_id}` | `brainstormer`, `architect`, `compliance` | Permet le `SCAN agent:brainstormer:*` pour purge ciblée. |
| `{intent_hash}` | `sha256(normalize(intent))[:16]` | Évite les clés > 512 B et la fuite d'intent en clair. Normalisation : lowercase + strip + collapse whitespaces. |
| `v{schema_version}` | `v1`, `v2` | Bump du suffixe = invalidation atomique de toutes les entrées d'un agent en cas de changement de prompt système. |

Exemple complet : `agent:brainstormer:7d9f2c1a4b8e0316:v1`

**Pourquoi pas `agent:{agent_id}:cache` (proposition initiale d'Adam) :** ce format ne distingue pas les intents → une seule entrée par agent → 99 % de cache miss inutiles. Le hash de l'intent dans la clé est non-négociable.

---

## 4. Stratégie TTL par dynamicité d'agent

| Agent | Dépend de | TTL recommandé | Raison |
|---|---|---|---|
| `brainstormer` | Intent utilisateur uniquement | **24 h** (86 400 s) | Idée de stratégie pour "RSI Bitcoin" ne change pas d'un jour à l'autre. |
| `architect` | Sortie `brainstormer` | **6 h** (21 600 s) | Sensible aux évolutions de la lib `vectorbt` que l'on bump rarement. |
| `code_generator` | Sortie `architect` | **6 h** | Idem — code Python déterministe à partir d'une archi fixée. |
| `compliance` | Règles internes + intent | **1 h** (3 600 s) | Les règles compliance peuvent bouger en cours de sprint (cf. décision juridique évoquée par Lilian). |
| `market_data_agent` (si introduit) | Prix temps réel | **30 s** | Au-delà, on cache un prix périmé — pire qu'un miss. |
| `backtest` (sandbox E2B) | Code + données | **Pas de cache** | Déterministe sur même code, mais coût E2B ~2 s/run, ROI cache négligeable et risque de fausser les démos. |

Mécanisme : `SET agent:{...} {json} EX {ttl}` à l'écriture. Pas de touch-on-read (réutilisation d'un cache vieux de 23 h sur un agent à 24 h est OK, on ne le prolonge pas — évite la dérive infinie).

---

## 5. Invalidation

Trois leviers, par ordre d'utilisation :

### 5.1 Invalidation passive (par TTL)
Le 99 % des cas. Pas de code à écrire — Redis expire seul.

### 5.2 Invalidation ciblée (bump de version)
Quand on change un prompt système d'agent ou son contrat de sortie :
- bump `schema_version` (`v1` → `v2`) dans la config de l'agent,
- toutes les anciennes clés deviennent orphelines et expirent seules via TTL,
- pas de `DEL` massif (qui bloquerait Redis sur un keyspace gros).

### 5.3 Invalidation active (par scan)
Pour un incident (sortie LLM corrompue, prompt cassé en prod) :
```python
for key in redis.scan_iter(match=f"agent:{agent_id}:*", count=500):
    redis.delete(key)
```
`SCAN` en lot de 500 — **jamais `KEYS *`** sur prod (bloque le single-thread Redis).

### 5.4 Cohérence avec le pipeline
La clé inclut l'intent hashé → si l'utilisateur reformule, miss naturel.
La clé n'inclut **pas** de timestamp → deux requêtes simultanées avec le même intent partagent la même clé (souhaitable).

---

## 6. Intégration dans le bridge existant

Point d'insertion proposé, sans casser l'API publique :

```python
# backend/app/services/agent_cache.py (à créer)
def get_or_compute(agent_id: str, intent: str, compute_fn, ttl: int) -> dict:
    key = f"agent:{agent_id}:{_intent_hash(intent)}:v1"
    cached = redis_client.get(key)
    if cached:
        return json.loads(cached)
    result = compute_fn()
    redis_client.set(key, json.dumps(result), ex=ttl)
    return result
```

Côté `pipeline.py`, on enveloppe `_run_agents_pipeline` agent par agent, plutôt que la pipeline entière — sinon on ne profite que des intents identiques mot pour mot.

→ **Ce wrapping doit vivre dans le repo `agents/` (côté Adam)**, pas dans le backend : c'est lui qui orchestre les agents et connaît le découpage par étape.

---

## 7. Risques & garde-fous

| Risque | Mitigation |
|---|---|
| Cache pollué par une sortie LLM cassée | TTL court par défaut + bouton "purge agent" via 5.3. |
| Memory bloat Redis | Plan Railway Redis = ~256 MB. Estimation : 10k entrées × 5 KB = 50 MB → confortable. `maxmemory-policy = allkeys-lru` en filet de sécurité. |
| Démo Lilian (J8 20h) | **Ne pas activer ce cache avant la démo.** Risque de réponse instantanée qui casse la narration "le pipeline réfléchit". À shipper en S3, post-démo. |
| Tests E2E qui hit le cache et masquent une régression | Préfixer la clé en environnement test (`agent-test:...`) et flusher avant chaque session. |

---

## 8. TL;DR pour le Notion d'Adam

- Format clé : `agent:{agent_id}:{sha256(intent)[:16]}:v{schema_version}`
- TTL : 24 h (brainstormer) → 30 s (market data) — calibrer sur la dynamicité, pas une valeur unique
- Invalidation : TTL passif + bump de version pour les changements de contrat + `SCAN`/`DEL` pour les incidents
- Implémentation côté `agents/`, pas backend — backend reste un consommateur via le bridge existant
- À shipper **post-démo J8**, pas avant
