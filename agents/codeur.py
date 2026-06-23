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


_VALID_TEMPLATES = {"rsi", "ma", "bollinger", "momentum"}

# Bornes des strategy_params (garde-fous). Format : clef -> (min, max, defaut).
# Le defaut n'est PAS injecte ici : si la valeur est absente/invalide, la clef est
# OMISE et le defaut du builder s'applique -> code toujours valide.
_PARAM_BOUNDS_INT = {
    "rsi_window": (5, 50, 14),
    "rsi_oversold": (10, 40, 30),
    "rsi_overbought": (60, 90, 70),
    "ma_regime_window": (20, 300, 200),
}
_SIZING_BOUNDS = (0.05, 0.30, 0.15)
_INIT_CASH_BOUNDS = (10_000, 10_000_000, 100_000)
_STOP_BOUNDS = (0.02, 0.30)


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def _is_number(x: Any) -> bool:
    # bool est une sous-classe de int : on l'exclut explicitement.
    return isinstance(x, (int, float)) and not isinstance(x, bool)


def validate_strategy_params(raw: Any) -> dict:
    """
    Valide et clampe le bloc strategy_params produit par l'Architecte (v11).

    Garde-fou central, REUTILISABLE par tous les points d'appel (codeur,
    selector, validation locale). Ne renvoie QUE les clefs valides (type OK +
    bornes respectees). Une clef absente/aberrante est omise -> le defaut sur du
    builder s'applique. Ne LEVE JAMAIS : tout input dingue est ignore ou clampe.

    Note : "template" n'est PAS traite ici (choix du builder gere en amont par
    _select_template_from_spec) — ce sont uniquement les params passes au builder.
    """
    out: dict = {}
    if not isinstance(raw, dict):
        return out

    # Fenetres et seuils (int clampes)
    for key, (lo, hi, _default) in _PARAM_BOUNDS_INT.items():
        val = raw.get(key)
        if _is_number(val):
            out[key] = int(_clamp(int(val), lo, hi))

    # sizing (fraction du capital)
    sizing = raw.get("sizing")
    if _is_number(sizing):
        lo, hi, _ = _SIZING_BOUNDS
        out["sizing"] = float(_clamp(float(sizing), lo, hi))

    # init_cash
    init_cash = raw.get("init_cash")
    if _is_number(init_cash):
        lo, hi, _ = _INIT_CASH_BOUNDS
        out["init_cash"] = float(_clamp(float(init_cash), lo, hi))

    # INVARIANT seuils : oversold + 10 <= overbought, sinon reset les DEUX aux defauts
    os_v = out.get("rsi_oversold")
    ob_v = out.get("rsi_overbought")
    if os_v is not None and ob_v is not None and os_v + 10 > ob_v:
        out["rsi_oversold"] = _PARAM_BOUNDS_INT["rsi_oversold"][2]      # 30
        out["rsi_overbought"] = _PARAM_BOUNDS_INT["rsi_overbought"][2]  # 70

    # regime_filter (bool strict)
    rf = raw.get("regime_filter")
    if isinstance(rf, bool):
        out["regime_filter"] = rf

    # Stops : sl_stop / sl_trail dans [0.02, 0.30] ou None
    lo_s, hi_s = _STOP_BOUNDS
    if _is_number(raw.get("sl_stop")):
        out["sl_stop"] = float(_clamp(float(raw["sl_stop"]), lo_s, hi_s))
    if _is_number(raw.get("sl_trail")):
        out["sl_trail"] = float(_clamp(float(raw["sl_trail"]), lo_s, hi_s))

    # INVARIANT RÈGLE 6 : jamais sl_stop ET sl_trail ensemble -> garder sl_stop
    if "sl_stop" in out and "sl_trail" in out:
        del out["sl_trail"]

    return out


def _select_template_from_spec(spec: dict, user_intent: str) -> str:
    """
    Choix du template. Si l'Architecte fournit strategy_params.template valide
    (dans {rsi, ma, bollinger, momentum}) -> on l'utilise (override du selector).
    Sinon -> fallback sur le selector par mots-clefs (comportement historique).
    """
    if isinstance(spec, dict):
        sp = spec.get("strategy_params")
        if isinstance(sp, dict):
            t = sp.get("template")
            if isinstance(t, str) and t.lower() in _VALID_TEMPLATES:
                return t.lower()
    return select_template(user_intent or "")


# Params issus de strategy_params propages UNIQUEMENT au template RSI (etape 1).
# Les autres templates (MA/Bollinger/Momentum) ne sont pas encore parametrables :
# on ne leur transmet que les clefs communes pour eviter tout TypeError (kwarg
# inattendu) et garantir zero regression.
_RSI_ONLY_KEYS = {
    "rsi_window", "rsi_oversold", "rsi_overbought",
    "ma_regime_window", "regime_filter", "sizing", "sl_stop", "sl_trail",
}
_COMMON_KEYS = {"init_cash"}


def _extract_params_from_spec(spec: dict, template_name: str) -> dict:
    """
    Extrait les params exploitables de la spec.

    Source principale : le bloc structure spec["strategy_params"] (Architecte v11),
    valide/clampe par validate_strategy_params (garde-fous). Etape 1 : seuls les
    params RSI-specifiques sont propages au template "rsi" ; les autres templates
    ne recoivent que les clefs communes (init_cash) -> zero regression.

    Compat ascendante : init_cash peut aussi venir de vectorbt_specifics.init_cash.
    """
    params: dict = {}
    if not isinstance(spec, dict):
        return params

    # Compat : ancien champ vectorbt_specifics.init_cash
    vbt = spec.get("vectorbt_specifics", {})
    if isinstance(vbt, dict):
        ic = vbt.get("init_cash")
        if _is_number(ic) and ic > 0:
            params["init_cash"] = float(ic)

    # Source principale : bloc structure strategy_params (valide + clampe)
    sp = validate_strategy_params(spec.get("strategy_params", {}))
    for key, val in sp.items():
        if key in _COMMON_KEYS:
            params[key] = val
        elif key in _RSI_ONLY_KEYS and template_name == "rsi":
            params[key] = val
        # sinon : clef RSI-specifique pour un template non-RSI -> ignoree (etape 1)

    return params


def generate_code(spec: dict, user_intent: str) -> dict:
    """
    Point d'entree du Codeur.
    Retourne un dict avec status, template, asset, params, et code (string).
    """
    template_name = _select_template_from_spec(spec or {}, user_intent or "")
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
