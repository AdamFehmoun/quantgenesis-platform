"""
Agent Codeur — QuantGenesis
Transforme la spec de l'Architecte (+ l'intent) en script Python executable,
en s'appuyant sur les templates valides de Paul.

Le Codeur est DETERMINISTE (pas un agent LLM) : l'intelligence est deja en
amont. Il traduit une spec en appel de template. Le code genere est TOUJOURS
valide (builders de Paul testes). Generation libre par LLM = roadmap v2.

FLUX : spec + intent -> select_template -> params -> build_X_template
     -> string de code -> sandbox E2B. Le Codeur n'execute RIEN.
"""

from typing import Any

from agents.fallback_templates.selector import (
    select_template,
    _detect_asset,
    _is_crypto,
)
from agents.fallback_templates import (
    build_rsi_template,
    build_ma_template,
    build_bollinger_template,
    build_momentum_template,
)

_BUILDERS = {
    "rsi": build_rsi_template,
    "ma": build_ma_template,
    "bollinger": build_bollinger_template,
    "momentum": build_momentum_template,
}


def _extract_params_from_spec(spec: dict, template_name: str) -> dict:
    """
    Extrait les params exploitables de la spec (version 1 : simple et robuste).
    On ne parse PAS finement les seuils dans le texte (fragile). Les defauts
    surs des templates de Paul couvrent le reste -> code toujours valide.
    """
    params: dict = {}
    vbt = spec.get("vectorbt_specifics", {}) if isinstance(spec, dict) else {}
    if isinstance(vbt, dict):
        ic = vbt.get("init_cash")
        if isinstance(ic, (int, float)) and ic > 0:
            params["init_cash"] = float(ic)
    return params


def generate_code(spec: dict, user_intent: str) -> dict:
    """
    Point d'entree du Codeur.
    Retourne un dict avec status, template, asset, params, et code (string).
    """
    template_name = select_template(user_intent or "")
    asset = _detect_asset(user_intent or "")
    is_crypto = _is_crypto(asset)

    params = _extract_params_from_spec(spec or {}, template_name)
    params.setdefault("asset", asset)
    params.setdefault("period", "2y" if is_crypto else "5y")
    params.setdefault("slippage", 0.0015 if is_crypto else 0.001)

    builder = _BUILDERS.get(template_name, build_ma_template)
    code = builder(**params)

    return {
        "status": "CODE_GENERATED",
        "template": template_name,
        "asset": asset,
        "params": params,
        "code": code,
    }


if __name__ == "__main__":
    test_intents = [
        "RSI Bitcoin",
        "moving average crossover sur SPY",
        "bollinger bands ETH",
        "momentum sur Tesla",
        "je veux devenir riche",
        "strategie pas risquee sur BTC",
        "",
    ]
    print("Test du Codeur - generation de code pour intents varies\n")
    for intent in test_intents:
        result = generate_code(spec={}, user_intent=intent)
        code = result["code"]
        try:
            compile(code, "<generated>", "exec")
            status = "OK"
        except SyntaxError as e:
            status = f"ECHEC: {e}"
        print(f"  [{status}] intent={intent!r} -> template={result['template']}, asset={result['asset']}")
    print("\nSi tous OK : le Codeur genere du code valide pour n'importe quel intent.")
