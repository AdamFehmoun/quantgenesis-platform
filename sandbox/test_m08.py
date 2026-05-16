import time
from executor import run_backtest

# On utilise un script standard pour mesurer la latence pure
# (Plus besoin de pip install grâce à ton Template E2B custom !)
code_to_run = """
import vectorbt as vbt
import yfinance as yf
import warnings
warnings.filterwarnings('ignore')

data = yf.download('BTC-USD', period='6mo', progress=False)
close = data['Close'].squeeze()
rsi = vbt.RSI.run(close, window=14)
entries = rsi.rsi_below(30).shift(1).fillna(False)
exits = rsi.rsi_above(70).shift(1).fillna(False)

pf = vbt.Portfolio.from_signals(
    close, entries=entries, exits=exits,
    fees=0.001, slippage=0.001, freq='1D'
)
print(f'SHARPE:{float(pf.sharpe_ratio()):.4f}')
"""

if __name__ == "__main__":
    print("🚀 Lancement de la tâche M-08 (Version Optimisée) : 20 runs de backtest...")
    latencies = []

    for i in range(1, 21):
        res = run_backtest(code_to_run)
        # Si la sandbox fait un timeout, on enregistre 30000ms
        t = res.get('execution_time_ms', 30000) 
        latencies.append(t)
        print(f"⏳ Run {i}/20 terminé en {t} ms")

    # Calcul des métriques statistiques
    latencies.sort()
    mini = latencies[0]
    maxi = latencies[-1]
    avg = sum(latencies) / len(latencies)
    
    # Calcul du 95ème percentile
    idx_p95 = int(0.95 * len(latencies)) - 1
    p95 = latencies[idx_p95]

    print("\n📊 --- BILAN M-08 : MÉTRIQUES DE LATENCE ---")
    print(f"Latence Minimum : {mini} ms")
    print(f"Latence Maximum : {maxi} ms")
    print(f"Latence Moyenne : {avg:.0f} ms")
    print(f"Latence P95     : {p95} ms")
    print("\n⚠️ À copier dans le salon #metriques sur Discord !")