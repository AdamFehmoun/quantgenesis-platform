'use client';
import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';

// Écran « Attente » plein écran pendant un vrai run du pipeline.
// AUTO-ANIMÉ : il tourne en boucle continue TANT QU'IL EST MONTÉ, sans aucune
// durée codée en dur. Il est monté par Chat quand loading=true et démonté dès
// que le résultat arrive (loading=false) → coupe instantanée, qu'on soit à 0,3s
// (cache HIT) ou 2min30 (run réel). Tous les intervals sont nettoyés au démontage.

export interface WaitingAgent { name: string; color: string; Icon: LucideIcon }
interface WaitingProps { agents: WaitingAgent[] }

// Phrase d'ambiance par agent (ordre = AGENTS de Chat, 5 agents LLM).
const PHRASES = [
  "J'évalue la faisabilité de votre idée…",
  'Je cadre les objectifs de la stratégie…',
  "Je conçois les signaux d'entrée et de sortie…",
  'Je vérifie la conformité (AI Act, Article 12)…',
  "J'audite la logique et je traque les biais…",
];

// Flux de micro-révélations qui défile EN BOUCLE (modulo) — jamais épuisé.
const REVEAL_POOL = [
  'Analyse de faisabilité…',
  "Conception des signaux d'entrée…",
  'Calibrage du risque…',
  'Génération du code VectorBT…',
  'Backtest sur données réelles…',
  'Validation anti-biais…',
  'Détection de sur-apprentissage…',
  'Vérification conformité AI Act…',
  'Horodatage des décisions…',
  'Optimisation des paramètres…',
  'Calcul des métriques…',
  'Agrégation des résultats…',
];

// Cadences (aucune ne borne la durée totale — tout boucle indéfiniment).
const AGENT_CADENCE = 2200;   // ms : l'agent actif avance d'un cran
const REVEAL_CADENCE = 2500;  // ms : une nouvelle micro-révélation apparaît
const PROGRESS_TICK = 250;    // ms : pas de la progression asymptotique
const PROGRESS_TAU = 35;      // s : constante de temps (approche ~94 % sans l'atteindre)
const PROGRESS_CAP = 94;      // % : plafond jamais franchi tant que le résultat n'est pas là

// Particules de lumière (positions déterministes → pas de souci d'hydratation).
const PARTICLES = [
  { left: 8, size: 4, dur: 9, delay: 0 },
  { left: 22, size: 3, dur: 11, delay: 1.5 },
  { left: 35, size: 5, dur: 8, delay: 3 },
  { left: 48, size: 3, dur: 12, delay: 0.8 },
  { left: 61, size: 4, dur: 10, delay: 2.2 },
  { left: 73, size: 3, dur: 13, delay: 4 },
  { left: 86, size: 5, dur: 9, delay: 1 },
  { left: 94, size: 3, dur: 11, delay: 3.5 },
];

export default function Waiting({ agents }: WaitingProps) {
  const total = agents.length || 5;
  const [activeIndex, setActiveIndex] = useState(0);
  const [reveals, setReveals] = useState<{ id: number; text: string }[]>([]);
  const [elapsed, setElapsed] = useState(0); // secondes écoulées (pour la progression)

  // Boucles d'animation — démarrées une seule fois (clé = `total`, constant à 6),
  // TOUTES nettoyées au démontage. Le démontage survient dès loading=false.
  useEffect(() => {
    let revealCounter = 0;
    setActiveIndex(0);
    setElapsed(0);
    setReveals([{ id: 0, text: REVEAL_POOL[0] }]);

    const agentIv = setInterval(() => {
      setActiveIndex((i) => (i + 1) % total); // boucle continue, ne se fige jamais
    }, AGENT_CADENCE);

    const revealIv = setInterval(() => {
      revealCounter += 1;
      const text = REVEAL_POOL[revealCounter % REVEAL_POOL.length]; // boucle modulo
      setReveals((prev) => [...prev, { id: revealCounter, text }].slice(-5));
    }, REVEAL_CADENCE);

    const progressIv = setInterval(() => {
      setElapsed((e) => e + PROGRESS_TICK / 1000);
    }, PROGRESS_TICK);

    return () => {
      clearInterval(agentIv);
      clearInterval(revealIv);
      clearInterval(progressIv);
    };
  }, [total]);

  // Progression asymptotique : approche PROGRESS_CAP sans jamais l'atteindre.
  const pct = Math.min(PROGRESS_CAP, Math.round((1 - Math.exp(-elapsed / PROGRESS_TAU)) * PROGRESS_CAP));
  const cur = activeIndex % total;
  const sweepFill = ((cur + 1) / total) * 100; // remplissage du stepper (balaie en boucle)

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden" style={{ background: '#060810', color: '#f4f3f8', fontFamily: 'Inter, sans-serif' }}>
      {/* Bloom de fond qui respire en continu */}
      <div className="fixed pointer-events-none z-0 waiting-breathe" style={{
        top: '46%', left: '50%', width: 'min(150vh, 1400px)', height: 'min(150vh, 1400px)',
      }}>
        <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(123,57,252,0.4) 0%, rgba(123,57,252,0.2) 26%, rgba(6,182,212,0.12) 46%, transparent 68%)', filter: 'blur(12px)' }} />
      </div>

      {/* Particules de lumière qui montent en continu */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        {PARTICLES.map((p, i) => (
          <span key={i} className="waiting-particle absolute rounded-full" style={{
            left: `${p.left}%`, bottom: '12%', width: `${p.size}px`, height: `${p.size}px`,
            background: i % 2 === 0 ? 'rgba(123,57,252,0.8)' : 'rgba(6,182,212,0.8)',
            boxShadow: i % 2 === 0 ? '0 0 8px rgba(123,57,252,0.9)' : '0 0 8px rgba(6,182,212,0.9)',
            animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s`,
          }} />
        ))}
      </div>

      {/* Barre de progression haute — asymptotique, jamais bloquée à 100 % */}
      <div className="absolute top-0 left-0 right-0 z-10" style={{ height: '5px', background: 'rgba(255,255,255,0.05)' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#7b39fc,#06B6D4)', boxShadow: '0 0 16px rgba(6,182,212,0.7)', transition: 'width 0.4s ease' }} />
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
          <span className="uppercase" style={{ fontFamily: 'Manrope', fontWeight: 600, fontSize: 'clamp(0.95rem,1.6vw,1.25rem)', letterSpacing: '0.12em' }}>
            Analyse en cours
          </span>
          <span style={{ fontFamily: 'Manrope', fontSize: '0.9rem', letterSpacing: '0.08em', color: '#06B6D4' }}>{pct}%</span>
        </div>
      </div>

      {/* Corps : orbe agent actif + flux de révélations */}
      <div className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-8 px-8 md:px-12 py-4 min-h-0">

        {/* Agent actif */}
        <div className="flex flex-col items-center justify-center text-center">
          <div className="relative" style={{ width: 'clamp(170px,18vw,260px)', height: 'clamp(170px,18vw,260px)' }}>
            {/* Anneau conique en rotation perpétuelle */}
            <div className="waiting-ring-spin" style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'conic-gradient(from 0deg, transparent 0deg, rgba(123,57,252,0.15) 90deg, #7b39fc 230deg, #06B6D4 320deg, transparent 360deg)' }} />
            <div className="absolute flex items-center justify-center waiting-orb-glow" style={{ inset: '12px', borderRadius: '50%', background: '#0a0d17', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontFamily: 'Manrope', fontWeight: 600, fontSize: 'clamp(3rem,5.5vw,5rem)', background: 'linear-gradient(135deg,#c9b6ff,#22d3ee)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {cur + 1}
              </span>
            </div>
          </div>
          <div className="mt-8 font-bold" style={{ fontFamily: 'Manrope', fontSize: 'clamp(2rem,4vw,3.4rem)', letterSpacing: '-0.03em', lineHeight: 1.02 }}>{agents[cur]?.name}</div>
          <div className="mt-3 max-w-xl" style={{ color: 'rgba(244,243,248,0.72)', fontFamily: 'Inter', fontSize: 'clamp(1rem,1.8vw,1.4rem)', lineHeight: 1.4 }}>{PHRASES[cur] ?? 'Traitement en cours…'}</div>
        </div>

        {/* Flux de micro-révélations (défile en boucle) */}
        <div className="flex flex-col justify-center min-h-0">
          <div className="rounded-2xl" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)', padding: '24px 26px' }}>
            <span className="uppercase" style={{ fontFamily: 'Manrope', fontSize: '0.78rem', letterSpacing: '0.22em', color: '#06B6D4' }}>Révélations en direct</span>
            <div className="mt-5 flex flex-col gap-4">
              {reveals.map((r, i) => {
                const fromNew = reveals.length - 1 - i;
                const op = Math.max(0.3, 1 - fromNew * 0.2);
                return (
                  <div key={r.id} className="flex items-center gap-3.5 reveal-row" style={{ opacity: op, color: fromNew === 0 ? '#f4f3f8' : 'rgba(244,243,248,0.85)' }}>
                    <span className="flex-none rounded-full" style={{ width: '9px', height: '9px', background: 'linear-gradient(135deg,#7b39fc,#06B6D4)', boxShadow: '0 0 12px rgba(6,182,212,0.8)' }} />
                    <span style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 'clamp(1rem,1.5vw,1.3rem)', lineHeight: 1.3 }}>{r.text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Stepper des 5 agents — l'actif balaie en boucle (jamais tout "terminé" figé) */}
      <div className="relative z-10 px-8 md:px-14 pt-2 pb-10">
        <div className="relative flex justify-between items-start">
          <div className="absolute" style={{ top: '22px', left: '22px', right: '22px', height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px' }} />
          <div className="absolute" style={{ top: '22px', left: '22px', width: `${sweepFill}%`, maxWidth: 'calc(100% - 44px)', height: '3px', background: 'linear-gradient(90deg,#7b39fc,#06B6D4)', borderRadius: '2px', boxShadow: '0 0 14px rgba(6,182,212,0.6)', transition: 'width 0.5s ease' }} />
          {agents.map((a, i) => {
            const state = i < cur ? 'done' : i === cur ? 'active' : 'up';
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
