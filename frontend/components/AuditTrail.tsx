'use client';

// ============================================================
// DONNÉES MOCK — à remplacer par les vraies données de Adam/agents
// Ces données viendront de : BacktestResult.compliance_log
// Format attendu : { agent: string, decision: string, rationale: string, timestamp: string }[]
// ============================================================
const MOCK_AUDIT = [
  {
    agent: 'Agent Orchestrateur',
    decision: 'Spec validée',
    rationale: 'Intent compris et traduit en spec technique momentum BTC',
    timestamp: '14:32:01',
  },
  {
    agent: 'Agent Quant',
    decision: 'Code généré',
    rationale: 'Stratégie momentum implémentée avec VectorBT, paramètres optimisés',
    timestamp: '14:32:08',
  },
  {
    agent: 'Agent Critique',
    decision: 'APPROVED',
    rationale: 'Sharpe 1.45, drawdown -8.3% — dans les limites acceptables',
    timestamp: '14:32:15',
  },
];
// ============================================================
// QUAND ADAM A FINI A-08 :
// Remplace MOCK_AUDIT par BacktestResult.compliance_log.decisions
// Ajoute les vrais timestamps depuis compliance_log.logged_at
// ============================================================

export default function AuditTrail() {
  return (
    <div className="mt-6 border rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-600 mb-4">
        Audit Trail — Décisions agents IA
      </h3>

      <div className="relative">
        {MOCK_AUDIT.map((item, index) => (
          <div key={index} className="flex gap-4 mb-6 last:mb-0">

            {/* Timeline */}
            <div className="flex flex-col items-center">
              <div className="w-3 h-3 rounded-full bg-green-500 mt-1" />
              {index < MOCK_AUDIT.length - 1 && (
                <div className="w-0.5 bg-gray-200 flex-1 mt-1" />
              )}
            </div>

            {/* Contenu */}
            <div className="flex-1 border rounded-lg p-3 mb-2">
              <div className="flex justify-between items-start mb-1">
                <p className="text-sm font-semibold text-gray-700">{item.agent}</p>
                <span className="text-xs text-gray-400">{item.timestamp}</span>
              </div>
              <p className="text-xs text-gray-400 mb-2">{item.rationale}</p>
              <span className="text-xs font-semibold text-green-600">
                → {item.decision}
              </span>
            </div>

          </div>
        ))}
      </div>

    </div>
  );
}