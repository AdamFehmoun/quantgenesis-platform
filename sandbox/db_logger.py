from sqlmodel import Session
from app.core.db import engine
from app.models.sandbox_log import SandboxLog

def log_execution(status, execution_time_ms, memory_used_mb, code_hash, sharpe_ratio, error_type=None):
    # Création de l'objet log
    nouveau_log = SandboxLog(
        status=status,
        execution_time_ms=execution_time_ms,
        memory_used_mb=memory_used_mb,
        code_hash=code_hash,
        sharpe_ratio=sharpe_ratio,
        error_type=error_type
    )
    
    # Ouverture de la session et validation de la transaction
    with Session(engine) as session:
        session.add(nouveau_log)
        session.commit() # LIGNE CRUCIALE MANQUANTE
        print(f"💾 [DB] Insertion réussie : Statut={status}, Latence={execution_time_ms}ms, Hash={code_hash}")