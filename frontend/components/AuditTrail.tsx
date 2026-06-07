'use client';
import { BacktestResult } from '../app/page';

interface AuditTrailProps {
  result: BacktestResult;
}

export default function AuditTrail({ result }: AuditTrailProps) {
  const decisionTrace = result.compliance_log?.decision_trace;
  const pipelineStart = result.pipeline?.pipeline_start
    ? new Date(result.pipeline.pipeline_start).toLocaleTimeString('fr-FR')
    : null;

  const entries = decisionTrace
    ? Object.entries(decisionTrace)
    : [];

  return (
    <div style={{background: '#16181F', border: '1px solid #2a2a2a'}} className="rounded-xl p-6">
      <h3 className="text-white font-semibold mb-1">Audit Trail</h3>
      <p className="text-xs mb-6" style={{color: '#666'}}>
        Décisions agents IA — traçabilité complète
        {pipelineStart && ` · Démarré à ${pipelineStart}`}
      </p>

      <div className="relative">
        {entries.length > 0 ? (
          entries.map(([agent, decision], index) => (
            <div key={agent} className="flex gap-4 mb-4 last:mb-0">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 rounded-full mt-1 flex-shrink-0" style={{background: '#1D9E75'}} />
                {index < entries.length - 1 && (
                  <div className="w-px flex-1 mt-1" style={{background: '#2a2a2a'}} />
                )}
              </div>
              <div className="flex-1 rounded-lg p-4 mb-2" style={{background: '#1a1c24', border: '1px solid #2a2a2a'}}>
                <p className="text-sm font-medium text-white mb-1">{agent}</p>
                <p className="text-xs mb-2" style={{color: '#666'}}>
                  {typeof decision === 'object' ? JSON.stringify(decision).slice(0, 120) : String(decision)}
                </p>
                <span className="text-xs font-semibold" style={{color: '#1D9E75'}}>→ Complété</span>
              </div>
            </div>
          ))
        ) : (
          // Fallback avec données pipeline si pas de decision_trace
          [
            { agent: 'Pipeline', decision: result.pipeline?.status || 'Complété', rationale: `Intent : "${result.intent || 'Non disponible'}"` },
            { agent: 'Backtest', decision: result.backtest?.status || 'N/A', rationale: result.backtest?.error || 'Exécuté' },
          ].map((item, index, arr) => (
            <div key={item.agent} className="flex gap-4 mb-4 last:mb-0">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 rounded-full mt-1 flex-shrink-0" style={{background: item.decision === 'FALLBACK' ? '#FAC775' : '#1D9E75'}} />
                {index < arr.length - 1 && <div className="w-px flex-1 mt-1" style={{background: '#2a2a2a'}} />}
              </div>
              <div className="flex-1 rounded-lg p-4 mb-2" style={{background: '#1a1c24', border: '1px solid #2a2a2a'}}>
                <p className="text-sm font-medium text-white mb-1">{item.agent}</p>
                <p className="text-xs mb-2" style={{color: '#666'}}>{item.rationale}</p>
                <span className="text-xs font-semibold" style={{color: item.decision === 'FALLBACK' ? '#FAC775' : '#1D9E75'}}>→ {item.decision}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}