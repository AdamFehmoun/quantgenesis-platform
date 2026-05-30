FROM e2bdev/code-interpreter:latest

USER root
# Installation de Numba, VectorBT et YFinance
RUN pip install --no-cache-dir numba vectorbt yfinance python-dotenv

# On repasse sur l'utilisateur par défaut pour préserver l'agent E2B
USER user