"""
Agents spécialisés du pipeline QuantGenesis.
Tous héritent de BaseAgent — même interface, même logging.
"""
import os
from datetime import datetime, timezone
from agents.base import BaseAgent


class ChefProjetAgent(BaseAgent):
    def __init__(self):
        super().__init__(name="ChefProjet", model="claude-opus-4-6")
        self.max_tokens = 2000
        path = os.path.join(os.path.dirname(__file__), "..", "prompts", "chef_projet_v2.txt")
        with open(path, "r", encoding="utf-8") as f:
            self._system_prompt = f.read()

    @property
    def system_prompt(self) -> str:
        return self._system_prompt

    def parse_output(self, raw: str) -> dict:
        return self._extract_json(raw)

    def process(self, brainstormer_output: dict) -> dict:
        return self.run(input_data={"brainstormer_output": brainstormer_output})


class ArchitecteAgent(BaseAgent):
    def __init__(self):
        super().__init__(name="Architecte", model="claude-opus-4-6")
        self.max_tokens = 5000
        path = os.path.join(os.path.dirname(__file__), "..", "prompts", "architecte_v7.txt")
        with open(path, "r", encoding="utf-8") as f:
            self._system_prompt = f.read()

    @property
    def system_prompt(self) -> str:
        return self._system_prompt

    def parse_output(self, raw: str) -> dict:
        return self._extract_json(raw)

    def process(self, chef_projet_output: dict, brainstormer_output: dict) -> dict:
        return self.run(input_data={
            "chef_projet_plan": chef_projet_output,
            "brainstormer_context": brainstormer_output
        })


class CritiqueAgent(BaseAgent):
    def __init__(self):
        super().__init__(name="Critique", model="claude-opus-4-6")
        self.max_tokens = 3000
        path = os.path.join(os.path.dirname(__file__), "..", "prompts", "critique_v2.txt")
        with open(path, "r", encoding="utf-8") as f:
            self._system_prompt = f.read()

    @property
    def system_prompt(self) -> str:
        return self._system_prompt

    def parse_output(self, raw: str) -> dict:
        return self._extract_json(raw)

    def process(self, architecte_output: dict) -> dict:
        return self.run(input_data={"spec_to_audit": architecte_output})


class ConformiteAgent(BaseAgent):
    LEGAL_DISCLAIMERS = [
        "Ce système génère des stratégies à des fins de recherche uniquement.",
        "Les performances passées ne préjugent pas des performances futures.",
        "QuantGenesis n'est pas un prestataire de services d'investissement.",
        "L'utilisateur est seul responsable de l'utilisation de ces stratégies.",
    ]

    def __init__(self):
        super().__init__(name="Conformite", model="claude-opus-4-6")
        self.max_tokens = 3000
        path = os.path.join(os.path.dirname(__file__), "..", "prompts", "conformite_v3.txt")
        with open(path, "r", encoding="utf-8") as f:
            self._system_prompt = f.read()

    @property
    def system_prompt(self) -> str:
        return self._system_prompt

    def parse_output(self, raw: str) -> dict:
        return self._extract_json(raw)

    @staticmethod
    def _inject_timestamp(d: dict, now: str):
        """Cherche récursivement 'compliance_record' et écrase generated_at."""
        for key, value in d.items():
            if key == "compliance_record" and isinstance(value, dict):
                value["generated_at"] = now
            elif isinstance(value, dict):
                ConformiteAgent._inject_timestamp(value, now)

    def process(self, full_pipeline_context: dict) -> dict:
        result = self.run(input_data=full_pipeline_context)
        output = result.get("output", result)
        now = datetime.now(timezone.utc).isoformat()
        self._inject_timestamp(output, now)
        output["legal_disclaimers"] = list(self.LEGAL_DISCLAIMERS)
        print(f"✅ Date injectée : {now}")
        return result
