'use client';

// ============================================================
// DONNÉES MOCK — à remplacer par BacktestResult.compliance_log
// ============================================================
const MOCK_AUDIT = [
  { agent: 'Agent Orchestrateur', decision: 'Spec validée', rationale: 'Intent compris et traduit en spec technique momentum BTC', timestamp: '14:32:01' },
  { agent: 'Agent Quant', decision: 'Code généré', rationale: 'Stratégie momentum implémentée avec VectorBT, paramètres optimisés', timestamp: '14:32:08' },
  { agent: 'Agent Critique', decision: 'APPROVED', rationale: 'Sharpe 1.45, drawdown -8.3% — dans les limites acceptables', timestamp: '14:32:15' },
];
// ============================================================
// QUAND ADAM A FINI A-08 :
// Remplace MOCK_AUDIT par BacktestResult.compliance_log.decisions
// ============================================================

export default function AuditTrail() {
  return (
    <div style={{background: '#16181F', border: '1px solid #2a2a2a'}} className="rounded-xl p-6">
      <h3 className="text-white font-semibold mb-1">Audit Trail</h3>
      <p className="text-xs mb-6" style={{color: '#666'}}>Décisions agents IA — traçabilité complète</p>

      <div className="relative">
        {MOCK_AUDIT.map((item, index) => (
          <div key={index} className="flex gap-4 mb-4 last:mb-0">
            <div className="flex flex-col items-center">
              <div className="w-3 h-3 rounded-full mt-1 flex-shrink-0" style={{background: '#1D9E75'}} />
              {index < MOCK_AUDIT.length - 1 && (
                <div className="w-px flex-1 mt-1" style={{background: '#2a2a2a'}} />
              )}
            </div>
            <div className="flex-1 rounded-lg p-4 mb-2" style={{background: '#1a1c24', border: '1px solid #2a2a2a'}}>
              <div className="flex justify-between items-start mb-2">
                <p className="text-sm font-medium text-white">{item.agent}</p>
                <span className="text-xs" style={{color: '#555'}}>{item.timestamp}</span>
              </div>
              <p className="text-xs mb-2" style={{color: '#666'}}>{item.rationale}</p>
              <span className="text-xs font-semibold" style={{color: '#1D9E75'}}>→ {item.decision}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}