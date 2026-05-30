# B-SANDBOX: dispatch the generated code to Mathis' E2B executor when the
    # agents approved the spec. Skip on REJECTED to avoid burning sandbox time.
    backtest_result: dict[str, Any] | None = None
    if status == "success":
        # 🚀 FIX : On supprime le hardcodage BTC-USD et on passe le vrai code de l'IA
        code = claude_code_instructions
        
        if code:
            # 🚀 FIX : On force l'affichage des 4 métriques à la fin du code généré
            code += """
# --- Injections Metrics QuantGenesis ---
print(f'SHARPE:{float(pf.sharpe_ratio()):.4f}')
print(f'DRAWDOWN:{float(pf.max_drawdown()):.4f}')
print(f'RETURN:{float(pf.total_return()):.4f}')
print(f'TRADES:{int(pf.trades.count() if hasattr(pf, "trades") else 0)}')
"""
            backtest_result = _run_sandbox_backtest(code, spread=spread)
        else:
            logger.warning("No claude_code_instructions returned by agents; skipping backtest.")

    metrics = _build_metrics(backtest_result)

    strategy_payload: dict[str, Any] = {"metrics": metrics, "backtest_params": backtest_params}