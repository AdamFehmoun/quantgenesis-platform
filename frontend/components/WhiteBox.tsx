'use client';

// ============================================================
// DONNÉES MOCK — à remplacer par BacktestResult.generated_code
// ============================================================
const MOCK_CODE = `import vectorbt as vbt
import pandas as pd

# Stratégie : Momentum BTC — drawdown max 10%
# Générée par QuantGenesis

def run_strategy(data: pd.DataFrame) -> dict:
    fast = data['close'].rolling(10).mean()
    slow = data['close'].rolling(30).mean()
    entries = fast > slow
    exits = fast < slow
    portfolio = vbt.Portfolio.from_signals(
        data['close'], entries=entries,
        exits=exits, init_cash=10000,
    )
    return portfolio.stats()`;

const MOCK_COMPLIANCE = [
  { agent: 'Agent Orchestrateur', decision: 'Spec validée', rationale: 'Intent compris et traduit en spec technique' },
  { agent: 'Agent Quant', decision: 'Code généré', rationale: 'Stratégie momentum implémentée avec VectorBT' },
  { agent: 'Agent Critique', decision: 'APPROVED', rationale: 'Métriques dans les limites acceptables' },
];
// ============================================================
// QUAND BERKANT EST CONNECTÉ :
// Remplace MOCK_CODE par BacktestResult.generated_code
// Remplace MOCK_COMPLIANCE par BacktestResult.compliance_log.decisions
// ============================================================

export default function WhiteBox() {
  const handleExport = () => {
    const blob = new Blob([MOCK_CODE], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'strategy.py';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{background: '#16181F', border: '1px solid #2a2a2a'}} className="rounded-xl p-6">
      <h3 className="text-white font-semibold mb-1">Code Python généré</h3>
      <p className="text-xs mb-4" style={{color: '#666'}}>Exportable — White-Box complet</p>

      <div style={{background: '#0d0f14', border: '1px solid #2a2a2a'}} className="rounded-lg p-4 mb-4 overflow-auto">
        <pre className="text-xs font-mono" style={{color: '#9FE1CB', lineHeight: 1.7}}>{MOCK_CODE}</pre>
      </div>

      <button
        onClick={handleExport}
        className="w-full py-3 rounded-lg font-medium text-sm text-white mb-6 transition-all"
        style={{background: '#1D9E75'}}
      >
        ⬇ Exporter strategy.py
      </button>

      <h3 className="text-white font-semibold mb-1">Log de conformité AI Act</h3>
      <p className="text-xs mb-4" style={{color: '#666'}}>Décisions traçables — Article 12</p>

      <div style={{border: '1px solid #2a2a2a'}} className="rounded-lg overflow-hidden">
        {MOCK_COMPLIANCE.map((item, index) => (
          <div
            key={index}
            className="flex justify-between items-center p-4"
            style={{borderBottom: index < MOCK_COMPLIANCE.length - 1 ? '1px solid #2a2a2a' : 'none', background: '#1a1c24'}}
          >
            <div>
              <p className="text-sm font-medium text-white">{item.agent}</p>
              <p className="text-xs mt-0.5" style={{color: '#555'}}>{item.rationale}</p>
            </div>
            <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{background: '#0F3028', color: '#1D9E75'}}>
              {item.decision}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}