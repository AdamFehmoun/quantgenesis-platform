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
) -> str:
    """Génère le script Python du template MA Crossover."""
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
    freq="1D",
)

# 5. Metriques standard
print(f"SHARPE:{{_scalar(pf.sharpe_ratio()):.4f}}")
print(f"DRAWDOWN:{{_scalar(pf.max_drawdown()):.4f}}")
print(f"RETURN:{{_scalar(pf.total_return()):.4f}}")
print(f"TRADES:{{int(_scalar(pf.trades.count()))}}")
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

    df = yf.download(asset, period=period, auto_adjust=True, progress=False)
    if df.empty:
        raise RuntimeError(f"Pas de données pour {asset}")

    close = df["Close"].squeeze()
    ma_fast = vbt.MA.run(close, window=ma_fast_w, short_name="fast")
    ma_slow = vbt.MA.run(close, window=ma_slow_w, short_name="slow")

    entries = ma_fast.ma_crossed_above(ma_slow).shift(1).fillna(False).astype(bool)
    exits = ma_fast.ma_crossed_below(ma_slow).shift(1).fillna(False).astype(bool)

    pf = vbt.Portfolio.from_signals(
        df["Open"],
        entries=entries,
        exits=exits,
        fees=fees,
        slippage=slippage,
        init_cash=init_cash,
        freq="1D",
    )

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