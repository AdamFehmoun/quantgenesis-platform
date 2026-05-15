import time
from dotenv import load_dotenv
from e2b_code_interpreter import Sandbox

load_dotenv(dotenv_path="sandbox/.env")

def run_backtest(code: str) -> dict:
    start_time = time.time()
    
    try:
        with Sandbox.create() as s:
            execution = s.run_code(code)
            
            # --- CORRECTION 1 : On intercepte les erreurs Python de la Sandbox ---
            if execution.error:
                return {
                    'status': 'ERROR',
                    'error_name': execution.error.name,
                    'error_value': execution.error.value,
                    'execution_time_ms': int((time.time() - start_time) * 1000)
                }

            execution_time_ms = int((time.time() - start_time) * 1000)
            
            # --- CORRECTION 2 : E2B renvoie une liste, on la convertit en texte ---
            stdout_list = execution.logs.stdout
            stdout_text = "".join(stdout_list) if stdout_list else ""
            
            sharpe = 0.0
            drawdown = 0.0
            total_return = 0.0
            
            # Parsing du stdout
            if stdout_text:
                for line in stdout_text.split('\n'):
                    if line.startswith('SHARPE:'):
                        sharpe = float(line.split(':')[1])
                    elif line.startswith('DRAWDOWN:'):
                        drawdown = float(line.split(':')[1]) * 100
                    elif line.startswith('RETURN:'):
                        total_return = float(line.split(':')[1]) * 100

            return {
                'status': 'SUCCESS',
                'sharpe_ratio': round(sharpe, 2),
                'max_drawdown_pct': round(drawdown, 2),
                'total_return_pct': round(total_return, 2),
                'num_trades': 0, 
                'execution_time_ms': execution_time_ms,
                'stdout': stdout_text,
                'stderr': "".join(execution.logs.stderr) if execution.logs.stderr else ""
            }

    except Exception as e:
        return {
            'status': 'ERROR',
            'stderr': str(e)
        }

if __name__ == "__main__":
    # --- CORRECTION 3 : J'ai rajouté les float() manquants dans le code d'Adam ---
    code_to_run = '''
import subprocess
subprocess.run(['pip', 'install', 'vectorbt', 'yfinance', '-q'])

import vectorbt as vbt
import yfinance as yf
import warnings
warnings.filterwarnings('ignore')

data = yf.download('BTC-USD', period='1y', progress=False)
close = data['Close'].squeeze()
rsi = vbt.RSI.run(close, window=14)
entries = rsi.rsi_below(30).shift(1).fillna(False)
exits = rsi.rsi_above(70).shift(1).fillna(False)

pf = vbt.Portfolio.from_signals(
    close, entries=entries, exits=exits,
    fees=0.001, slippage=0.001, freq='1D'
)
print(f'SHARPE:{float(pf.sharpe_ratio()):.4f}')
print(f'DRAWDOWN:{float(pf.max_drawdown()):.4f}')
print(f'RETURN:{float(pf.total_return()):.4f}')
'''
    print("⏳ Démarrage du backtest...")
    resultat = run_backtest(code_to_run)
    print("\n✅ Résultat formaté pour Berkant :")
    print(resultat)