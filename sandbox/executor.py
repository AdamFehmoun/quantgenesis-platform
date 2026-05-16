import ast
import time
from dotenv import load_dotenv
from e2b_code_interpreter import Sandbox

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
        return False, f"Erreur de syntaxe : {e}"

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
        with Sandbox.create("ptdq4y2y6jburj1tjjff") as s:
            # ⏱️ Limite stricte des 30 secondes appliquée ici
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
            return {
                'status': 'SUCCESS',
                'stdout': stdout_text,
                'execution_time_ms': execution_time_ms
            }

    except TimeoutError:
        return {
            'status': 'ERROR', 
            'error': 'timeout_30s',
            'details': 'Dépassement du timeout de 30 secondes.',
            'execution_time_ms': int((time.time() - start_time) * 1000)
        }
    except Exception as e:
        if "timeout" in str(e).lower():
            return {'status': 'ERROR', 'error': 'timeout_30s', 'execution_time_ms': int((time.time() - start_time) * 1000)}
        return {'status': 'ERROR', 'error': 'system_error', 'details': str(e), 'execution_time_ms': int((time.time() - start_time) * 1000)}

if __name__ == "__main__":
    print("🛡️ Lancement du banc d'essai de sécurité (10 cas d'injection) 🛡️\n")
    
    injections = {
        "1. Import Classique OS": "import os\nos.system('rm -rf /')",
        "2. Import Classique Subprocess": "import subprocess\nsubprocess.run(['ls'])",
        "3. Import Classique Socket": "import socket\ns = socket.socket()",
        "4. From...Import Déguisé": "from os import system\nsystem('clear')",
        "5. Exécution dynamique via eval()": "eval('__import__(\"os\").system(\"id\")')",
        "6. Exécution de bloc via exec()": "exec('import os')",
        "7. Lecture de fichier sensible": "open('/etc/passwd', 'r')",
        "8. Import caché de fonction": "__import__('subprocess').getoutput('whoami')",
        "9. Concaténation de module (Obfuscation)": "mod = 's' + 'ocket'\n__import__(mod).gethostname()",
        "10. Tentative d'accès réseau interdit (Google)": "import urllib.request\nurllib.request.urlopen('https://google.com')"
    }

    for nom, code_test in injections.items():
        print(f"Testing: {nom}")
        resultat = run_backtest(code_test)
        print(f"Result -> Status: {resultat.get('status')} | Error/Violation: {resultat.get('error') or resultat.get('details')}\n")