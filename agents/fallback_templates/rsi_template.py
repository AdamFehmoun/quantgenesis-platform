"""
Template RSI paramétrable — QuantGenesis Fallback
==================================================
Stratégie : RSI Oversold/Overbought avec filtre de régime MA200 (Critique v3).

Si l'utilisateur demande "RSI Bitcoin", "RSI ETH" ou similaire et que
l'agent Codeur échoue, le pipeline appelle ce template.

Auteur : Paul Legeais — Lead Quant
Tâche  : P1 (J1)
"""

import json
from datetime import datetime, timezone


def _v(x):
    """Helper VectorBT 1.0.0 : gere Series 1-element et scalaires."""
    return x.item() if hasattr(x, "item") else float(x)


# ─────────────────────────────────────────────────────────────────
#  Génération du script Python exportable (pour la sandbox E2B)
# ─────────────────────────────────────────────────────────────────

def build_rsi_template(
    asset: str = "BTC-USD",
    period: str = "1y",
    rsi_window: int = 14,
    rsi_oversold: int = 30,
    rsi_overbought: int = 70,
    ma_regime_window: int = 200,
    fees: float = 0.001,
    slippage: float = 0.001,
    init_cash: float = 100_000,
    sizing: float = None,
    sl_stop: float = None,
    sl_trail: float = None,
    regime_filter: bool = True,
) -> str:
    """
    Génère un script Python autonome qui :
    - Télécharge les données via yfinance
    - Calcule le RSI et la MA200 (filtre de régime — Critique v3)
    - Exécute le backtest VectorBT avec anti-look-ahead bias
    - Affiche les 4 métriques standard

    Params sur-mesure (étape 1, defaults sûrs = comportement historique) :
    - sizing       : fraction du capital par trade (size_type='percent'). None -> all-in vbt par défaut.
    - sl_stop      : stop-loss fixe (fraction). None -> pas de stop fixe.
    - sl_trail     : stop suiveur (fraction). None -> pas de trailing stop.
    - regime_filter: si True (défaut), n'achète que si close > MA (filtre de régime Critique v3).

    Avec sizing/sl_stop/sl_trail=None et regime_filter=True, le script généré est
    STRICTEMENT identique à la version d'origine (zéro régression).

    Retourne le script sous forme de string, prêt à exécuter en sandbox.
    """
    # --- Bloc indicateurs + signaux (filtre de régime conditionnel) ---
    if regime_filter:
        signal_block = f'''rsi = vbt.RSI.run(close, window={rsi_window})
ma_regime = vbt.MA.run(close, window={ma_regime_window})

# 3. Signaux avec FILTRE DE REGIME (Critique v3)
# Mean-reversion long uniquement si close > MA200 (tendance haussiere)
trend_up = (close > ma_regime.ma).shift(1).fillna(False).astype(bool)
entries_raw = rsi.rsi_below({rsi_oversold}).shift(1).fillna(False).astype(bool)
exits_raw = rsi.rsi_above({rsi_overbought}).shift(1).fillna(False).astype(bool)
entries = entries_raw & trend_up
exits = exits_raw'''
    else:
        signal_block = f'''rsi = vbt.RSI.run(close, window={rsi_window})

# 3. Signaux (SANS filtre de regime)
entries_raw = rsi.rsi_below({rsi_oversold}).shift(1).fillna(False).astype(bool)
exits_raw = rsi.rsi_above({rsi_overbought}).shift(1).fillna(False).astype(bool)
entries = entries_raw
exits = exits_raw'''

    # --- Lignes optionnelles de from_signals (sizing + stops) ---
    # Vide par défaut -> from_signals identique à l'origine.
    extra_lines = ""
    if sizing is not None:
        extra_lines += f"    size={sizing},\n    size_type='percent',\n"
    if sl_stop is not None:
        extra_lines += f"    sl_stop={sl_stop},\n"
    if sl_trail is not None:
        extra_lines += f"    sl_trail={sl_trail},\n"

    return f'''import pandas as pd
import vectorbt as vbt
import yfinance as yf

pd.set_option('future.no_silent_downcasting', True)

def _scalar(x):
    return float(x.iloc[0]) if hasattr(x, 'iloc') else float(x)

# 1. Données
df = yf.download("{asset}", period="{period}", auto_adjust=True, progress=False)
if df.empty:
    raise RuntimeError(f"Pas de donnees pour {asset}")

# 2. Indicateurs
close = df["Close"].squeeze()
{signal_block}

# 4. Backtest VectorBT — convention CLAUDE.md
pf = vbt.Portfolio.from_signals(
    df["Open"],
    entries=entries,
    exits=exits,
    fees={fees},
    slippage={slippage},
    init_cash={init_cash},
{extra_lines}    freq="1D",
)

# 5. Metriques standard (les 4 print finaux exiges)
print(f"Sharpe   : {{_scalar(pf.sharpe_ratio()):.4f}}")
print(f"Drawdown : {{_scalar(pf.max_drawdown()):.4f}}")
print(f"Return   : {{_scalar(pf.total_return()):.4f}}")
print(f"Trades   : {{int(_scalar(pf.trades.count()))}}")
print(f"Winrate  : {{_scalar(pf.trades.win_rate()) * 100:.2f}}")
'''


# ─────────────────────────────────────────────────────────────────
#  Exécution locale (pour validation du template)
# ─────────────────────────────────────────────────────────────────

def run_rsi_template(
    asset: str = "BTC-USD",
    period: str = "1y",
    **kwargs,
) -> dict:
    """
    Exécute le template RSI localement et retourne les métriques.
    Utilisé pour validation hors-sandbox.
    """
    import pandas as pd
    import vectorbt as vbt
    import yfinance as yf
    pd.set_option('future.no_silent_downcasting', True)

    rsi_window = kwargs.get("rsi_window", 14)
    rsi_oversold = kwargs.get("rsi_oversold", 30)
    rsi_overbought = kwargs.get("rsi_overbought", 70)
    ma_regime_window = kwargs.get("ma_regime_window", 200)
    fees = kwargs.get("fees", 0.001)
    slippage = kwargs.get("slippage", 0.001)
    init_cash = kwargs.get("init_cash", 100_000)
    # Params sur-mesure (étape 1) — defaults sûrs = comportement historique.
    sizing = kwargs.get("sizing")
    sl_stop = kwargs.get("sl_stop")
    sl_trail = kwargs.get("sl_trail")
    regime_filter = kwargs.get("regime_filter", True)

    df = yf.download(asset, period=period, auto_adjust=True, progress=False)
    if df.empty:
        raise RuntimeError(f"Pas de données pour {asset}")

    close = df["Close"].squeeze()
    rsi = vbt.RSI.run(close, window=rsi_window)

    entries_raw = rsi.rsi_below(rsi_oversold).shift(1).fillna(False).astype(bool)
    exits_raw = rsi.rsi_above(rsi_overbought).shift(1).fillna(False).astype(bool)
    if regime_filter:
        ma_regime = vbt.MA.run(close, window=ma_regime_window)
        trend_up = (close > ma_regime.ma).shift(1).fillna(False).astype(bool)
        entries = entries_raw & trend_up
    else:
        entries = entries_raw
    exits = exits_raw

    # Lignes optionnelles de from_signals (sizing + stops) — identiques au builder.
    fs_kwargs = dict(
        entries=entries,
        exits=exits,
        fees=fees,
        slippage=slippage,
        init_cash=init_cash,
        freq="1D",
    )
    if sizing is not None:
        fs_kwargs["size"] = sizing
        fs_kwargs["size_type"] = "percent"
    if sl_stop is not None:
        fs_kwargs["sl_stop"] = sl_stop
    if sl_trail is not None:
        fs_kwargs["sl_trail"] = sl_trail

    pf = vbt.Portfolio.from_signals(df["Open"], **fs_kwargs)

    return {
        "template": "rsi_with_regime_filter" if regime_filter else "rsi_no_regime",
        "asset": asset,
        "period": period,
        "params": {
            "rsi_window": rsi_window,
            "rsi_oversold": rsi_oversold,
            "rsi_overbought": rsi_overbought,
            "ma_regime_window": ma_regime_window,
            "fees": fees,
            "slippage": slippage,
            "init_cash": init_cash,
            "sizing": sizing,
            "sl_stop": sl_stop,
            "sl_trail": sl_trail,
            "regime_filter": regime_filter,
        },
        "metrics": {
            "sharpe_ratio": round(float(pf.sharpe_ratio().item() if hasattr(pf.sharpe_ratio(), "item") else pf.sharpe_ratio()), 4),
            "max_drawdown": round(_v(pf.max_drawdown()), 4),
            "total_return": round(_v(pf.total_return()), 4),
            "total_trades": int(_v(pf.trades.count())),
        },
        "look_ahead_bias_protected": True,
        "regime_filter_applied": regime_filter,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


if __name__ == "__main__":
    # Test rapide
    script = build_rsi_template(asset="BTC-USD", period="2y")
    print("=" * 60)
    print("SCRIPT GENERE :")
    print("=" * 60)
    print(script)
    print("=" * 60)
    print("\nEXECUTION LOCALE :")
    print("=" * 60)
    result = run_rsi_template(asset="BTC-USD", period="2y")
    print(json.dumps(result, indent=2))