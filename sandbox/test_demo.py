import time
from executor import run_backtest
from db_logger import log_execution

# Le vrai code d'Adam tel que demandé dans le brief
CODE_TEST = """import vectorbt as vbt, yfinance as yf
data = yf.download('BTC-USD', period='1y', progress=False)
close = data['Close'].squeeze()
rsi = vbt.RSI.run(close, window=14)
entries = rsi.rsi_below(30).shift(1).fillna(False)
exits = rsi.rsi_above(70).shift(1).fillna(False)
pf = vbt.Portfolio.from_signals(close, entries=entries, exits=exits, fees=0.001, slippage=0.001, freq='1D')
print(f'SHARPE:{float(pf.sharpe_ratio()):.4f}')
"""

print("🚀 Lancement du test de stabilité (5 runs avec logging BDD)...\n")

for i in range(5):
    print(f"--- Lancement Run {i+1}/5 ---")
    r = run_backtest(CODE_TEST)
    
    # Enregistrement dans la base de données (M-14)
    log_execution(r)
    
    status = r.get('status')
    sharpe = r.get('sharpe_ratio', 'N/A')
    latence = r.get('execution_time_ms', 'N/A')
    
    if status == 'ERROR':
        print(f"❌ Run {i+1} : CRASH | Latence: {latence} ms | Erreur: {r.get('details')}\n")
    else:
        print(f"✅ Run {i+1} : SUCCESS | Sharpe: {sharpe} | Latence: {latence} ms\n")
    
    # Pause vitale pour ne pas spammer et saturer l'API E2B
    time.sleep(8)