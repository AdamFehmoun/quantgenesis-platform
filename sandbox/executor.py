import ast
import time
from dotenv import load_dotenv
from e2b_code_interpreter import Sandbox

# Charge la clé E2B depuis le fichier .env caché
load_dotenv(dotenv_path="sandbox/.env")

def validate_and_check_security(code: str) -> tuple[str, str]:
    """
    Vérifie d'abord si le code compile, puis s'il est sécurisé.
    Retourne un tuple: (statut, raison)
    Statuts possibles: 'ok', 'syntax_error', 'security_violation'
    """
    # 1. Vérification de la syntaxe (avant E2B)
    try:
        compile(code, '<string>', 'exec')
    except Exception as e:
        # On attrape les erreurs de syntaxe pour déclencher le retry
        return 'syntax_error', f"Erreur de compilation : {e}"

    # 2. Vérification de la sécurité (AST)
    BLOCKED_MODULES = {'os', 'subprocess', 'socket', 'sys', 'shutil', 'requests', 'urllib'}
    BLOCKED_FUNCTIONS = {'eval', 'exec', '__import__', 'compile', 'open'}
    
    # On sait que le parsing AST va marcher car le compile() est passé
    tree = ast.parse(code)

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
            
        def visit_Call(self, node):
            if isinstance(node.func, ast.Name) and node.func.id in BLOCKED_FUNCTIONS:
                self.is_safe = False
                self.reason = f"Fonction interdite : '{node.func.id}'"
            self.generic_visit(node)

    checker = SecurityChecker()
    checker.visit(tree)
    
    if not checker.is_safe:
        return 'security_violation', checker.reason
        
    return 'ok', ""

def run_backtest(code: str, timeout: int = 60, spread: float = 0.0001) -> dict:
    start_time = time.time()

    # 🚀 FIX SEMAINE 3 : Validation du code avant exécution
    validation_status, reason = validate_and_check_security(code)
    
    if validation_status == 'syntax_error':
        return {
            'status': 'ERROR', 
            'error': 'syntax_error', 
            'details': reason, 
            'execution_time_ms': 0
        }
    elif validation_status == 'security_violation':
        return {
            'status': 'ERROR', 
            'error': 'security_violation', 
            'details': reason, 
            'execution_time_ms': 0
        }

    instrumented_code = f"SPREAD = {float(spread)!r}\n{code}"

    try:
        # Utilisation d'une Sandbox vierge officielle (Injection Runtime)
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

            # Reconstruction du stdout à partir de la liste logs.stdout
            stdout_text = "".join(execution.logs.stdout) if hasattr(execution, 'logs') and execution.logs and execution.logs.stdout else ""
            
            sharpe = drawdown = total_return = num_trades = win_rate = 0.0
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
                    elif line.startswith('WINRATE:'):
                        try: win_rate = float(line.split(':')[1])
                        except ValueError: pass

            return {
                'status': 'SUCCESS',
                'sharpe_ratio': round(sharpe, 4),
                'drawdown': round(drawdown, 4),
                'return': round(total_return, 4),
                'num_trades': int(num_trades),
                'win_rate_pct': round(win_rate, 2),
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