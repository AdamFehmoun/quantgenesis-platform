"""
Script de validation du fix Sharpe sur sandbox/executor.py.
Lance un vrai backtest VectorBT (stratégie RSI) et vérifie que le
sharpe_ratio retourné est NON nul, ce qui confirme que execution.logs.stdout
est correctement lu (le bug original retournait toujours 0.0).

NOTE: la cible originale yfinance/BTC-USD est bloquée par la whitelist
réseau M-10 du sandbox. On utilise donc un random walk reproductible
généré in-sandbox — ce qui suffit pour prouver que le parse stdout
marche end-to-end (objectif du fix).
"""
from sandbox.executor import run_backtest

STRATEGY_CODE = """
import numpy as np
import pandas as pd
import vectorbt as vbt

# Random walk reproductible — yfinance est bloqué par la whitelist M-10
np.random.seed(42)
n = 252  # 1 an de jours ouvrés
dates = pd.date_range('2024-01-01', periods=n, freq='B')
returns = np.random.normal(loc=0.0005, scale=0.02, size=n)
close = pd.Series(100 * np.exp(np.cumsum(returns)), index=dates, name='close')

rsi = vbt.RSI.run(close, window=14)
entries = rsi.rsi_crossed_below(30)
exits = rsi.rsi_crossed_above(70)

pf = vbt.Portfolio.from_signals(
    close,
    entries,
    exits,
    fees=SPREAD,
    freq='1D',
)

sharpe = pf.sharpe_ratio()
drawdown = pf.max_drawdown()
total_return = pf.total_return()

if hasattr(sharpe, 'iloc'): sharpe = sharpe.iloc[0]
if hasattr(drawdown, 'iloc'): drawdown = drawdown.iloc[0]
if hasattr(total_return, 'iloc'): total_return = total_return.iloc[0]

if np.isnan(sharpe): sharpe = 0.0
if np.isnan(drawdown): drawdown = 0.0
if np.isnan(total_return): total_return = 0.0

print(f"SHARPE:{sharpe}")
print(f"DRAWDOWN:{drawdown}")
print(f"RETURN:{total_return}")
"""


def main():
    print("Lancement run_backtest sur stratégie RSI BTC-USD 1y...")
    result = run_backtest(STRATEGY_CODE, timeout=60)

    print("\n=== Résultat complet ===")
    for k, v in result.items():
        if k == 'stdout':
            print(f"{k}: {v!r}")
        else:
            print(f"{k}: {v}")

    print("\n=== Vérification ===")
    assert result['status'] == 'SUCCESS', f"Statut non SUCCESS : {result}"
    assert result['sharpe_ratio'] != 0.0, (
        f"Sharpe encore à 0.0 — le fix n'a pas marché. Résultat: {result}"
    )
    print(f"OK — sharpe_ratio = {result['sharpe_ratio']} (non nul)")


if __name__ == "__main__":
    main()
