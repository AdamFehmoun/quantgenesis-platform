"""
Orchestrateur QuantGenesis — le pipeline complet.

Usage :
    python orchestrator.py "stratégie momentum Bitcoin drawdown max 10%"

Ce fichier est le point d'entrée unique du système d'agents.
Il enchaîne tous les agents dans l'ordre et gère les erreurs,
les retries, et les rejets du Critique.
"""
import sys
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from agents.brainstormer import BrainstormerAgent
from agents.specialized import (
    ChefProjetAgent,
    ArchitecteAgent,
    CritiqueAgent,
    ConformiteAgent,
)
from budget import BudgetExceededError, get_daily_summary


MAX_CRITIQUE_RETRIES = 2  # Si le Critique rejette, on retente N fois


def run_pipeline(user_intent: str, verbose: bool = True) -> dict:
    """
    Pipeline complet : intention → spec validée → log conformité.

    Retourne un dict avec :
    - tous les outputs intermédiaires (traçabilité complète)
    - la spec finale approuvée par le Critique
    - le log de conformité AI Act
    - les instructions pour Claude Code
    """
    pipeline_start = datetime.now(timezone.utc).isoformat()

    if verbose:
        print(f"\n{'🚀 '*20}")
        print(f"QUANTGENESIS PIPELINE DÉMARRÉ")
        print(f"Intent: {user_intent}")
        print(f"{'🚀 '*20}\n")

    # ─────────────────────────────────────────────
    # ÉTAPE 1 : BRAINSTORMER
    # ─────────────────────────────────────────────
    brainstormer = BrainstormerAgent()
    brainstormer_result = brainstormer.process(user_intent)
    brainstormer_output = brainstormer_result["output"]

    if brainstormer_output.get("feasibility", {}).get("score", 10) < 4:
        return _pipeline_rejected(
            reason="Faisabilité trop faible selon le Brainstormer",
            brainstormer_output=brainstormer_output
        )

    # ─────────────────────────────────────────────
    # ÉTAPE 2 : CHEF DE PROJET
    # ─────────────────────────────────────────────
    chef_projet = ChefProjetAgent()
    chef_projet_result = chef_projet.process(brainstormer_output)
    chef_projet_output = chef_projet_result["output"]

    # ─────────────────────────────────────────────
    # ÉTAPE 3 : ARCHITECTE
    # ─────────────────────────────────────────────
    architecte = ArchitecteAgent()
    architecte_result = architecte.process(chef_projet_output, brainstormer_output)
    architecte_output = architecte_result["output"]

    # ─────────────────────────────────────────────
    # ÉTAPE 4 : CRITIQUE (avec retry si rejeté)
    # ─────────────────────────────────────────────
    critique = CritiqueAgent()
    critique_output = None
    approved = False

    for attempt in range(1, MAX_CRITIQUE_RETRIES + 2):
        if verbose:
            print(f"\n🔍 Critique — Tentative {attempt}/{MAX_CRITIQUE_RETRIES + 1}")

        critique_result = critique.process(architecte_output)
        critique_output = critique_result["output"]

        # Erreur technique de parsing → ne pas compter comme un rejet
        if critique_output.get("parse_error"):
            if verbose:
                print(f"⚠️  Critique — erreur technique de parsing (tentative {attempt})")
            continue

        audit_result = critique_output.get("audit_result", "REJECTED")

        if audit_result in ("APPROVED", "APPROVED_WITH_WARNINGS"):
            approved = True
            if verbose:
                print(f"✅ Critique : {audit_result}")
            break
        else:
            if verbose:
                print(f"❌ Critique REJECTED — tentative {attempt}")
                for issue in critique_output.get("critical_issues", []):
                    if issue.get("severity") == "blocking":
                        print(f"  🚨 BLOQUANT : {issue['description']}")

            if attempt <= MAX_CRITIQUE_RETRIES:
                # Refeed le feedback au Architecte pour correction
                if verbose:
                    print(f"♻️  Renvoi à l'Architecte pour correction...")
                feedback = critique_output.get("feedback_to_architecte", "")
                architecte_result = architecte.process(
                    {**chef_projet_output, "critique_feedback": feedback},
                    brainstormer_output
                )
                architecte_output = architecte_result["output"]

    if not approved:
        return _pipeline_rejected(
            reason=f"Critique a rejeté après {MAX_CRITIQUE_RETRIES + 1} tentatives",
            critique_output=critique_output
        )

    # ─────────────────────────────────────────────
    # ÉTAPE 5 : CONFORMITÉ AI ACT
    # ─────────────────────────────────────────────
    conformite = ConformiteAgent()
    conformite_result = conformite.process({
        "user_intent": user_intent,
        "brainstormer_output": brainstormer_output,
        "chef_projet_output": chef_projet_output,
        "architecte_output": architecte_output,
        "critique_output": critique_output,
    })
    conformite_output = conformite_result["output"]

    # ─────────────────────────────────────────────
    # OUTPUT FINAL
    # ─────────────────────────────────────────────
    pipeline_end = datetime.now(timezone.utc).isoformat()

    final_output = {
        "status": "SUCCESS",
        "pipeline_start": pipeline_start,
        "pipeline_end": pipeline_end,
        "user_intent": user_intent,

        # La spec finale validée — ce que Claude Code va utiliser
        "final_spec": architecte_output,

        # Instructions directes pour Claude Code
        "claude_code_instructions": architecte_output.get("claude_code_instructions", ""),

        # Conformité AI Act — log immuable
        "compliance_log": conformite_output,

        # Audit qualité
        "critique_result": critique_output.get("audit_result"),
        "warnings": critique_output.get("warnings", []),

        # Traçabilité complète (pour le rapport + suiveur ESIEE)
        "trace": {
            "brainstormer": brainstormer_output,
            "chef_projet": chef_projet_output,
            "architecte": architecte_output,
            "critique": critique_output,
            "conformite": conformite_output,
        }
    }

    # Sauvegarder l'output dans /outputs/
    _save_output(final_output, user_intent)

    if verbose:
        print(f"\n{'✅ '*20}")
        print(f"PIPELINE TERMINÉ AVEC SUCCÈS")
        print(f"Stratégie : {brainstormer_output.get('clarified_intent', {}).get('strategy_name', 'N/A')}")
        print(f"Audit : {critique_output.get('audit_result')}")
        print(f"\n📋 Instructions pour Claude Code :")
        print(f"{architecte_output.get('claude_code_instructions', '')}")
        print(f"{'✅ '*20}\n")

    return final_output


def _pipeline_rejected(reason: str, **context) -> dict:
    """Output standardisé quand le pipeline rejette une stratégie."""
    return {
        "status": "REJECTED",
        "reason": reason,
        "context": context,
        "requires_human_review": True,
    }


def _save_output(output: dict, user_intent: str):
    """Sauvegarder l'output dans /outputs/ avec un nom lisible."""
    outputs_dir = Path(__file__).parent / "outputs"
    outputs_dir.mkdir(exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    # Nom de fichier safe depuis l'intent
    safe_name = "".join(c if c.isalnum() else "_" for c in user_intent[:40])
    filename = outputs_dir / f"{timestamp}_{safe_name}.json"

    with open(filename, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"💾 Output sauvegardé : {filename}")


def show_budget():
    """Affiche le budget consommé aujourd'hui."""
    summary = get_daily_summary()
    print(f"\n💰 Budget quotidien QuantGenesis — {summary['date']}")
    print(f"   Dépensé : {summary['spent']:.2f}€ / 4.00€")
    print(f"   Restant : {max(0, 4.0 - summary['spent']):.2f}€")
    if summary.get("calls"):
        print(f"\n   Détail des appels :")
        for call in summary["calls"]:
            print(f"   - {call['agent']:15s} | {call['input_tokens']:5d} in + {call['output_tokens']:5d} out | {call['cost_eur']:.4f}€ | {call['model']}")
    else:
        print(f"   Aucun appel aujourd'hui.")


if __name__ == "__main__":
    if len(sys.argv) >= 2 and sys.argv[1] == "--budget":
        show_budget()
        sys.exit(0)

    if len(sys.argv) < 2:
        print("Usage: python orchestrator.py 'votre stratégie en langage naturel'")
        print("       python orchestrator.py --budget")
        sys.exit(1)

    user_intent = " ".join(sys.argv[1:])

    try:
        result = run_pipeline(user_intent, verbose=True)
    except BudgetExceededError as e:
        print(f"\n🚫 {e}")
        sys.exit(2)

    if result["status"] == "REJECTED":
        print(f"\n❌ Pipeline rejeté : {result['reason']}")
        sys.exit(1)

    summary = get_daily_summary()
    print(f"💰 Budget quotidien utilisé : {summary['spent']:.2f}€ / 4.00€")
