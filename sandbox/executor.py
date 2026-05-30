import ast
import time
from dotenv import load_dotenv
from e2b_code_interpreter import Sandbox

# Charge la clé E2B depuis le fichier .env caché
load_dotenv(dotenv_path="sandbox/.env")

def verify_code_safety(code: str) -> tuple[bool, str]:
    BLOCKED_MODULES = {'os', 'subprocess', 'socket', 'sys', 'shutil', 'requests', 'urllib'}
    BLOCKED_FUNCTIONS = {'eval', 'exec', '__import__', 'compile', 'open'}
    
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        return False, f"Erreur de syntaxe : {e}"

    class SecurityChecker(ast.NodeVisitor):
        def __init__(self):
            self.is_safe = True
            self.reason = ""

        def visit_Import(self, node):
            for alias in node.names:
                if alias.name.split('.')[0] in BLOCKED_MODULES:
                    self.is_safe = False
                    self.reason = f"Import interdit : '{alias.name}'"
            self.generic_visit(node)

    checker = SecurityChecker()
    checker.visit(tree)
    return checker.is_safe, checker.reason

def run_backtest(code: str, timeout: int = 60, spread: float = 0.0001) -> dict:
    start_time = time.time()

    is_safe, reason = verify_code_safety(code)
    if not is_safe:
        return {'status': 'ERROR', 'error': 'security_violation', 'details': reason, 'execution_time_ms': 0}

    instrumented_code = f"SPREAD = {float(spread)!r}\n{code}"

    try:
        # 🚀 FIX BUG 2 : Utilisation d'une Sandbox vierge officielle (Injection Runtime)
        with Sandbox.create() as s:
            
            # Installation silencieuse des dépendances requises au runtime
            s.run_code("!pip install -q yfinance vectorbt numba")
            
            # Exécution de la stratégie
            execution = s.run_code(instrumented_code, timeout=timeout)
            execution_time_ms = int((time.time() - start_time) * 1000)

            if execution.error:
                return {
                    'status': 'ERROR',
                    'error': 'code_crash',
                    'details': f"{execution.error.name}: {execution.error.value}",
                    'execution_time_ms': execution_time_ms
                }

            # 🚀 FIX BUG 1 : Reconstruction du stdout à partir de la liste logs.stdout
            stdout_text = "".join(execution.logs.stdout) if hasattr(execution, 'logs') and execution.logs and execution.logs.stdout else ""
            
            sharpe = drawdown = total_return = num_trades = 0.0
            if stdout_text:
                for line in stdout_text.split('\n'):
                    line = line.strip()
                    if line.startswith('SHARPE:'):
                        try: sharpe = float(line.split(':')[1])
                        except ValueError: pass
                    elif line.startswith('DRAWDOWN:'):
                        try: drawdown = float(line.split(':')[1])
                        except ValueError: pass
                    elif line.startswith('RETURN:'):
                        try: total_return = float(line.split(':')[1])
                        except ValueError: pass
                    elif line.startswith('TRADES:'):
                        try: num_trades = float(line.split(':')[1])
                        except ValueError: pass

            return {
                'status': 'SUCCESS',
                'sharpe_ratio': round(sharpe, 4),
                'drawdown': round(drawdown, 4),
                'return': round(total_return, 4),
                'num_trades': int(num_trades),
                'execution_time_ms': execution_time_ms,
                'stdout': stdout_text,
                'stderr': "".join(execution.logs.stderr) if hasattr(execution, 'logs') and execution.logs and execution.logs.stderr else ""
            }

    except Exception as e:
        return {
            'status': 'ERROR',
            'error': 'system_error',
            'details': str(e),
            'execution_time_ms': int((time.time() - start_time) * 1000)
        }