"""
Template MA Crossover paramétrable — QuantGenesis Fallback
===========================================================
Stratégie : Golden Cross / Death Cross (trend-following pur).
Pas besoin de filtre de régime — la stratégie EST son propre filtre.

Auteur : Paul Legeais — Lead Quant
Tâche  : P1 (J1)
"""

import json
from datetime import datetime, timezone


def _v(x):
    """Helper VectorBT 1.0.0 : gere Series 1-element et scalaires."""
    return x.item() if hasattr(x, "item") else float(x)


def build_ma_template(
    asset: str = "SPY",
    period: str = "5y",
    ma_fast: int = 50,
    ma_slow: int = 200,
    fees: float = 0.001,
    slippage: float = 0.001,
    init_cash: float = 100_000,
    sizing: float = None,
    sl_stop: float = None,
    sl_trail: float = None,
) -> str:
    """Génère le script Python du template MA Crossover.

    Params sur-mesure (étape 2, defaults sûrs = comportement historique) :
    - sizing  : fraction du capital par trade (size_type='percent'). None -> all-in vbt.
    - sl_stop : stop-loss fixe (fraction). None -> pas de stop fixe.
    - sl_trail: stop suiveur (fraction). None -> pas de trailing stop.

    Avec sizing/sl_stop/sl_trail=None, le script généré est STRICTEMENT identique
    à la version d'origine (zéro régression). Pas de filtre de régime : le
    croisement MA EST le filtre de tendance.
    """
    # Lignes optionnelles de from_signals (sizing + stops) — vide par défaut.
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
ma_fast = vbt.MA.run(close, window={ma_fast}, short_name="fast")
ma_slow = vbt.MA.run(close, window={ma_slow}, short_name="slow")

# 3. Signaux — Golden Cross / Death Cross
# Anti-look-ahead bias : shift(1) obligatoire (CLAUDE.md)
entries = ma_fast.ma_crossed_above(ma_slow).shift(1).fillna(False).astype(bool)
exits = ma_fast.ma_crossed_below(ma_slow).shift(1).fillna(False).astype(bool)

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


def run_ma_template(asset: str = "SPY", period: str = "5y", **kwargs) -> dict:
    """Exécute localement le template MA Crossover."""
    import pandas as pd
    import vectorbt as vbt
    import yfinance as yf
    pd.set_option('future.no_silent_downcasting', True)

    ma_fast_w = kwargs.get("ma_fast", 50)
    ma_slow_w = kwargs.get("ma_slow", 200)
    fees = kwargs.get("fees", 0.001)
    slippage = kwargs.get("slippage", 0.001)
    init_cash = kwargs.get("init_cash", 100_000)
    # Params sur-mesure (étape 2) — defaults sûrs = comportement historique.
    sizing = kwargs.get("sizing")
    sl_stop = kwargs.get("sl_stop")
    sl_trail = kwargs.get("sl_trail")

    df = yf.download(asset, period=period, auto_adjust=True, progress=False)
    if df.empty:
        raise RuntimeError(f"Pas de données pour {asset}")

    close = df["Close"].squeeze()
    ma_fast = vbt.MA.run(close, window=ma_fast_w, short_name="fast")
    ma_slow = vbt.MA.run(close, window=ma_slow_w, short_name="slow")

    entries = ma_fast.ma_crossed_above(ma_slow).shift(1).fillna(False).astype(bool)
    exits = ma_fast.ma_crossed_below(ma_slow).shift(1).fillna(False).astype(bool)

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
        "template": "ma_crossover",
        "asset": asset,
        "period": period,
        "params": {
            "ma_fast": ma_fast_w,
            "ma_slow": ma_slow_w,
            "fees": fees,
            "slippage": slippage,
            "init_cash": init_cash,
            "sizing": sizing,
            "sl_stop": sl_stop,
            "sl_trail": sl_trail,
        },
        "metrics": {
            "sharpe_ratio": round(float(pf.sharpe_ratio().item() if hasattr(pf.sharpe_ratio(), "item") else pf.sharpe_ratio()), 4),
            "max_drawdown": round(_v(pf.max_drawdown()), 4),
            "total_return": round(_v(pf.total_return()), 4),
            "total_trades": int(_v(pf.trades.count())),
        },
        "look_ahead_bias_protected": True,
        "regime_filter_applied": False,  # MA crossover EST le filtre de régime
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


if __name__ == "__main__":
    script = build_ma_template(asset="SPY", period="5y")
    print("SCRIPT :\n" + script)
    print("\nEXECUTION :\n" + json.dumps(run_ma_template("SPY", "5y"), indent=2))