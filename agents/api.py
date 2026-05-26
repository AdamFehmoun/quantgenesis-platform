"""
Interface publique du pipeline QuantGenesis.

Usage :
    from api import run_pipeline

    result = run_pipeline("RSI Bitcoin")           # silencieux
    result = run_pipeline("RSI Bitcoin", verbose=True)  # debug

    print(result["status"])  # "SUCCESS" | "REJECTED" | "ERROR"
    print(result["result"])  # dict complet du pipeline ou None
    print(result["error"])   # None ou message d'erreur
"""
import json
from orchestrator import run_pipeline as _run_pipeline
from budget import BudgetExceededError


def run_pipeline(user_intent: str, verbose: bool = False) -> dict:
    """
    Lance le pipeline QuantGenesis et retourne un dict normalisé.
    Toutes les erreurs sont catchées — ne lève jamais d'exception.

    Args:
        user_intent: Intent en langage naturel.
        verbose: Si True, affiche les outputs intermédiaires de chaque agent
                 (utile pour debug). Si False (défaut), silencieux.
    """
    try:
        result = _run_pipeline(user_intent, verbose=verbose)

        if verbose:
            _print_intermediate_outputs(result)

        return {
            "status": result.get("status", "SUCCESS"),
            "result": result,
            "error": result.get("reason") if result.get("status") == "REJECTED" else None,
        }
    except BudgetExceededError as e:
        return {"status": "ERROR", "result": None, "error": str(e)}
    except RuntimeError as e:
        return {"status": "ERROR", "result": None, "error": str(e)}
    except Exception as e:
        return {"status": "ERROR", "result": None, "error": f"Erreur inattendue : {e}"}


def _print_intermediate_outputs(result: dict) -> None:
    """Affiche le détail des outputs de chaque agent (mode verbose)."""
    print("\n" + "=" * 60)
    print("OUTPUTS INTERMÉDIAIRES PAR AGENT")
    print("=" * 60)

    trace = result.get("trace")
    if not trace:
        # Pipeline rejeté tôt : trace partielle dans context
        context = result.get("context", {})
        for agent_name, agent_output in context.items():
            _print_agent_block(agent_name, agent_output)
        return

    for agent_name, agent_output in trace.items():
        _print_agent_block(agent_name, agent_output)


def _print_agent_block(agent_name: str, agent_output) -> None:
    print(f"\n--- {agent_name.upper()} ---")
    try:
        print(json.dumps(agent_output, ensure_ascii=False, indent=2))
    except (TypeError, ValueError):
        print(repr(agent_output))
