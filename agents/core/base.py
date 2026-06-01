"""
Base class commune à tous les agents QuantGenesis.
Chaque agent hérite de cette classe — même interface, même logging.
"""
import os
import json
import time
from datetime import datetime, timezone
from abc import ABC, abstractmethod
import anthropic
from dotenv import load_dotenv
from budget import check_budget, record_cost, BudgetExceededError
from agents.core.cache import build_cache_key, get_cached, put_cached
load_dotenv()

class BaseAgent(ABC):
    """
    Tous les agents QuantGenesis héritent de cette classe.
    Règle fondamentale : les agents réfléchissent, ils ne codent JAMAIS.
    Leur output est toujours un dict JSON structuré.
    """

    def __init__(self, name: str, model: str = "claude-opus-4-6"):
        self.name = name
        self.model = model
        self.client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
        self.version = "v1"
        self.max_tokens = 1000  # défaut conservateur, override par chaque agent

    @property
    @abstractmethod
    def system_prompt(self) -> str:
        """Chaque agent définit son propre system prompt."""
        pass

    @abstractmethod
    def parse_output(self, raw: str) -> dict:
        """Chaque agent parse son output à sa façon."""
        pass

    def run(self, input_data: dict, verbose: bool = True) -> dict:
        """
        Point d'entrée unique pour tous les agents.
        Input  : dict avec le contexte
        Output : dict structuré + métadonnées de conformité
        """
        started_at = datetime.now(timezone.utc).isoformat()
        if verbose:
            print(f"\n{'='*50}")
            print(f"🤖 Agent [{self.name}] — {started_at}")
            print(f"{'='*50}")

        # Construire le message utilisateur depuis l'input
        user_message = json.dumps(input_data, ensure_ascii=False, indent=2)

        # B-CACHE: lookup avant tout appel API (skip silencieux pour Critique
        # ou si Redis est indisponible). La clé inclut prompt + modèle + input,
        # donc tout changement d'un de ces 3 invalide naturellement la clé.
        cache_key = build_cache_key(self.name, self.model, self.system_prompt, input_data)
        cached = get_cached(self.name, cache_key)
        if cached is not None:
            if verbose:
                print(f"💾 Cache HIT [{self.name}] — appel Anthropic évité")
            cached.setdefault("compliance_log", {})["from_cache"] = True
            cached["from_cache"] = True
            return cached

        # Vérifier le budget avant l'appel API
        check_budget()

        t0 = time.time()
        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                system=self.system_prompt,
                messages=[{"role": "user", "content": user_message}]
            )
        except anthropic.APITimeoutError:
            raise RuntimeError(f"[{self.name}] Timeout API Anthropic — la requête a expiré.")
        except anthropic.APIError as e:
            raise RuntimeError(f"[{self.name}] Erreur API Anthropic : {e}")
        except Exception as e:
            raise RuntimeError(f"[{self.name}] Erreur inattendue lors de l'appel API : {e}")
        latency_ms = int((time.time() - t0) * 1000)

        if not response.content:
            raise RuntimeError(f"[{self.name}] Réponse API vide — aucun contenu retourné.")
        raw_output = response.content[0].text

        # Enregistrer le coût
        cost = record_cost(self.name, response.usage.input_tokens, response.usage.output_tokens, self.model)

        if verbose:
            print(f"✅ Réponse reçue en {latency_ms}ms (coût: {cost:.4f}€)")

        # Parser l'output spécifique à l'agent
        parsed = self.parse_output(raw_output)

        # Envelopper avec les métadonnées AI Act Article 12
        result = {
            "agent": self.name,
            "version": self.version,
            "model": self.model,
            "timestamp": started_at,
            "latency_ms": latency_ms,
            "input_tokens": response.usage.input_tokens,
            "output_tokens": response.usage.output_tokens,
            "output": parsed,
            # Log de conformité AI Act Article 12
            "compliance_log": {
                "decision_traceable": True,
                "human_oversight_required": parsed.get("requires_human_review", False),
                "ai_generated": True,
                "agent_name": self.name,
                "logged_at": started_at,
            }
        }

        if verbose:
            print(f"📦 Output: {json.dumps(parsed, ensure_ascii=False, indent=2)[:300]}...")

        # B-CACHE: persiste le résultat selon le TTL de l'agent (no-op pour Critique).
        result["from_cache"] = False
        put_cached(self.name, cache_key, result)

        return result

    def _extract_json(self, text: str) -> dict:
        print(f"📏 Longueur raw output : {len(text)} chars")
        print(f"📄 Fin du texte : ...{text[-200:]}")  # voir si le JSON est complet
        """
        Utilitaire : extrait le JSON d'une réponse même si l'agent
        a ajouté du texte autour. Robuste aux backticks markdown
        et aux JSON tronqués par max_tokens.
        """
        import re
        # Chercher un bloc JSON entre backticks
        match = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.DOTALL)
        if match:
            return json.loads(match.group(1))
        # Chercher un JSON brut
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                # JSON probablement tronqué par max_tokens — tenter de réparer
                return self._repair_truncated_json(match.group(0))
        # Fallback : retourner le texte brut dans un dict
        return {"raw_response": text, "parse_error": True}

    def _repair_truncated_json(self, broken: str) -> dict:
        """
        Tente de réparer un JSON tronqué en fermant les structures ouvertes.
        """
        print("⚠️  JSON tronqué détecté — tentative de réparation...")
        # Couper au dernier champ complet (dernière virgule ou accolade valide)
        # Chercher la dernière valeur complète (fin de string, nombre, bool, null, ] ou })
        last_good = max(
            broken.rfind('",'),
            broken.rfind('},'),
            broken.rfind('],'),
            broken.rfind('true,'),
            broken.rfind('false,'),
        )
        if last_good > 0:
            broken = broken[:last_good + 1]  # inclure le " ou } ou ] mais pas la virgule

        # Fermer les structures ouvertes
        open_braces = broken.count('{') - broken.count('}')
        open_brackets = broken.count('[') - broken.count(']')
        # Retirer une virgule trailing si présente
        broken = broken.rstrip().rstrip(',')
        broken += ']' * max(0, open_brackets)
        broken += '}' * max(0, open_braces)

        try:
            result = json.loads(broken)
            result["_truncated"] = True
            print("✅ JSON réparé avec succès (données partielles)")
            return result
        except json.JSONDecodeError:
            print("❌ Réparation échouée")
            return {"raw_response": broken[:500], "parse_error": True, "_truncated": True}
