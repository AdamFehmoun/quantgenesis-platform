'use client';
import type { LucideIcon } from 'lucide-react';

// Écran « Attente » (loading plein écran) — design QuantClarity Attente.dc.html,
// adapté au thème de l'app. PUREMENT présentationnel : il est piloté par l'état
// RÉEL de Chat (cadence des 6 agents existants), il ne lance ni n'anime rien
// lui-même. L'animation inline de Chat reste intacte sous l'overlay.

export interface WaitingAgent { name: string; color: string; Icon: LucideIcon }

interface WaitingProps {
  agents: WaitingAgent[];
  activeIndex: number;  // index de l'agent en cours (0..n-1)
  doneCount: number;    // nombre d'agents terminés
  finalizing: boolean;  // animation finie mais backtest pas encore revenu
}

// Phrases d'ambiance par agent (ordre = AGENTS de Chat).
const PHRASES = [
  "J'évalue la faisabilité de votre idée…",
  'Je cadre les objectifs de la stratégie…',
  "Je conçois les signaux d'entrée et de sortie…",
  'Je génère le code Python et prépare le backtest…',
  'Je génère le log de traçabilité (AI Act)…',
  "J'audite la logique et je traque les biais…",
];

// Révélations « en direct » dévoilées au fil de l'avancement (spectacle).
const REVEALS = [
  'Faisabilité confirmée',
  'Objectifs de la stratégie cadrés',
  "Signaux d'entrée / sortie conçus",
  'Indicateurs sélectionnés',
  'Code Python généré',
  'Backtest lancé sur données historiques',
  'Log de traçabilité généré (AI Act)',
  'Décisions horodatées',
  'Filtre anti-biais activé',
  'Sur-apprentissage : écarté',
];

export default function Waiting({ agents, activeIndex, doneCount, finalizing }: WaitingProps) {
  const total = agents.length;
  const allDone = doneCount >= total;
  const pct = allDone ? (finalizing ? 96 : 100) : Math.round((doneCount / total) * 100);
  const deg = (pct / 100) * 360;
  const cur = Math.min(Math.max(activeIndex, 0), total - 1);

  const activeNum = allDone ? (finalizing ? '…' : '✓') : String(cur + 1);
  const activeName = allDone
    ? (finalizing ? 'Finalisation du backtest' : 'Analyse terminée')
    : agents[cur]?.name;
  const activePhrase = allDone
    ? (finalizing ? 'Exécution du backtest sur les données historiques…' : 'Votre stratégie est prête — affichage des résultats.')
    : PHRASES[cur] ?? 'Traitement en cours…';

  // Révélations visibles : proportionnelles à l'avancement, on garde les 5 dernières.
  const shownCount = Math.min(REVEALS.length, Math.round((pct / 100) * REVEALS.length));
  const tail = REVEALS.slice(0, shownCount).slice(-5);

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden" style={{ background: '#060810', color: '#f4f3f8', fontFamily: 'Inter, sans-serif' }}>
      {/* Bloom de fond qui s'intensifie avec l'avancement */}
      <div className="fixed pointer-events-none z-0" style={{
        top: '46%', left: '50%', width: 'min(150vh, 1400px)', height: 'min(150vh, 1400px)',
        transform: `translate(-50%,-50%) scale(${0.5 + (pct / 100) * 0.6})`,
        opacity: 0.12 + (pct / 100) * 0.8,
        transition: 'opacity 0.8s ease, transform 0.8s ease',
      }}>
        <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(123,57,252,0.4) 0%, rgba(123,57,252,0.2) 26%, rgba(6,182,212,0.12) 46%, transparent 68%)', filter: 'blur(12px)' }} />
      </div>

      {/* Barre de progression haute */}
      <div className="absolute top-0 left-0 right-0 z-10" style={{ height: '5px', background: 'rgba(255,255,255,0.05)' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#7b39fc,#06B6D4)', boxShadow: '0 0 16px rgba(6,182,212,0.7)', transition: 'width 0.5s ease' }} />
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-8 md:px-12 pt-8 pb-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#7b39fc,#06B6D4)', boxShadow: '0 4px 18px rgba(123,57,252,0.5)' }}>
            <span className="text-white font-bold text-sm" style={{ fontFamily: 'Manrope' }}>Q</span>
          </div>
          <span className="font-bold text-white text-lg" style={{ fontFamily: 'Manrope' }}>
            Quant<span style={{ color: '#7b39fc' }}>Clarity</span>
          </span>
        </div>
        <div className="flex items-baseline gap-4">
          <span style={{ fontFamily: 'Manrope', fontWeight: 600, fontSize: 'clamp(1rem,1.8vw,1.4rem)', letterSpacing: '0.1em' }}>
            {allDone ? (finalizing ? 'FINALISATION' : 'TERMINÉ') : `ÉTAPE ${cur + 1} / ${total}`}
          </span>
          <span style={{ fontFamily: 'Manrope', fontSize: '0.9rem', letterSpacing: '0.08em', color: '#06B6D4' }}>{pct}%</span>
        </div>
      </div>

      {/* Corps : orbe agent actif + révélations */}
      <div className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-8 px-8 md:px-12 py-4 min-h-0">

        {/* Agent actif */}
        <div className="flex flex-col items-center justify-center text-center">
          <div className="relative" style={{ width: 'clamp(170px,18vw,260px)', height: 'clamp(170px,18vw,260px)' }}>
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: `conic-gradient(from -90deg, #06B6D4 0deg, #7b39fc ${deg}deg, rgba(255,255,255,0.07) ${deg}deg 360deg)`, transition: 'background 0.5s ease' }} />
            <div className="absolute flex items-center justify-center" style={{ inset: '12px', borderRadius: '50%', background: '#0a0d17', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 0 50px rgba(123,57,252,0.45), 0 0 110px rgba(6,182,212,0.25)' }}>
              <span style={{ fontFamily: 'Manrope', fontWeight: 600, fontSize: 'clamp(3rem,5.5vw,5rem)', background: 'linear-gradient(135deg,#c9b6ff,#22d3ee)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {activeNum}
              </span>
            </div>
          </div>
          <div className="mt-8 font-bold" style={{ fontFamily: 'Manrope', fontSize: 'clamp(2rem,4vw,3.4rem)', letterSpacing: '-0.03em', lineHeight: 1.02 }}>{activeName}</div>
          <div className="mt-3 max-w-xl" style={{ color: 'rgba(244,243,248,0.72)', fontFamily: 'Inter', fontSize: 'clamp(1rem,1.8vw,1.4rem)', lineHeight: 1.4 }}>{activePhrase}</div>
        </div>

        {/* Révélations en direct */}
        <div className="flex flex-col justify-center min-h-0">
          <div className="rounded-2xl" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)', padding: '24px 26px' }}>
            <span className="uppercase" style={{ fontFamily: 'Manrope', fontSize: '0.78rem', letterSpacing: '0.22em', color: '#06B6D4' }}>Révélations en direct</span>
            <div className="mt-5 flex flex-col gap-4">
              {tail.length === 0 && (
                <span style={{ color: 'rgba(244,243,248,0.4)', fontFamily: 'Inter', fontSize: '0.95rem' }}>Initialisation du pipeline…</span>
              )}
              {tail.map((r, i) => {
                const fromNew = tail.length - 1 - i;
                const op = Math.max(0.32, 1 - fromNew * 0.2);
                return (
                  <div key={r} className="flex items-center gap-3.5 animate-fade-slide" style={{ opacity: op, color: fromNew === 0 ? '#f4f3f8' : 'rgba(244,243,248,0.85)' }}>
                    <span className="flex-none rounded-full" style={{ width: '9px', height: '9px', background: 'linear-gradient(135deg,#7b39fc,#06B6D4)', boxShadow: '0 0 12px rgba(6,182,212,0.8)' }} />
                    <span style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 'clamp(1rem,1.5vw,1.3rem)', lineHeight: 1.3 }}>{r}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Stepper des 6 agents */}
      <div className="relative z-10 px-8 md:px-14 pt-2 pb-10">
        <div className="relative flex justify-between items-start">
          <div className="absolute" style={{ top: '22px', left: '22px', right: '22px', height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px' }} />
          <div className="absolute" style={{ top: '22px', left: '22px', height: '3px', width: `${(pct / 100) * 100}%`, maxWidth: 'calc(100% - 44px)', background: 'linear-gradient(90deg,#7b39fc,#06B6D4)', borderRadius: '2px', boxShadow: '0 0 14px rgba(6,182,212,0.6)', transition: 'width 0.5s ease' }} />
          {agents.map((a, i) => {
            const state = allDone || i < cur ? 'done' : i === cur ? 'active' : 'up';
            const Icon = a.Icon;
            const node = state === 'active'
              ? { w: '48px', bg: 'linear-gradient(135deg,#7b39fc,#06B6D4)', border: '1px solid rgba(255,255,255,0.4)', shadow: '0 0 26px rgba(123,57,252,0.85),0 0 50px rgba(6,182,212,0.4)', icon: '#fff' }
              : state === 'done'
                ? { w: '46px', bg: 'rgba(6,182,212,0.14)', border: '1px solid rgba(6,182,212,0.55)', shadow: 'none', icon: '#06B6D4' }
                : { w: '46px', bg: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', shadow: 'none', icon: 'rgba(244,243,248,0.32)' };
            return (
              <div key={a.name} className="relative z-10 flex flex-col items-center gap-3" style={{ width: `${100 / total}%` }}>
                <div className="flex items-center justify-center rounded-full" style={{ width: node.w, height: node.w, background: node.bg, border: node.border, boxShadow: node.shadow, transition: 'all 0.4s ease' }}>
                  <Icon size={state === 'active' ? 20 : 18} color={node.icon} strokeWidth={2} />
                </div>
                <span className="text-center" style={{ fontFamily: 'Manrope', fontSize: 'clamp(0.7rem,1.1vw,0.9rem)', fontWeight: state === 'active' ? 700 : 500, color: state === 'active' ? '#f4f3f8' : state === 'done' ? 'rgba(244,243,248,0.62)' : 'rgba(244,243,248,0.3)' }}>
                  {a.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
