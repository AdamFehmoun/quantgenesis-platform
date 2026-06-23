'use client';
import { ScrollText } from 'lucide-react';
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
    <div className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(10,8,20,0.7)', border: '1px solid rgba(123,57,252,0.2)', backdropFilter: 'blur(24px)' }}>

      <div className="px-6 py-4 flex items-center gap-3"
        style={{ borderBottom: '1px solid rgba(123,57,252,0.12)', background: 'rgba(123,57,252,0.05)' }}>
        <span className="flex items-center gap-2 text-sm font-semibold text-white" style={{ fontFamily: 'Manrope' }}>
          <ScrollText size={16} color="#a78bfa" strokeWidth={2} /> Audit Trail
        </span>
        <span className="text-xs" style={{ color: '#666', fontFamily: 'Inter' }}>
          Décisions agents IA — traçabilité complète
          {pipelineStart && ` · Démarré à ${pipelineStart}`}
        </span>
      </div>

      <div className="p-6">
        <div className="relative">
          {entries.length > 0 ? (
            entries.map(([agent, decision], index) => (
              <div key={agent} className="flex gap-4 mb-4 last:mb-0">
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
                    style={{ background: '#7b39fc', boxShadow: '0 0 8px rgba(123,57,252,0.6)' }} />
                  {index < entries.length - 1 && (
                    <div className="w-px flex-1 mt-1" style={{ background: 'linear-gradient(180deg, rgba(123,57,252,0.4), rgba(6,182,212,0.2))' }} />
                  )}
                </div>
                <div className="flex-1 rounded-xl p-4 mb-2"
                  style={{ background: 'rgba(123,57,252,0.05)', border: '1px solid rgba(123,57,252,0.12)' }}>
                  <p className="text-sm font-medium text-white mb-1" style={{ fontFamily: 'Manrope' }}>{agent}</p>
                  {typeof decision === 'object' && decision !== null ? (
                    <details className="audit-details mb-2">
                      <summary className="text-xs break-words" style={{ color: '#8a96a8', cursor: 'pointer', fontFamily: 'Inter' }}>
                        {JSON.stringify(decision).slice(0, 120)}
                        <span className="audit-toggle" style={{ color: '#a78bfa', marginLeft: 6, fontWeight: 600 }} />
                      </summary>
                      <pre className="text-xs mt-2 p-3 rounded-lg"
                        style={{ color: '#999', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(123,57,252,0.15)', overflowX: 'auto', whiteSpace: 'pre', fontFamily: 'monospace' }}>
                        {JSON.stringify(decision, null, 2)}
                      </pre>
                    </details>
                  ) : (
                    <p className="text-xs mb-2" style={{ color: '#8a96a8', fontFamily: 'Inter' }}>{String(decision)}</p>
                  )}
                  <span className="text-xs font-semibold" style={{ color: '#22c55e', fontFamily: 'Manrope' }}>→ Complété</span>
                </div>
              </div>
            ))
          ) : (
            // Fallback avec données pipeline si pas de decision_trace
            [
              { agent: 'Pipeline', decision: result.pipeline?.status || 'Complété', rationale: `Intent : "${result.intent || 'Non disponible'}"` },
              { agent: 'Backtest', decision: result.backtest?.status || 'N/A', rationale: result.backtest?.error || 'Exécuté' },
            ].map((item, index, arr) => {
              const isFallback = item.decision === 'FALLBACK';
              const accent = isFallback ? '#FAC775' : '#7b39fc';
              const statusColor = isFallback ? '#FAC775' : '#22c55e';
              return (
                <div key={item.agent} className="flex gap-4 mb-4 last:mb-0">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
                      style={{ background: accent, boxShadow: `0 0 8px ${accent}99` }} />
                    {index < arr.length - 1 && (
                      <div className="w-px flex-1 mt-1" style={{ background: 'linear-gradient(180deg, rgba(123,57,252,0.4), rgba(6,182,212,0.2))' }} />
                    )}
                  </div>
                  <div className="flex-1 rounded-xl p-4 mb-2"
                    style={{ background: 'rgba(123,57,252,0.05)', border: '1px solid rgba(123,57,252,0.12)' }}>
                    <p className="text-sm font-medium text-white mb-1" style={{ fontFamily: 'Manrope' }}>{item.agent}</p>
                    <p className="text-xs mb-2" style={{ color: '#8a96a8', fontFamily: 'Inter' }}>{item.rationale}</p>
                    <span className="text-xs font-semibold" style={{ color: statusColor, fontFamily: 'Manrope' }}>→ {item.decision}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <style jsx>{`
        .audit-details > summary {
          list-style: none;
        }
        .audit-details > summary::-webkit-details-marker {
          display: none;
        }
        .audit-toggle::after {
          content: '▸ voir plus';
        }
        .audit-details[open] > summary .audit-toggle::after {
          content: '▾ replier';
        }
      `}</style>
    </div>
  );
}
