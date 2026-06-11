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
) -> str:
    """Script Bollinger Bands avec filtre de régime MA200."""
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
bb = vbt.BBANDS.run(close, window={bb_window}, alpha={bb_alpha})
ma_regime = vbt.MA.run(close, window={ma_regime_window})

# 3. Signaux avec FILTRE DE REGIME (Critique v3 — interdiction mean-rev sans filtre)
trend_up = (close > ma_regime.ma).shift(1).fillna(False).astype(bool)
entries_raw = (close < bb.lower).shift(1).fillna(False).astype(bool)
exits_raw = (close > bb.upper).shift(1).fillna(False).astype(bool)
entries = entries_raw & trend_up
exits = exits_raw

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

    df = yf.download(asset, period=period, auto_adjust=True, progress=False)
    if df.empty:
        raise RuntimeError(f"Pas de données pour {asset}")

    close = df["Close"].squeeze()
    bb = vbt.BBANDS.run(close, window=bb_window, alpha=bb_alpha)
    ma_regime = vbt.MA.run(close, window=ma_regime_window)

    trend_up = (close > ma_regime.ma).shift(1).fillna(False).astype(bool)
    entries_raw = (close < bb.lower).shift(1).fillna(False).astype(bool)
    exits_raw = (close > bb.upper).shift(1).fillna(False).astype(bool)
    entries = entries_raw & trend_up
    exits = exits_raw

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
        "template": "bollinger_with_regime_filter",
        "asset": asset,
        "period": period,
        "params": {
            "bb_window": bb_window,
            "bb_alpha": bb_alpha,
            "ma_regime_window": ma_regime_window,
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
        "regime_filter_applied": True,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


if __name__ == "__main__":
    print(build_bollinger_template())
    print(json.dumps(run_bollinger_template(), indent=2))