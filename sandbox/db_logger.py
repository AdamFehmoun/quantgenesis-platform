import sys
import os
import hashlib

# On connecte le script au dossier backend
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(current_dir, '..', 'backend')
sys.path.append(backend_dir)

try:
    from app.models.sandbox_log import SandboxLog
    # Note : Il faudra remplacer l'import ci-dessous par la vraie session de votre backend
    # from app.db.session import SessionLocal 
    DB_AVAILABLE = True
except ImportError as e:
    print(f"⚠️ [AVERTISSEMENT] Imports backend introuvables : {e}")
    DB_AVAILABLE = False

def log_execution(result: dict, code_snippet: str = "CODE_NON_FOURNI"):
    """Enregistre le résultat du backtest dans la base PostgreSQL via SQLModel."""
    try:
        # Hachage du code (requis par M-14)
        code_hash = hashlib.sha256(code_snippet.encode('utf-8')).hexdigest()
        
        status = result.get('status', 'UNKNOWN')
        latency = result.get('execution_time_ms', 0)
        
        print(f"💾 [DB] Préparation insertion : Statut={status}, Latence={latency}ms, Hash={code_hash[:8]}")

        if DB_AVAILABLE:
            new_log = SandboxLog(
                status=status,
                execution_time_ms=latency,
                memory_used_mb=result.get('memory_mb', 0.0),
                code_hash=code_hash,
                sharpe_ratio=result.get('sharpe_ratio'),
                error_type=result.get('error') if status == 'ERROR' else None
            )
            
            # --- À décommenter quand la session DB du backend sera importée ---
            # with SessionLocal() as session:
            #     session.add(new_log)
            #     session.commit()
            #     print("✅ Insertion PostgreSQL réussie.")
        else:
            print("🟢 [SIMULATION] Enregistrement SQLModel formaté avec succès.")
            
    except Exception as e:
        print(f"⚠️ Erreur critique lors du logging BDD : {e}")