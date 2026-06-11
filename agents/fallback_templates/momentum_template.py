"""
Template Momentum ROC paramétrable — QuantGenesis Fallback
===========================================================
Stratégie : Trend-following momentum sur Rate of Change.
Pas de filtre régime (ROC > seuil EST le signal de tendance).

Auteur : Paul Legeais — Lead Quant
Tâche  : P1 (J1)
"""

import json
from datetime import datetime, timezone


def _v(x):
    """Helper VectorBT 1.0.0 : gere Series 1-element et scalaires."""
    return x.item() if hasattr(x, "item") else float(x)


def build_momentum_template(
    asset: str = "BTC-USD",
    period: str = "2y",
    roc_window: int = 14,
    roc_entry_threshold: float = 0.02,
    roc_exit_threshold: float = 0.0,
    fees: float = 0.001,
    slippage: float = 0.0015,
    init_cash: float = 100_000,
) -> str:
    """Script Momentum ROC paramétrable."""
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

# 2. Indicateur ROC (Rate of Change)
close = df["Close"].squeeze()
roc = close.pct_change(periods={roc_window})

# 3. Signaux avec anti-look-ahead bias
entries = (roc > {roc_entry_threshold}).shift(1).fillna(False).astype(bool)
exits = (roc < {roc_exit_threshold}).shift(1).fillna(False).astype(bool)

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
print(f"Sharpe   : {{_scalar(pf.sharpe_ratio()):.4f}}")
print(f"Drawdown : {{_scalar(pf.max_drawdown()):.4f}}")
print(f"Return   : {{_scalar(pf.total_return()):.4f}}")
print(f"Trades   : {{int(_scalar(pf.trades.count()))}}")
print(f"Winrate  : {{_scalar(pf.trades.win_rate()) * 100:.2f}}")
'''


def run_momentum_template(asset: str = "BTC-USD", period: str = "2y", **kwargs) -> dict:
    """Exécute le template Momentum ROC localement."""
    import pandas as pd
    import vectorbt as vbt
    import yfinance as yf
    pd.set_option('future.no_silent_downcasting', True)

    roc_window = kwargs.get("roc_window", 14)
    roc_entry = kwargs.get("roc_entry_threshold", 0.02)
    roc_exit = kwargs.get("roc_exit_threshold", 0.0)
    fees = kwargs.get("fees", 0.001)
    slippage = kwargs.get("slippage", 0.0015)
    init_cash = kwargs.get("init_cash", 100_000)

    df = yf.download(asset, period=period, auto_adjust=True, progress=False)
    if df.empty:
        raise RuntimeError(f"Pas de données pour {asset}")

    close = df["Close"].squeeze()
    roc = close.pct_change(periods=roc_window)

    entries = (roc > roc_entry).shift(1).fillna(False).astype(bool)
    exits = (roc < roc_exit).shift(1).fillna(False).astype(bool)

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
        "template": "momentum_roc",
        "asset": asset,
        "period": period,
        "params": {
            "roc_window": roc_window,
            "roc_entry_threshold": roc_entry,
            "roc_exit_threshold": roc_exit,
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
        "regime_filter_applied": False,  # ROC > seuil EST le filtre
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


if __name__ == "__main__":
    print(build_momentum_template())
    print(json.dumps(run_momentum_template(), indent=2))