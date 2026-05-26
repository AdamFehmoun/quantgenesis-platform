'use client';

// ============================================================
// DONNÉES MOCK — à remplacer par les vraies données de Berkant
// Ces données viendront de : BacktestResult.generated_code
// et BacktestResult.compliance_log
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
        data['close'],
        entries=entries,
        exits=exits,
        init_cash=10000,
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
    <div className="mt-6 border rounded-lg p-4">

      {/* Code Python généré */}
      <h3 className="text-sm font-semibold text-gray-600 mb-3">
        Code Python généré
      </h3>
      <div className="bg-gray-900 rounded-lg p-4 mb-4 overflow-auto">
        <pre className="text-green-400 text-xs font-mono whitespace-pre">
          {MOCK_CODE}
        </pre>
      </div>

      {/* Bouton export */}
      <button
        onClick={handleExport}
        className="w-full bg-blue-500 text-white py-2 px-4 rounded mb-6 hover:bg-blue-600"
      >
        ⬇ Exporter strategy.py
      </button>

      {/* Log AI Act */}
      <h3 className="text-sm font-semibold text-gray-600 mb-3">
        Log de conformité AI Act
      </h3>
      <div className="border rounded-lg overflow-hidden">
        {MOCK_COMPLIANCE.map((item, index) => (
          <div
            key={index}
            className="flex justify-between items-center p-3 border-b last:border-b-0"
          >
            <div>
              <p className="text-sm font-medium text-gray-700">{item.agent}</p>
              <p className="text-xs text-gray-400">{item.rationale}</p>
            </div>
            <span className="text-sm font-semibold text-green-600">
              {item.decision}
            </span>
          </div>
        ))}
      </div>

    </div>
  );
}