# ADR-001 : Choix de VectorBT comme moteur de backtesting

**Date** : 2026-05-11  
**Statut** : Accepté  
**Décideur** : Adam Fehmoun (Chef de Projet)

## Contexte

Le choix du moteur de backtesting est structurant pour l'architecture. Il détermine la vitesse d'exécution, la qualité du code généré par les agents IA, et l'expérience utilisateur.

## Options considérées

| Moteur | Langage | Vitesse | Facilité IA | Verdict |
|--------|---------|---------|-------------|---------|
| **VectorBT** | Python (NumPy) | Très haute | Élevée | ✅ Retenu |
| Backtrader | Python (boucles) | Moyenne | Moyenne | ❌ Trop lent |
| LEAN (QuantConnect) | C# / Python | Haute | Faible | ❌ Trop complexe |
| Zipline | Python | Basse | Faible | ❌ Déprécié |

## Décision

VectorBT Pro est retenu comme moteur de backtesting principal.

## Justification

1. **Vitesse** : Basé sur NumPy/Numba, vectorisé. Un backtest sur 5 ans de données minute s'exécute en quelques millisecondes — indispensable pour une UX temps réel.

2. **Concision du code** : Une stratégie complexe tient en 15-20 lignes avec VectorBT. Cette concision réduit les erreurs de génération par les agents IA.

3. **Optimisation native** : VectorBT teste nativement des milliers de combinaisons de paramètres en parallèle, permettant l'optimisation automatique des stratégies.

4. **Compatibilité IA** : Le code concis est plus facile à générer correctement pour un LLM que du code verbeux orienté objet.

## Conséquences

- Les agents IA (Architecte, Codeur) sont entraînés sur la syntaxe VectorBT
- Pas de boucles Python dans le code de backtest — tout doit être vectorisé
- La documentation VectorBT est injectée dans le contexte des agents
