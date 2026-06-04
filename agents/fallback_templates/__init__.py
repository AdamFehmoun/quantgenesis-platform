"""
QuantGenesis — Fallback Templates Module
=========================================

Filet de sécurité pour la démo du 25 juin. Quand l'agent Codeur échoue à
produire du Python exécutable, le pipeline retombe sur ces templates
paramétrables qui marchent TOUJOURS.

Auteur : Paul Legeais — Lead Quant
Tâche  : P1 (J1 lundi 1er juin)

Usage par le pipeline :
    from agents.fallback_templates import select_template, run_template

    template_name = select_template(user_intent="RSI Bitcoin")
    result = run_template(template_name, asset="BTC-USD", period="1y")

Chaque template :
- Respecte les conventions CLAUDE.md (price=df['Open'], shift(1), fees/slippage)
- Passe le Critique v3 (filtre régime pour mean-reversion, alerte trades<5)
- Retourne un dict avec sharpe, drawdown, return, trades + script Python exportable
"""

from .rsi_template import build_rsi_template, run_rsi_template
from .ma_template import build_ma_template, run_ma_template
from .bollinger_template import build_bollinger_template, run_bollinger_template
from .momentum_template import build_momentum_template, run_momentum_template
from .selector import select_template, run_template

__all__ = [
    "build_rsi_template",
    "run_rsi_template",
    "build_ma_template",
    "run_ma_template",
    "build_bollinger_template",
    "run_bollinger_template",
    "build_momentum_template",
    "run_momentum_template",
    "select_template",
    "run_template",
]