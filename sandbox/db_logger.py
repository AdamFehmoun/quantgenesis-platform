import logging
from sqlmodel import Session
from app.core.db import engine
from app.models.sandbox_log import SandboxLog

logger = logging.getLogger(__name__)

def log_execution(status, execution_time_ms, memory_used_mb, code_hash, metrics: dict, error_type=None):
    # On extrait proprement les 4 métriques réelles remontées par la sandbox
    sharpe = metrics.get('sharpe_ratio')
    drawdown = metrics.get('drawdown')
    total_return = metrics.get('return')
    trades = metrics.get('num_trades')

    # Création de l'objet log (Vérifie que ces champs existent bien dans ton modèle SandboxLog)
    nouveau_log = SandboxLog(
        status=status,
        execution_time_ms=execution_time_ms,
        memory_used_mb=memory_used_mb,
        code_hash=code_hash,
        sharpe_ratio=sharpe,
        drawdown=drawdown,             # 🚀 AJOUT
        total_return_pct=total_return, # 🚀 AJOUT
        num_trades=trades,             # 🚀 AJOUT
        error_type=error_type
    )
    
    try:
        # Ouverture de la session et validation de la transaction
        with Session(engine) as session:
            session.add(nouveau_log)
            session.commit()
            logger.info(f"💾 [DB] Insertion réussie : Statut={status}, Latence={execution_time_ms}ms, Hash={code_hash}")
    except Exception as e:
        logger.error(f"❌ [DB] Échec de l'insertion dans SandboxLog : {e}")