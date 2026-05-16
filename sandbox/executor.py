import time
from dotenv import load_dotenv
from e2b_code_interpreter import Sandbox

# Charge la clé E2B depuis le fichier .env caché
load_dotenv(dotenv_path="sandbox/.env")

def run_backtest(code: str, timeout: int = 30) -> dict:
    """
    Exécute le code IA dans la sandbox avec le template custom ultra-rapide.
    Gère les timeouts, le manque de RAM (OOM) et les crashs de code.
    """
    start_time = time.time()
    
    try:
        # ⚡ C'EST ICI LA MAGIE : On utilise ton image pré-installée !
        with Sandbox.create("ptdq4y2y6jburj1tjjff") as s:
            execution = s.run_code(code, timeout=timeout)
            
            execution_time_ms = int((time.time() - start_time) * 1000)

            # 1. GESTION DU CRASH DE CODE OU OUT OF MEMORY (OOM)
            if execution.error:
                error_name = execution.error.name
                error_value = execution.error.value
                
                if "MemoryError" in error_name or "Killed" in error_value:
                    return {
                        'status': 'ERROR',
                        'error': 'out_of_memory',
                        'details': 'La sandbox a manqué de RAM',
                        'execution_time_ms': execution_time_ms
                    }
                
                return {
                    'status': 'ERROR',
                    'error': 'code_crash',
                    'details': f"{error_name}: {error_value}",
                    'execution_time_ms': execution_time_ms
                }

            stdout_text = execution.text if hasattr(execution, 'text') and execution.text else ""
            
            sharpe = 0.0
            drawdown = 0.0
            total_return = 0.0
            
            # Parsing du stdout
            if stdout_text:
                for line in stdout_text.split('\n'):
                    if line.startswith('SHARPE:'):
                        try: sharpe = float(line.split(':')[1])
                        except ValueError: pass
                    elif line.startswith('DRAWDOWN:'):
                        try: drawdown = float(line.split(':')[1]) * 100
                        except ValueError: pass
                    elif line.startswith('RETURN:'):
                        try: total_return = float(line.split(':')[1]) * 100
                        except ValueError: pass

            return {
                'status': 'SUCCESS',
                'sharpe_ratio': round(sharpe, 2),
                'max_drawdown_pct': round(drawdown, 2),
                'total_return_pct': round(total_return, 2),
                'num_trades': 0, 
                'execution_time_ms': execution_time_ms,
                'stdout': stdout_text,
                'stderr': "".join(execution.logs.stderr) if hasattr(execution.logs, 'stderr') and execution.logs.stderr else ""
            }

    # 2. GESTION DU TIMEOUT
    except TimeoutError:
        return {
            'status': 'ERROR', 
            'error': 'timeout_30s',
            'execution_time_ms': int((time.time() - start_time) * 1000)
        }
    
    # 3. GESTION DES ERREURS SYSTÈMES
    except Exception as e:
        error_str = str(e).lower()
        if "timeout" in error_str:
            return {
                'status': 'ERROR', 
                'error': 'timeout_30s',
                'execution_time_ms': int((time.time() - start_time) * 1000)
            }
        return {
            'status': 'ERROR',
            'error': 'system_error',
            'details': str(e),
            'execution_time_ms': int((time.time() - start_time) * 1000)
        }

if __name__ == "__main__":
    print("⏳ Test rapide de l'executor (Happy Path)...")
    # Code de test ultra-léger, car vectorbt et pandas sont déjà dans ton template !
    code_test = '''
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
print(f'DRAWDOWN:{float(pf.max_drawdown()):.4f}')
print(f'RETURN:{float(pf.total_return()):.4f}')
'''
    print(run_backtest(code_test))