"""
Sélecteur de template — QuantGenesis Fallback
==============================================
Quand l'agent Codeur échoue, le pipeline appelle select_template(user_intent)
pour choisir le template le plus pertinent, puis run_template() l'exécute.

Logique de matching :
  - Mots "rsi", "oversold", "overbought" → RSI
  - Mots "ma", "sma", "ema", "crossover", "golden cross", "death cross" → MA Crossover
  - Mots "bollinger", "bbands", "bb" → Bollinger Bands
  - Mots "momentum", "roc", "rate of change" → Momentum
  - Défaut → MA Crossover (le plus robuste sur grandes périodes)

Auteur : Paul Legeais — Lead Quant
Tâche  : P1 (J1)
"""

import json
import re
from datetime import datetime, timezone

from .rsi_template import build_rsi_template, run_rsi_template
from .ma_template import build_ma_template, run_ma_template
from .bollinger_template import build_bollinger_template, run_bollinger_template
from .momentum_template import build_momentum_template, run_momentum_template


# ─────────────────────────────────────────────────────────────────
#  Détection de l'actif depuis l'intent
# ─────────────────────────────────────────────────────────────────

_ASSET_KEYWORDS = {
    "BTC-USD": ["btc", "bitcoin"],
    "ETH-USD": ["eth", "ethereum"],
    "SOL-USD": ["sol", "solana"],
    "SPY":     ["spy", "s&p", "s&p500", "sp500", "s and p"],
    "AAPL":    ["aapl", "apple"],
    "TSLA":    ["tsla", "tesla"],
    "QQQ":     ["qqq", "nasdaq", "nasdaq100"],
}


def _detect_asset(intent: str) -> str:
    intent_lower = intent.lower()
    for asset, keywords in _ASSET_KEYWORDS.items():
        for kw in keywords:
            if re.search(r"\b" + re.escape(kw) + r"\b", intent_lower):
                return asset
    return "BTC-USD"  # défaut crypto


def _is_crypto(asset: str) -> bool:
    return asset.endswith("-USD")


# ─────────────────────────────────────────────────────────────────
#  Sélection du template
# ─────────────────────────────────────────────────────────────────

_TEMPLATE_KEYWORDS = {
    "rsi": ["rsi", "oversold", "overbought", "relative strength"],
    "bollinger": ["bollinger", "bbands", "bb ", " bb", "bandes"],
    "momentum": ["momentum", "roc", "rate of change", "rate-of-change"],
    "ma": ["ma crossover", "sma", "ema", "moving average", "golden cross",
           "death cross", "crossover", "croisement", "moyenne mobile"],
}


def select_template(user_intent: str) -> str:
    """
    Retourne le nom du template le plus adapté à l'intent.
    Valeurs possibles : 'rsi', 'ma', 'bollinger', 'momentum'.
    """
    intent_lower = user_intent.lower()

    # Priorité aux templates explicites
    for name, keywords in _TEMPLATE_KEYWORDS.items():
        for kw in keywords:
            if kw in intent_lower:
                return name

    # Si l'intent mentionne "mean reversion" sans indicateur précis → Bollinger
    if "mean reversion" in intent_lower or "retour" in intent_lower or "reversion" in intent_lower:
        return "bollinger"

    # Si trend-following sans indicateur précis → MA
    if "trend" in intent_lower or "tendance" in intent_lower:
        return "ma"

    # Défaut sûr : MA Crossover (gère bien crypto et actions, drawdown maîtrisé)
    return "ma"


# ─────────────────────────────────────────────────────────────────
#  Exécution du template sélectionné
# ─────────────────────────────────────────────────────────────────

def run_template(
    template_name: str,
    user_intent: str = "",
    asset: str = None,
    period: str = None,
    return_script: bool = False,
    **kwargs,
) -> dict:
    """
    Exécute le template choisi avec les paramètres adaptés à l'asset.

    Args:
        template_name: 'rsi', 'ma', 'bollinger' ou 'momentum'
        user_intent:   l'intent original (pour détecter l'asset si non fourni)
        asset:         override de l'asset (ex. 'BTC-USD')
        period:        override de la période (ex. '2y')
        return_script: si True, ajoute le script Python généré au résultat
        **kwargs:      params spécifiques au template (rsi_window, ma_fast, etc.)

    Returns:
        dict avec metrics + métadonnées + (optionnel) script Python exportable
    """
    if asset is None:
        asset = _detect_asset(user_intent or "")

    is_crypto = _is_crypto(asset)

    # Période par défaut selon classe d'actif
    if period is None:
        period = "2y" if is_crypto else "5y"

    # Slippage ajusté crypto (spread bid/ask plus large)
    if "slippage" not in kwargs:
        kwargs["slippage"] = 0.0015 if is_crypto else 0.001

    # Dispatch
    if template_name == "rsi":
        metrics = run_rsi_template(asset=asset, period=period, **kwargs)
        script = build_rsi_template(asset=asset, period=period, **kwargs) if return_script else None
    elif template_name == "ma":
        metrics = run_ma_template(asset=asset, period=period, **kwargs)
        script = build_ma_template(asset=asset, period=period, **kwargs) if return_script else None
    elif template_name == "bollinger":
        metrics = run_bollinger_template(asset=asset, period=period, **kwargs)
        script = build_bollinger_template(asset=asset, period=period, **kwargs) if return_script else None
    elif template_name == "momentum":
        metrics = run_momentum_template(asset=asset, period=period, **kwargs)
        script = build_momentum_template(asset=asset, period=period, **kwargs) if return_script else None
    else:
        raise ValueError(f"Template inconnu: '{template_name}'. "
                         f"Attendu: 'rsi', 'ma', 'bollinger', 'momentum'.")

    result = {
        "status": "FALLBACK_SUCCESS",
        "template_selected": template_name,
        "user_intent": user_intent,
        **metrics,
    }
    if return_script:
        result["python_script"] = script
    return result


# ─────────────────────────────────────────────────────────────────
#  CLI de test
# ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys
    intent = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "RSI Bitcoin"
    print(f"User intent : {intent}")
    template = select_template(intent)
    print(f"Template selected : {template}")
    print(f"Asset detected : {_detect_asset(intent)}")
    print("─" * 60)
    result = run_template(template, user_intent=intent, return_script=True)
    print(json.dumps({k: v for k, v in result.items() if k != "python_script"}, indent=2))
    print("─" * 60)
    print("SCRIPT EXPORTABLE :")
    print(result.get("python_script", "—"))