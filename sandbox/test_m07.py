import time
from executor import run_backtest

# Template de base pour le code IA (téléchargement des données et création du Portfolio)
TEMPLATE = """
import subprocess
subprocess.run(['pip', 'install', 'vectorbt', 'yfinance', 'pandas', '-q'])
import vectorbt as vbt
import yfinance as yf
import pandas as pd
import warnings
warnings.filterwarnings('ignore')

data = yf.download('BTC-USD', period='6mo', progress=False)
close = data['Close'].squeeze()

# --- DEBUT STRATEGIE ---
{strategy_logic}
# --- FIN STRATEGIE ---

pf = vbt.Portfolio.from_signals(
    close, entries=entries, exits=exits,
    fees=0.001, slippage=0.001, freq='1D'
)
print(f'SHARPE:{{float(pf.sharpe_ratio()):.4f}}')
print(f'DRAWDOWN:{{float(pf.max_drawdown()):.4f}}')
print(f'RETURN:{{float(pf.total_return()):.4f}}')
"""

# Définition des 10 stratégies (M-07)
strategies = {
    "1. RSI Simple": "rsi = vbt.RSI.run(close, window=14)\nentries = rsi.rsi_below(30).shift(1).fillna(False)\nexits = rsi.rsi_above(70).shift(1).fillna(False)",
    
    "2. SMA Crossover": "fast = vbt.MA.run(close, 10)\nslow = vbt.MA.run(close, 50)\nentries = fast.ma_crossed_above(slow).shift(1).fillna(False)\nexits = fast.ma_crossed_below(slow).shift(1).fillna(False)",
    
    "3. Bollinger Bands": "bb = vbt.BBANDS.run(close)\nentries = close.vbt.crossed_below(bb.lower).shift(1).fillna(False)\nexits = close.vbt.crossed_above(bb.upper).shift(1).fillna(False)",
    
    "4. MACD": "macd = vbt.MACD.run(close)\nentries = macd.macd_crossed_above(macd.signal).shift(1).fillna(False)\nexits = macd.macd_crossed_below(macd.signal).shift(1).fillna(False)",
    
    "5. EMA Crossover": "fast = vbt.MA.run(close, 10, ewm=True)\nslow = vbt.MA.run(close, 50, ewm=True)\nentries = fast.ma_crossed_above(slow).shift(1).fillna(False)\nexits = fast.ma_crossed_below(slow).shift(1).fillna(False)",
    
    "6. Price vs SMA": "ma = vbt.MA.run(close, 20)\nentries = close.vbt.crossed_above(ma.ma).shift(1).fillna(False)\nexits = close.vbt.crossed_below(ma.ma).shift(1).fillna(False)",
    
    "7. Momentum (ROC)": "roc = close.pct_change(periods=10)\nentries = (roc > 0.05).shift(1).fillna(False)\nexits = (roc < -0.05).shift(1).fillna(False)",
    
    "8. Mean Reversion": "ma = vbt.MA.run(close, 20)\nstd = close.rolling(20).std()\nz = (close - ma.ma) / std\nentries = (z < -2).shift(1).fillna(False)\nexits = (z > 2).shift(1).fillna(False)",
    
    "9. RSI + Trend filter": "rsi = vbt.RSI.run(close, window=14)\nma = vbt.MA.run(close, 50)\nentries = (rsi.rsi_below(30) & (close > ma.ma)).shift(1).fillna(False)\nexits = rsi.rsi_above(70).shift(1).fillna(False)",
    
    "10. Buy & Hold": "entries = pd.Series(False, index=close.index)\nentries.iloc[0] = True\nexits = pd.Series(False, index=close.index)"
}

if __name__ == "__main__":
    print("🚀 Lancement de la suite de tests M-07 (10 stratégies VectorBT)...\n")
    
    resultats = []
    
    for nom, logique in strategies.items():
        print(f"⏳ Test en cours : {nom}...")
        code_complet = TEMPLATE.format(strategy_logic=logique)
        
        # On utilise ta fonction blindée de M-06
        res = run_backtest(code_complet)
        
        status = res.get('status')
        latence = res.get('execution_time_ms', 0)
        
        if status == 'SUCCESS':
            print(f"   ✅ Succès | Temps: {latence}ms | Sharpe: {res.get('sharpe_ratio')}")
        else:
            print(f"   ❌ Erreur | Temps: {latence}ms | Type: {res.get('error')}")
            
        resultats.append({"nom": nom, "status": status, "latence": latence})
        
        # Petite pause pour ne pas spammer l'API E2B
        time.sleep(1)
        
    print("\n📊 --- BILAN M-07 ---")
    reussis = sum(1 for r in resultats if r['status'] == 'SUCCESS')
    print(f"Score : {reussis}/10 scripts exécutés sans crash.")