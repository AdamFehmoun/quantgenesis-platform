'use client';
import { ScrollText, Lightbulb, ClipboardList, Boxes, ShieldAlert, ShieldCheck, Bot } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { BacktestResult } from '../app/page';

interface AuditTrailProps {
  result: BacktestResult;
}

interface KeyDecision {
  decision: string;
  made_by: string;
  rationale: string;
}

// Icône par agent (matching tolérant sur le nom).
function agentIcon(name: string): LucideIcon {
  const n = name.toLowerCase();
  if (n.includes('brainstorm')) return Lightbulb;
  if (n.includes('chef') || n.includes('projet')) return ClipboardList;
  if (n.includes('architect')) return Boxes;
  if (n.includes('critique') || n.includes('risk')) return ShieldAlert;
  if (n.includes('conform') || n.includes('compliance')) return ShieldCheck;
  return Bot;
}

// Extraction sûre de key_decisions depuis decision_trace (typage backend lâche).
function extractKeyDecisions(trace: Record<string, unknown> | undefined): KeyDecision[] {
  const raw = trace?.key_decisions;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((d): d is Record<string, unknown> => typeof d === 'object' && d !== null)
    .map((d) => ({
      decision: typeof d.decision === 'string' ? d.decision : '',
      made_by: typeof d.made_by === 'string' ? d.made_by : 'Agent',
      rationale: typeof d.rationale === 'string' ? d.rationale : '',
    }))
    .filter((d) => d.decision || d.rationale);
}

export default function AuditTrail({ result }: AuditTrailProps) {
  const decisionTrace = result.compliance_log?.decision_trace;
  const pipelineStart = result.pipeline?.pipeline_start
    ? new Date(result.pipeline.pipeline_start).toLocaleTimeString('fr-FR')
    : null;

  const keyDecisions = extractKeyDecisions(decisionTrace);
  const hasNarrative = keyDecisions.length > 0;

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)', boxShadow: '0 10px 40px rgba(0,0,0,0.35)' }}>

      <div className="px-6 py-4 flex items-center gap-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(123,57,252,0.05)' }}>
        <span className="flex-none w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(123,57,252,0.14)', border: '1px solid rgba(123,57,252,0.3)' }}>
          <ScrollText size={16} color="#a78bfa" strokeWidth={2} />
        </span>
        <span className="text-sm font-semibold text-white" style={{ fontFamily: 'Manrope' }}>Audit Trail</span>
        <span className="text-xs" style={{ color: 'rgba(244,243,248,0.5)', fontFamily: 'Inter' }}>
          Décisions agents IA — traçabilité complète
          {pipelineStart && ` · Démarré à ${pipelineStart}`}
        </span>
      </div>

      <div className="p-6">
        <div className="relative">
          {hasNarrative ? (
            keyDecisions.map((kd, index) => {
              const Icon = agentIcon(kd.made_by);
              const isLast = index === keyDecisions.length - 1;
              return (
                <div key={`${kd.made_by}-${index}`} className="flex gap-4 mb-5 last:mb-0">
                  {/* Rail vertical avec puce dégradée + icône agent */}
                  <div className="flex flex-col items-center">
                    <span className="flex-none w-9 h-9 rounded-full flex items-center justify-center"
                      style={{
                        background: 'rgba(123,57,252,0.14)',
                        border: '1px solid rgba(123,57,252,0.4)',
                        boxShadow: '0 0 14px rgba(6,182,212,0.35)',
                      }}>
                      <Icon size={16} color="#a78bfa" strokeWidth={2} />
                    </span>
                    {!isLast && (
                      <div className="w-px flex-1 mt-1" style={{ background: 'linear-gradient(180deg, rgba(123,57,252,0.5), rgba(6,182,212,0.15))' }} />
                    )}
                  </div>

                  {/* Carte narrative */}
                  <div className="flex-1 rounded-xl p-4 mb-1"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[0.65rem] uppercase px-2 py-0.5 rounded-full font-semibold"
                        style={{ color: '#06B6D4', background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.25)', letterSpacing: '0.08em', fontFamily: 'Manrope' }}>
                        {kd.made_by}
                      </span>
                    </div>
                    {kd.decision && (
                      <p className="text-sm font-medium text-white mb-2 leading-snug" style={{ fontFamily: 'Manrope' }}>
                        {kd.decision}
                      </p>
                    )}
                    {kd.rationale && (
                      <p className="text-xs leading-relaxed" style={{ color: 'rgba(244,243,248,0.6)', fontFamily: 'Inter' }}>
                        <span style={{ color: 'rgba(167,139,250,0.85)', fontWeight: 600 }}>Pourquoi · </span>
                        {kd.rationale}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            // Fallback propre si decision_trace.key_decisions est absent ou vide.
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
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <p className="text-sm font-medium text-white mb-1" style={{ fontFamily: 'Manrope' }}>{item.agent}</p>
                    <p className="text-xs mb-2" style={{ color: 'rgba(244,243,248,0.55)', fontFamily: 'Inter' }}>{item.rationale}</p>
                    <span className="text-xs font-semibold" style={{ color: statusColor, fontFamily: 'Manrope' }}>→ {item.decision}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Détail brut optionnel — conservé pour la traçabilité complète. */}
        {decisionTrace && (
          <details className="audit-details mt-5">
            <summary className="text-xs" style={{ color: 'rgba(244,243,248,0.45)', cursor: 'pointer', fontFamily: 'Inter' }}>
              <span className="audit-toggle" style={{ color: '#06B6D4', fontWeight: 600 }} />
            </summary>
            <pre className="text-xs mt-2 p-3 rounded-lg"
              style={{ color: 'rgba(244,243,248,0.6)', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', overflowX: 'auto', whiteSpace: 'pre', fontFamily: 'monospace' }}>
              {JSON.stringify(decisionTrace, null, 2)}
            </pre>
          </details>
        )}
      </div>

      <style jsx>{`
        .audit-details > summary {
          list-style: none;
        }
        .audit-details > summary::-webkit-details-marker {
          display: none;
        }
        .audit-toggle::after {
          content: '▸ voir le JSON brut';
        }
        .audit-details[open] > summary .audit-toggle::after {
          content: '▾ replier le JSON';
        }
      `}</style>
    </div>
  );
}
