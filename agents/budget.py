"""
Contrôle budgétaire quotidien pour le pipeline QuantGenesis.
Stocke les dépenses dans ~/.quantgenesis_budget.json et bloque
les appels API si le budget journalier est dépassé.
"""
import json
from datetime import date
from pathlib import Path

BUDGET_FILE = Path.home() / ".quantgenesis_budget.json"
DAILY_LIMIT_EUR = 4.0

# Coût de base par token (USD ≈ EUR simplifié)
BASE_INPUT_COST = 0.000003   # $/token input
BASE_OUTPUT_COST = 0.000015  # $/token output
OPUS_MULTIPLIER = 5


class BudgetExceededError(Exception):
    pass


def _load() -> dict:
    """Charge le fichier budget. Reset si le jour a changé."""
    today = date.today().isoformat()
    if BUDGET_FILE.exists():
        try:
            data = json.loads(BUDGET_FILE.read_text())
            if data.get("date") == today:
                return data
        except json.JSONDecodeError:
            pass
    return {"date": today, "spent": 0.0, "calls": []}


def _save(data: dict):
    BUDGET_FILE.write_text(json.dumps(data, indent=2))


def check_budget():
    """Vérifie le budget avant un appel API. Lève BudgetExceededError si dépassé."""
    data = _load()
    if data["spent"] >= DAILY_LIMIT_EUR:
        raise BudgetExceededError(
            f"Budget quotidien {DAILY_LIMIT_EUR}€ atteint ({data['spent']:.2f}€ dépensés). Reprendre demain."
        )


def estimate_cost(input_tokens: int, output_tokens: int, model: str) -> float:
    """Calcule le coût estimé d'un appel API."""
    multiplier = OPUS_MULTIPLIER if "opus" in model.lower() else 1
    cost = (input_tokens * BASE_INPUT_COST + output_tokens * BASE_OUTPUT_COST) * multiplier
    return round(cost, 4)


def record_cost(agent_name: str, input_tokens: int, output_tokens: int, model: str) -> float:
    """Enregistre le coût d'un appel API et retourne le coût en euros."""
    cost = estimate_cost(input_tokens, output_tokens, model)
    data = _load()
    data["spent"] = round(data["spent"] + cost, 4)
    data["calls"].append({
        "agent": agent_name,
        "model": model,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "cost_eur": cost,
    })
    _save(data)
    return cost


def get_daily_summary() -> dict:
    """Retourne le résumé du budget du jour."""
    return _load()
