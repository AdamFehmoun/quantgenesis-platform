"""
Template Bollinger Bands paramétrable — QuantGenesis Fallback
==============================================================
Stratégie : Mean-reversion avec FILTRE DE RÉGIME (Critique v3).
Achat sur bande basse UNIQUEMENT si MA200 indique tendance haussière.

Auteur : Paul Legeais — Lead Quant
Tâche  : P1 (J1)
"""

import json
from datetime import datetime, timezone


def _v(x):
    """Helper VectorBT 1.0.0 : gere Series 1-element et scalaires."""
    return x.item() if hasattr(x, "item") else float(x)


def build_bollinger_template(
    asset: str = "ETH-USD",
    period: str = "2y",
    bb_window: int = 20,
    bb_alpha: float = 2.0,
    ma_regime_window: int = 200,
    fees: float = 0.001,
    slippage: float = 0.0015,
    init_cash: float = 100_000,
    sizing: float = None,
    sl_stop: float = None,
    sl_trail: float = None,
    regime_filter: bool = True,
) -> str:
    """Script Bollinger Bands avec filtre de régime MA200.

    Params sur-mesure (étape 2, defaults sûrs = comportement historique) :
    - sizing       : fraction du capital par trade (size_type='percent'). None -> all-in vbt.
    - sl_stop      : stop-loss fixe (fraction). None -> pas de stop fixe.
    - sl_trail     : stop suiveur (fraction). None -> pas de trailing stop.
    - regime_filter: si True (défaut), n'achète que si close > MA (filtre Critique v3).

    Avec sizing/sl_stop/sl_trail=None et regime_filter=True, le script généré est
    STRICTEMENT identique à la version d'origine (zéro régression).
    """
    # --- Bloc indicateurs + signaux (filtre de régime conditionnel) ---
    if regime_filter:
        signal_block = f'''bb = vbt.BBANDS.run(close, window={bb_window}, alpha={bb_alpha})
ma_regime = vbt.MA.run(close, window={ma_regime_window})

# 3. Signaux avec FILTRE DE REGIME (Critique v3 — interdiction mean-rev sans filtre)
trend_up = (close > ma_regime.ma).shift(1).fillna(False).astype(bool)
entries_raw = (close < bb.lower).shift(1).fillna(False).astype(bool)
exits_raw = (close > bb.upper).shift(1).fillna(False).astype(bool)
entries = entries_raw & trend_up
exits = exits_raw'''
    else:
        signal_block = f'''bb = vbt.BBANDS.run(close, window={bb_window}, alpha={bb_alpha})

# 3. Signaux (SANS filtre de regime)
entries_raw = (close < bb.lower).shift(1).fillna(False).astype(bool)
exits_raw = (close > bb.upper).shift(1).fillna(False).astype(bool)
entries = entries_raw
exits = exits_raw'''

    # --- Lignes optionnelles de from_signals (sizing + stops) — vide par défaut. ---
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

# 4. Backtest VectorBT
pf = vbt.Portfolio.from_signals(
    df["Open"],
    entries=entries,
    exits=exits,
    fees={fees},
    slippage={slippage},
    init_cash={init_cash},
{extra_lines}    freq="1D",
)

# 5. Metriques standard
print(f"Sharpe   : {{_scalar(pf.sharpe_ratio()):.4f}}")
print(f"Drawdown : {{_scalar(pf.max_drawdown()):.4f}}")
print(f"Return   : {{_scalar(pf.total_return()):.4f}}")
print(f"Trades   : {{int(_scalar(pf.trades.count()))}}")
print(f"Winrate  : {{_scalar(pf.trades.win_rate()) * 100:.2f}}")
'''


def run_bollinger_template(asset: str = "ETH-USD", period: str = "2y", **kwargs) -> dict:
    """Exécute le template Bollinger Bands localement."""
    import pandas as pd
    import vectorbt as vbt
    import yfinance as yf
    pd.set_option('future.no_silent_downcasting', True)

    bb_window = kwargs.get("bb_window", 20)
    bb_alpha = kwargs.get("bb_alpha", 2.0)
    ma_regime_window = kwargs.get("ma_regime_window", 200)
    fees = kwargs.get("fees", 0.001)
    slippage = kwargs.get("slippage", 0.0015)
    init_cash = kwargs.get("init_cash", 100_000)
    # Params sur-mesure (étape 2) — defaults sûrs = comportement historique.
    sizing = kwargs.get("sizing")
    sl_stop = kwargs.get("sl_stop")
    sl_trail = kwargs.get("sl_trail")
    regime_filter = kwargs.get("regime_filter", True)

    df = yf.download(asset, period=period, auto_adjust=True, progress=False)
    if df.empty:
        raise RuntimeError(f"Pas de données pour {asset}")

    close = df["Close"].squeeze()
    bb = vbt.BBANDS.run(close, window=bb_window, alpha=bb_alpha)

    entries_raw = (close < bb.lower).shift(1).fillna(False).astype(bool)
    exits_raw = (close > bb.upper).shift(1).fillna(False).astype(bool)
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
        "template": "bollinger_with_regime_filter" if regime_filter else "bollinger_no_regime",
        "asset": asset,
        "period": period,
        "params": {
            "bb_window": bb_window,
            "bb_alpha": bb_alpha,
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
    print(build_bollinger_template())
    print(json.dumps(run_bollinger_template(), indent=2))