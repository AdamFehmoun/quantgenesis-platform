"""B-CACHE — Cache Redis sélectif par agent.

TTL strict par agent (validés ADR Redis) :
    - Brainstormer  : infini  (déterministe sur intent court)
    - ChefProjet    : infini  (déterministe sur sortie Brainstormer)
    - Architecte    : 30 jours
    - Conformite    : 7 jours
    - Critique      : désactivé (sortie volatile, retry-feedback dynamique)

Le hook se branche dans BaseAgent.run() : check avant l'appel Anthropic,
write après. Si Redis est indisponible, on dégrade silencieusement (jamais
bloquant pour le pipeline — pattern aligné sur app.services.data_service).

Clé : qg:agent:{name}:{sha256_hex(model | prompt | input_json)[:32]}
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
from typing import Any, Optional

try:
    import redis
except ImportError:  # redis optionnel côté agents — dégradation gracieuse
    redis = None  # type: ignore[assignment]

logger = logging.getLogger(__name__)

# Sentinelles : None  → SET sans TTL (Redis garde indéfiniment)
#               -1    → cache désactivé (skip total)
_TTL_INFINITE: Optional[int] = None
_TTL_DISABLED: int = -1

AGENT_CACHE_TTL: dict[str, Optional[int]] = {
    "Brainstormer": _TTL_INFINITE,
    "ChefProjet":   _TTL_INFINITE,
    "Architecte":   30 * 24 * 3600,   # 2 592 000 s
    "Conformite":   7 * 24 * 3600,    # 604 800 s
    "Critique":     _TTL_DISABLED,
}

_KEY_PREFIX = "qg:agent"
_REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

_client: Any = None
_client_init_attempted = False


def _get_client() -> Any:
    """Singleton Redis lazy. Renvoie None si Redis indisponible (silent fallback)."""
    global _client, _client_init_attempted
    if _client is not None:
        return _client
    if _client_init_attempted:
        return None
    _client_init_attempted = True
    if redis is None:
        logger.warning("redis library unavailable — agent cache disabled")
        return None
    try:
        c = redis.Redis.from_url(_REDIS_URL, decode_responses=True)
        c.ping()
        _client = c
        return _client
    except Exception as exc:
        logger.warning("Redis unavailable (%s) — agent cache disabled", exc)
        return None


def _is_disabled(agent_name: str) -> bool:
    return AGENT_CACHE_TTL.get(agent_name, _TTL_DISABLED) == _TTL_DISABLED


def _ttl_for(agent_name: str) -> Optional[int]:
    """TTL en secondes, ou None pour SET sans expiration. Caller doit déjà
    avoir filtré le cas désactivé via _is_disabled."""
    return AGENT_CACHE_TTL.get(agent_name, _TTL_DISABLED)


def build_cache_key(agent_name: str, model: str, system_prompt: str, input_data: dict) -> str:
    """Hash déterministe qui invalide la clé si l'input, le prompt ou le
    modèle changent. sort_keys=True garantit la stabilité du JSON."""
    payload = json.dumps(
        {"model": model, "prompt": system_prompt, "input": input_data},
        ensure_ascii=False,
        sort_keys=True,
    ).encode("utf-8")
    digest = hashlib.sha256(payload).hexdigest()[:32]
    return f"{_KEY_PREFIX}:{agent_name}:{digest}"


def get_cached(agent_name: str, key: str) -> Optional[dict]:
    """Lecture cache. Renvoie None sur miss, Redis down, ou agent désactivé."""
    if _is_disabled(agent_name):
        return None
    client = _get_client()
    if client is None:
        return None
    try:
        raw = client.get(key)
    except Exception as exc:
        logger.warning("agent cache read failed (%s): %s", key, exc)
        return None
    if not raw:
        return None
    try:
        return json.loads(raw)
    except (TypeError, ValueError) as exc:
        logger.warning("agent cache corrupted entry for %s: %s", key, exc)
        return None


def put_cached(agent_name: str, key: str, value: dict) -> None:
    """Écriture cache. No-op sur Redis down, agent désactivé, ou échec sérialisation."""
    if _is_disabled(agent_name):
        return
    client = _get_client()
    if client is None:
        return
    try:
        payload = json.dumps(value, ensure_ascii=False, default=str)
    except (TypeError, ValueError) as exc:
        logger.warning("agent cache serialization failed for %s: %s", agent_name, exc)
        return
    ttl = _ttl_for(agent_name)
    try:
        if ttl is None:
            client.set(key, payload)            # infini
        else:
            client.setex(key, ttl, payload)     # TTL strict
    except Exception as exc:
        logger.warning("agent cache write failed (%s): %s", key, exc)


def invalidate_agent(agent_name: str) -> int:
    """Supprime toutes les entrées d'un agent (clé prefix scan).

    Utile quand un prompt est révisé : on flush l'agent sans purger le cache
    des autres. Renvoie le nombre de clés supprimées (0 si Redis down).
    """
    client = _get_client()
    if client is None:
        return 0
    pattern = f"{_KEY_PREFIX}:{agent_name}:*"
    try:
        keys = list(client.scan_iter(match=pattern, count=500))
        if not keys:
            return 0
        return int(client.delete(*keys))
    except Exception as exc:
        logger.warning("agent cache invalidate failed (%s): %s", agent_name, exc)
        return 0


def invalidate_all() -> int:
    """Flush global de tous les caches agents. Renvoie le nb de clés supprimées."""
    client = _get_client()
    if client is None:
        return 0
    pattern = f"{_KEY_PREFIX}:*"
    try:
        keys = list(client.scan_iter(match=pattern, count=500))
        if not keys:
            return 0
        return int(client.delete(*keys))
    except Exception as exc:
        logger.warning("agent cache global invalidate failed: %s", exc)
        return 0
