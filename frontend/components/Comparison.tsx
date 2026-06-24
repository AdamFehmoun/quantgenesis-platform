'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Shield, Flame, GitCompare, Loader2, AlertTriangle, Sparkles, RotateCcw } from 'lucide-react';
import type { BacktestResult } from '../app/page';

// ============================================================================
// VUE COMPARATIVE « Prudent vs Agressif » — écran SÉPARÉ, autonome.
// N'utilise AUCUN état du flux principal : il fait ses propres appels à la même
// API (POST /api/pipeline/run) et s'affiche en overlay. Si quelque chose casse
// ici, la démo normale (onboarding/lancement/résultats) reste intacte.
// ============================================================================

const API_URL = 'https://quantgenesis-platform-production.up.railway.app/api/pipeline/run';
const INTENT_PRUDENT = 'stratégie RSI prudente long terme sur Bitcoin';
const INTENT_AGRESSIF = 'stratégie RSI agressive court terme sur Bitcoin';

interface ComparisonProps {
  onClose: () => void;
}

type RunOutcome = { ok: true; data: BacktestResult } | { ok: false; error: string };

// Même contrat que le flux existant (POST { intent }).
async function runIntent(intent: string): Promise<RunOutcome> {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent }),
    });
    if (!res.ok) return { ok: false, error: `Erreur ${res.status}` };
    const data = (await res.json()) as BacktestResult;
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'Connexion impossible' };
  }
}

// Défensif (cf. lib/metrics.ts) : null/undefined/NaN en FALLBACK/ERROR → "—".
type MetricKind = 'return' | 'ratio' | 'drawdown' | 'winrate';
function metricDisplay(v: number | null | undefined, kind: MetricKind): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  if (kind === 'return') return `${v >= 0 ? '+' : ''}${v}%`;
  if (kind === 'drawdown') return `-${Math.abs(v)}%`;
  if (kind === 'winrate') return `${v}%`;
  return `${v}`;
}

function isFallback(r: BacktestResult): boolean {
  return r.backtest?.status === 'FALLBACK' || r.status === 'FALLBACK';
}

interface SideTheme {
  key: 'prudent' | 'agressif';
  title: string;
  Icon: typeof Shield;
  intent: string;
  accent: string;
  accent2: string;
  tint: string;
  border: string;
  glow: string;
}

const SIDES: SideTheme[] = [
  {
    key: 'prudent', title: 'PRUDENT', Icon: Shield, intent: INTENT_PRUDENT,
    accent: '#22c55e', accent2: '#06B6D4', tint: 'rgba(34,197,94,0.07)',
    border: 'rgba(34,197,94,0.4)', glow: 'rgba(34,197,94,0.2)',
  },
  {
    key: 'agressif', title: 'AGRESSIF', Icon: Flame, intent: INTENT_AGRESSIF,
    accent: '#fb923c', accent2: '#F87171', tint: 'rgba(251,146,60,0.07)',
    border: 'rgba(251,146,60,0.4)', glow: 'rgba(251,146,60,0.2)',
  },
];

const METRIC_DEFS: { label: string; kind: MetricKind; pick: (m: BacktestResult['metrics']) => number | null | undefined }[] = [
  { label: 'Total Return', kind: 'return', pick: (m) => m.total_return_pct },
  { label: 'Sharpe', kind: 'ratio', pick: (m) => m.sharpe_ratio },
  { label: 'Max Drawdown', kind: 'drawdown', pick: (m) => m.max_drawdown_pct },
  { label: 'Win Rate', kind: 'winrate', pick: (m) => m.win_rate_pct },
];

// Lignes de code : surligne celles ABSENTES de l'autre stratégie (diff simple
// par appartenance, robuste aux décalages de lignes). Pas d'algo de diff lourd.
function CodeLines({ code, otherTrims, accent }: { code: string; otherTrims: Set<string>; accent: string }) {
  const lines = code.split('\n');
  return (
    <div style={{ fontFamily: 'monospace', fontSize: 12, lineHeight: 1.55 }}>
      {lines.map((ln, i) => {
        const t = ln.trim();
        const diff = t !== '' && !otherTrims.has(t);
        return (
          <div key={i} style={{
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            padding: '1px 8px',
            background: diff ? `${accent}22` : 'transparent',
            borderLeft: diff ? `2px solid ${accent}` : '2px solid transparent',
            color: diff ? '#fff' : 'rgba(244,243,248,0.55)',
          }}>{ln || ' '}</div>
        );
      })}
    </div>
  );
}

export default function Comparison({ onClose }: ComparisonProps) {
  const [loading, setLoading] = useState(true);
  const [prudent, setPrudent] = useState<RunOutcome | null>(null);
  const [agressif, setAgressif] = useState<RunOutcome | null>(null);
  const runRef = useRef(0);

  const runBoth = useCallback(() => {
    const myRun = ++runRef.current;
    setLoading(true);
    setPrudent(null);
    setAgressif(null);
    Promise.all([runIntent(INTENT_PRUDENT), runIntent(INTENT_AGRESSIF)]).then(([p, a]) => {
      if (runRef.current !== myRun) return; // run obsolète (re-lancé ou fermé)
      setPrudent(p);
      setAgressif(a);
      setLoading(false);
    });
  }, []);

  useEffect(() => { runBoth(); }, [runBoth]);

  // Échap pour fermer ; invalide tout run en vol au démontage.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { runRef.current++; window.removeEventListener('keydown', onKey); };
  }, [onClose]);

  const outcomes: Record<'prudent' | 'agressif', RunOutcome | null> = { prudent, agressif };

  // Diff : ensembles de lignes (trimmed) de chaque côté quand le code est dispo.
  const codeP = prudent?.ok ? (prudent.data.backtest?.generated_code ?? '') : '';
  const codeA = agressif?.ok ? (agressif.data.backtest?.generated_code ?? '') : '';
  const trimsP = new Set(codeP.split('\n').map((l) => l.trim()));
  const trimsA = new Set(codeA.split('\n').map((l) => l.trim()));

  return (
    <div className="fixed inset-0 overflow-y-auto" style={{ zIndex: 100, background: '#060810', color: '#f4f3f8', fontFamily: 'Inter, sans-serif' }}>
      {/* Glows d'ambiance */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div style={{ position: 'absolute', top: '-15%', left: '-8%', width: '560px', height: '560px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(34,197,94,0.10) 0%, transparent 66%)', filter: 'blur(50px)' }} />
        <div style={{ position: 'absolute', bottom: '-15%', right: '-8%', width: '560px', height: '560px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(251,146,60,0.10) 0%, transparent 66%)', filter: 'blur(60px)' }} />
      </div>

      {/* Top bar */}
      <nav className="sticky top-0 z-50 px-6 md:px-10 py-4 flex items-center justify-between"
        style={{ background: 'rgba(6,8,16,0.72)', backdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(123,57,252,0.15)' }}>
        <div className="flex items-center gap-3">
          <span className="flex-none w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(123,57,252,0.16)', border: '1px solid rgba(123,57,252,0.35)' }}>
            <GitCompare size={17} color="#a78bfa" strokeWidth={2} />
          </span>
          <div>
            <p className="font-bold text-white leading-tight" style={{ fontFamily: 'Manrope', fontSize: '1.05rem' }}>Prudent <span style={{ color: 'rgba(244,243,248,0.4)' }}>vs</span> Agressif</p>
            <p className="text-[0.7rem]" style={{ color: 'rgba(244,243,248,0.5)', fontFamily: 'Inter' }}>Même idée, profils opposés — la preuve du sur-mesure</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!loading && (
            <button onClick={runBoth} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-all hover:text-white"
              style={{ color: 'rgba(244,243,248,0.55)', border: '1px solid rgba(255,255,255,0.12)', fontFamily: 'Manrope' }}>
              <RotateCcw size={13} strokeWidth={2} /> Relancer
            </button>
          )}
          <button onClick={onClose} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-semibold transition-all hover:scale-105"
            style={{ background: 'rgba(123,57,252,0.18)', color: '#c4b5fd', border: '1px solid rgba(123,57,252,0.4)', fontFamily: 'Manrope' }}>
            <X size={14} strokeWidth={2.5} /> Fermer
          </button>
        </div>
      </nav>

      <div className="relative z-10 max-w-6xl mx-auto px-5 md:px-8 py-10">

        {/* ÉTAT DE CHARGEMENT */}
        {loading ? (
          <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: '60vh' }}>
            <Loader2 size={44} color="#a78bfa" strokeWidth={2} className="animate-spin" />
            <p className="mt-6 font-bold text-white" style={{ fontFamily: 'Manrope', fontSize: 'clamp(1.3rem,2.6vw,1.9rem)', letterSpacing: '-0.02em' }}>
              Génération des deux stratégies…
            </p>
            <p className="mt-2" style={{ color: 'rgba(244,243,248,0.55)', fontFamily: 'Inter', fontSize: '0.95rem' }}>
              Le même type de stratégie, deux profils de risque opposés.
            </p>
            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              {SIDES.map((s) => {
                const Icon = s.Icon;
                return (
                  <div key={s.key} className="flex items-center gap-2.5 rounded-xl" style={{ padding: '10px 16px', background: s.tint, border: `1px solid ${s.border}` }}>
                    <Icon size={16} color={s.accent} strokeWidth={2} />
                    <span style={{ fontFamily: 'Inter', fontSize: '0.85rem', color: 'rgba(244,243,248,0.8)' }}>{s.intent}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            {/* MÉTRIQUES EN REGARD + CODE, CÔTE À CÔTE */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {SIDES.map((s) => {
                const Icon = s.Icon;
                const outcome = outcomes[s.key];
                const otherTrims = s.key === 'prudent' ? trimsA : trimsP;
                const code = outcome?.ok ? (outcome.data.backtest?.generated_code ?? '') : '';

                return (
                  <div key={s.key} className="rounded-2xl overflow-hidden flex flex-col"
                    style={{ background: s.tint, border: `1px solid ${s.border}`, backdropFilter: 'blur(20px)', boxShadow: `0 10px 40px rgba(0,0,0,0.35), 0 0 30px ${s.glow}` }}>

                    {/* En-tête de colonne */}
                    <div className="px-6 py-5 flex items-center gap-3 relative overflow-hidden" style={{ borderBottom: `1px solid ${s.border}` }}>
                      <div className="absolute pointer-events-none" style={{ top: '-60%', right: '-10%', width: '220px', height: '220px', borderRadius: '50%', background: `radial-gradient(circle, ${s.glow} 0%, transparent 70%)`, filter: 'blur(16px)' }} />
                      <span className="relative flex-none w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${s.accent}24`, border: `1px solid ${s.accent}66` }}>
                        <Icon size={22} color={s.accent} strokeWidth={2} />
                      </span>
                      <div className="relative">
                        <p className="font-bold leading-none" style={{ color: s.accent, fontFamily: 'Manrope', fontSize: 'clamp(1.5rem,3vw,2rem)', letterSpacing: '0.04em' }}>{s.title}</p>
                        <p className="mt-1.5" style={{ color: 'rgba(244,243,248,0.6)', fontFamily: 'Inter', fontSize: '0.8rem' }}>{s.intent}</p>
                      </div>
                    </div>

                    {outcome && !outcome.ok ? (
                      // Échec réseau de CE côté (l'autre peut réussir)
                      <div className="p-6 flex items-center gap-3" style={{ color: '#F87171' }}>
                        <AlertTriangle size={18} strokeWidth={2} className="flex-none" />
                        <span style={{ fontFamily: 'Inter', fontSize: '0.9rem' }}>Échec du chargement — {outcome.error}.</span>
                      </div>
                    ) : outcome && outcome.ok ? (
                      <>
                        {isFallback(outcome.data) && (
                          <div className="mx-6 mt-5 p-3 rounded-xl text-xs flex items-center gap-2"
                            style={{ background: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.3)', color: '#FAC775', fontFamily: 'Inter' }}>
                            <AlertTriangle size={14} strokeWidth={2} className="flex-none" />
                            Stratégie de secours (FALLBACK) — métriques partielles.
                          </div>
                        )}

                        {/* Métriques (mêmes 4, même ordre → comparaison d'un coup d'œil) */}
                        <div className="px-6 pt-5 grid grid-cols-2 gap-3">
                          {METRIC_DEFS.map((md) => {
                            const raw = md.pick(outcome.data.metrics);
                            const text = metricDisplay(raw, md.kind);
                            const finite = typeof raw === 'number' && Number.isFinite(raw);
                            const isReturn = md.kind === 'return';
                            const valColor = !finite ? '#9aa7b8'
                              : isReturn ? (raw! >= 0 ? '#22c55e' : '#F87171')
                              : '#f4f3f8';
                            return (
                              <div key={md.label} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                                <p className="text-[0.7rem] uppercase mb-1.5" style={{ color: 'rgba(244,243,248,0.5)', fontFamily: 'Manrope', letterSpacing: '0.1em' }}>{md.label}</p>
                                <p className="font-bold" style={{ color: valColor, fontFamily: 'Manrope', fontSize: isReturn ? 'clamp(1.8rem,4vw,2.6rem)' : 'clamp(1.3rem,2.6vw,1.7rem)', letterSpacing: '-0.02em' }}>{text}</p>
                              </div>
                            );
                          })}
                        </div>

                        {/* Code Python généré (scrollable), diffs surlignés */}
                        <div className="px-6 pt-5 pb-6 flex-1 flex flex-col min-h-0">
                          <p className="text-[0.7rem] uppercase mb-2" style={{ color: s.accent, fontFamily: 'Manrope', letterSpacing: '0.18em' }}>Code Python généré</p>
                          <div className="rounded-xl overflow-auto" style={{ background: 'rgba(0,0,0,0.38)', border: '1px solid rgba(255,255,255,0.08)', maxHeight: 360 }}>
                            {code
                              ? <CodeLines code={code} otherTrims={otherTrims} accent={s.accent} />
                              : <p className="p-4 text-xs" style={{ color: 'rgba(244,243,248,0.5)', fontFamily: 'monospace' }}># Code non disponible pour cette stratégie</p>}
                          </div>
                        </div>
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {/* Légende du surlignage */}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-xs" style={{ color: 'rgba(244,243,248,0.55)', fontFamily: 'Inter' }}>
              <span className="flex items-center gap-2">
                <span className="inline-block w-4 h-3 rounded-sm" style={{ background: 'rgba(34,197,94,0.22)', borderLeft: '2px solid #22c55e' }} /> lignes propres au PRUDENT
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block w-4 h-3 rounded-sm" style={{ background: 'rgba(251,146,60,0.22)', borderLeft: '2px solid #fb923c' }} /> lignes propres à l’AGRESSIF
              </span>
            </div>

            {/* MESSAGE CLÉ */}
            <div className="mt-7 rounded-2xl p-6 text-center relative overflow-hidden"
              style={{ background: 'linear-gradient(120deg, rgba(34,197,94,0.08), rgba(123,57,252,0.08), rgba(251,146,60,0.08))', border: '1px solid rgba(123,57,252,0.25)' }}>
              <div className="flex items-center justify-center gap-2 mb-2">
                <Sparkles size={18} color="#a78bfa" strokeWidth={2} />
              </div>
              <p className="font-bold text-white" style={{ fontFamily: 'Manrope', fontSize: 'clamp(1.1rem,2.4vw,1.6rem)', letterSpacing: '-0.02em', lineHeight: 1.3 }}>
                Même idée, profils opposés → l’IA a généré deux stratégies différentes.
              </p>
              <p className="mt-2" style={{ color: '#c4b5fd', fontFamily: 'Manrope', fontSize: 'clamp(1rem,2vw,1.3rem)', fontWeight: 600 }}>
                C’est ça, le sur-mesure.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
