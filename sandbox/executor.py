import ast
import time
from dotenv import load_dotenv
from e2b_code_interpreter import Sandbox

# Charge la clé E2B depuis le fichier .env caché
load_dotenv(dotenv_path="sandbox/.env")


def verify_code_safety(code: str) -> tuple[bool, str]:
    """
    Analyse l'arbre syntaxique (AST) pour bloquer les imports dangereux (os, subprocess, socket)
    et les fonctions d'évasion de chaînes (eval, exec, etc.).
    """
    BLOCKED_MODULES = {'os', 'subprocess', 'socket', 'sys', 'shutil', 'requests', 'urllib'}
    BLOCKED_FUNCTIONS = {'eval', 'exec', '__import__', 'compile', 'open'}
    
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        return False, f"Erreur de syntaxe avant exécution (Filtre AST) : {e}"

    class SecurityChecker(ast.NodeVisitor):
        def __init__(self):
            self.is_safe = True
            self.reason = ""

        def visit_Import(self, node):
            for alias in node.names:
                if alias.name.split('.')[0] in BLOCKED_MODULES:
                    self.is_safe = False
                    self.reason = f"Import interdit détecté : '{alias.name}'"
            self.generic_visit(node)

        def visit_ImportFrom(self, node):
            if node.module and node.module.split('.')[0] in BLOCKED_MODULES:
                self.is_safe = False
                self.reason = f"Import combiné interdit détecté : 'from {node.module}'"
            self.generic_visit(node)

        def visit_Call(self, node):
            if isinstance(node.func, ast.Name) and node.func.id in BLOCKED_FUNCTIONS:
                self.is_safe = False
                self.reason = f"Appel de fonction système interdit : '{node.func.id}()'"
            elif isinstance(node.func, ast.Attribute) and isinstance(node.func.value, ast.Name):
                if node.func.value.id in BLOCKED_MODULES:
                    self.is_safe = False
                    self.reason = f"Appel de méthode interdit sur le module banni : '{node.func.value.id}'"
            self.generic_visit(node)

    checker = SecurityChecker()
    checker.visit(tree)
    return checker.is_safe, checker.reason


def run_backtest(code: str, timeout: int = 30) -> dict:
    """
    Exécute le code IA dans la sandbox E2B avec le template financier pré-installé.
    Gère la sécurité locale, les timeouts, les crashs et la saturation mémoire.
    """
    start_time = time.time()
    
    # 🛡️ Barrière locale : Filtrage AST
    is_safe, reason = verify_code_safety(code)
    if not is_safe:
        return {
            'status': 'ERROR',
            'error': 'security_violation',
            'details': reason,
            'execution_time_ms': 0
        }
    
    try:
        # Configuration des ressources managée via e2b.toml (1 core, 512MB RAM)
        with Sandbox.create("ptdq4y2y6jburj1tjjff") as s:
            execution = s.run_code(code, timeout=timeout)
            execution_time_ms = int((time.time() - start_time) * 1000)

            if execution.error:
                error_name = execution.error.name
                error_value = execution.error.value
                
                if "MemoryError" in error_name or "Killed" in error_value:
                    return {
                        'status': 'ERROR',
                        'error': 'out_of_memory',
                        'details': 'La sandbox a manqué de RAM (limite 512MB active).',
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

    except TimeoutError:
        return {
            'status': 'ERROR', 
            'error': 'timeout_30s',
            'details': 'Dépassement réel du timeout de 30 secondes.',
            'execution_time_ms': int((time.time() - start_time) * 1000)
        }
    except Exception as e:
        execution_time_ms = int((time.time() - start_time) * 1000)
        error_msg = str(e)
        
        # Capture spécifique de la coupure de port due au blocage de la Whitelist Réseau (M-10)
        if "port is not open" in error_msg or "code:502" in error_msg:
            return {
                'status': 'ERROR',
                'error': 'code_crash',
                'details': 'ConnectionError: Tentative d\'accès à un domaine hors whitelist bloquée par l\'infrastructure.',
                'execution_time_ms': execution_time_ms
            }
            
        if "timeout" in error_msg.lower() and execution_time_ms >= (timeout * 1000):
            return {
                'status': 'ERROR', 
                'error': 'timeout_30s',
                'details': 'Dépassement du timeout de 30 secondes.',
                'execution_time_ms': execution_time_ms
            }
            
        return {
            'status': 'ERROR',
            'error': 'system_error',
            'details': error_msg,
            'execution_time_ms': execution_time_ms
        }


if __name__ == "__main__":
    print("🚀 Lancement du test de validation de la whitelist réseau (M-10)...")
    
    # On teste un appel réseau vers Yahoo Finance (Bloqué par notre configuration e2b.toml)
    code_test_whitelist = """import yfinance as yf
data = yf.download('BTC-USD', period='1mo')
print('SUCCESS')
"""
    print(run_backtest(code_test_whitelist))