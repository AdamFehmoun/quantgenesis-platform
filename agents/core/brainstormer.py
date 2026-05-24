"""
Agent Brainstormer — Premier agent du pipeline QuantGenesis.

Rôle : transformer une intention vague en spécification claire
       exploitable par les agents suivants.

Il ne code JAMAIS. Il clarifie, enrichit, anticipe.
"""
import os
from agents.core.base import BaseAgent


class BrainstormerAgent(BaseAgent):

    def __init__(self):
        super().__init__(name="Brainstormer", model="claude-opus-4-6")
        # Charger le prompt depuis le fichier versionné
        self.max_tokens = 3000
        prompt_path = os.path.join(
            os.path.dirname(__file__), "..", "prompts", "brainstormer_v2.txt"
        )
        with open(prompt_path, "r", encoding="utf-8") as f:
            self._system_prompt = f.read()

    @property
    def system_prompt(self) -> str:
        return self._system_prompt

    def parse_output(self, raw: str) -> dict:
        return self._extract_json(raw)

    def process(self, user_intent: str) -> dict:
        """
        Point d'entrée principal.
        user_intent : la phrase brute de l'utilisateur
        """
        return self.run(input_data={"user_intent": user_intent})
