'use client';
import Link from 'next/link';
import {
  ArrowLeft, Boxes, GitBranch, Cpu, ShieldCheck, FlaskConical, Layers,
  Brain, ClipboardList, Wrench, ShieldAlert, Scale, Code2, Server, Globe,
  Database, Lock, RefreshCw, ArrowRight, CornerDownLeft, Terminal, LineChart,
  CheckCircle2, type LucideIcon,
} from 'lucide-react';

// ============================================================================
// PAGE TECHNIQUE — /technique
// Contenu 100% STATIQUE et vérifié dans le code réel du monorepo (étape 0).
// Aucune donnée fetchée. N'impacte pas le flux de la landing/onboarding.
// Sources principales : agents/orchestrator.py, agents/core/specialized.py,
// agents/codeur.py, agents/fallback_templates/*, backend/app/api/pipeline.py,
// sandbox/executor.py, backend/pyproject.toml, frontend/package.json.
// ============================================================================

const cardBg = 'rgba(255,255,255,0.04)';
const cardBorder = '1px solid rgba(255,255,255,0.08)';
const cardShadow = '0 10px 40px rgba(0,0,0,0.35)';

// --- Données vérifiées ------------------------------------------------------

const AGENTS: { Icon: LucideIcon; name: string; prompt: string; role: string }[] = [
  { Icon: Brain, name: 'Brainstormer', prompt: 'brainstormer_v2', role: "Clarifie l'intention floue en spécification exploitable et évalue la faisabilité. Un score de faisabilité trop bas arrête le pipeline en amont." },
  { Icon: ClipboardList, name: 'Chef de Projet', prompt: 'chef_projet_v2', role: 'Cadre la stratégie : objectifs, contraintes, périmètre. Transforme la vision en plan structuré pour l’Architecte.' },
  { Icon: Wrench, name: 'Architecte', prompt: 'architecte_v11', role: 'Conçoit la stratégie sur-mesure et produit le bloc strategy_params (template + paramètres adaptés à l’intention).' },
  { Icon: ShieldAlert, name: 'Critique', prompt: 'critique_v3', role: 'Audite la spec : biais, erreurs, look-ahead. Peut REJETER et renvoyer l’Architecte corriger. C’est le garde-fou de la boucle.' },
  { Icon: Scale, name: 'Conformité', prompt: 'conformite_v3', role: 'Trace chaque décision et produit le log AI Act (Article 12) : decision_trace, compliance_record horodaté, supervision, disclaimers légaux.' },
];

const FLOW_NODES: { label: string; kind: 'io' | 'llm' | 'exec' }[] = [
  { label: 'Intention (FR)', kind: 'io' },
  { label: 'Brainstormer', kind: 'llm' },
  { label: 'Chef de Projet', kind: 'llm' },
  { label: 'Architecte', kind: 'llm' },
  { label: 'Critique', kind: 'llm' },
  { label: 'Conformité', kind: 'llm' },
  { label: 'Codeur (déterministe)', kind: 'exec' },
  { label: 'Sandbox E2B', kind: 'exec' },
  { label: 'Résultats', kind: 'io' },
];

const PARAM_BOUNDS: { key: string; bound: string; template: string }[] = [
  { key: 'rsi_window', bound: '[5 – 50] · déf. 14', template: 'RSI' },
  { key: 'rsi_oversold / overbought', bound: '[10–40] / [60–90]', template: 'RSI' },
  { key: 'ma_fast / ma_slow', bound: '[5–50] / [20–300]', template: 'MA crossover' },
  { key: 'bb_window / bb_alpha', bound: '[10–50] / [1.5–3.0]', template: 'Bollinger' },
  { key: 'roc_window / seuils', bound: '[5–100] / bornés', template: 'Momentum' },
  { key: 'sizing', bound: '[0.05 – 0.30]', template: 'commun' },
  { key: 'sl_stop / sl_trail', bound: '[0.02 – 0.30]', template: 'commun' },
  { key: 'init_cash', bound: '[10 k – 10 M]', template: 'commun' },
];

const INVARIANTS = [
  'RSI : oversold + 10 ≤ overbought, sinon reset des deux aux défauts',
  'MA : fast < slow, sinon reset (50 / 200)',
  'Momentum : seuil d’entrée > seuil de sortie',
  'Jamais sl_stop ET sl_trail ensemble (on garde sl_stop)',
  'Toute clé hors-bornes ou du mauvais type est omise → défaut du template',
];

const SECURITY_BLOCKED = {
  modules: ['os', 'subprocess', 'socket', 'sys', 'shutil', 'requests', 'urllib'],
  functions: ['eval', 'exec', '__import__', 'compile', 'open'],
};

const STACK: { Icon: LucideIcon; title: string; items: string[] }[] = [
  { Icon: Server, title: 'Backend — Railway (Docker, Python 3.11)', items: [
    'FastAPI + Uvicorn', 'SQLModel + PostgreSQL (psycopg v3)', 'Redis (cache run 48 h + cache agents)',
    'slowapi (rate-limit 5 req/h par IP)', 'SDK anthropic (agents LLM)', 'e2b-code-interpreter', 'pandas · yfinance',
  ]},
  { Icon: Globe, title: 'Frontend — Vercel', items: [
    'Next.js 14 (App Router)', 'React 18 · TypeScript 5.5', 'TailwindCSS 3.4', 'lucide-react · recharts 3.8',
  ]},
  { Icon: FlaskConical, title: 'Sandbox — E2B', items: [
    'e2b_code_interpreter (Sandbox isolée)', 'Image custom (e2b.Dockerfile)', 'Runtime : yfinance · vectorbt · numba', 'Timeout d’exécution 60 s',
  ]},
  { Icon: Cpu, title: 'Agents — pipeline LLM', items: [
    'Modèle claude-opus-4-6 (les 5 agents)', 'Prompts versionnés en fichiers', 'Garde-fou budget quotidien', 'Cache Redis par agent',
  ]},
];

// --- Petits composants de mise en page --------------------------------------

function SectionTitle({ Icon, kicker, title }: { Icon: LucideIcon; kicker: string; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <span className="flex-none w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ background: 'rgba(123,57,252,0.14)', border: '1px solid rgba(123,57,252,0.3)' }}>
        <Icon size={19} color="#a78bfa" strokeWidth={2} />
      </span>
      <div>
        <p className="text-[0.65rem] uppercase mb-0.5" style={{ color: '#06B6D4', fontFamily: 'Manrope', letterSpacing: '0.22em' }}>{kicker}</p>
        <h2 className="text-white font-bold" style={{ fontFamily: 'Manrope', fontSize: 'clamp(1.3rem,2.4vw,1.8rem)', letterSpacing: '-0.02em' }}>{title}</h2>
      </div>
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl p-6 ${className}`} style={{ background: cardBg, border: cardBorder, backdropFilter: 'blur(20px)', boxShadow: cardShadow }}>
      {children}
    </div>
  );
}

// Pastille d'un nœud du diagramme de flux.
function FlowNode({ label, kind }: { label: string; kind: 'io' | 'llm' | 'exec' }) {
  const palette = {
    io:   { bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.16)', dot: '#9aa7b8' },
    llm:  { bg: 'rgba(123,57,252,0.12)', border: 'rgba(123,57,252,0.45)', dot: '#a78bfa' },
    exec: { bg: 'rgba(6,182,212,0.10)', border: 'rgba(6,182,212,0.45)', dot: '#06B6D4' },
  }[kind];
  return (
    <div className="flex items-center gap-2 rounded-xl whitespace-nowrap"
      style={{ padding: '10px 14px', background: palette.bg, border: `1px solid ${palette.border}` }}>
      <span className="w-2 h-2 rounded-full flex-none" style={{ background: palette.dot, boxShadow: `0 0 8px ${palette.dot}` }} />
      <span className="text-white" style={{ fontFamily: 'Manrope', fontWeight: 600, fontSize: 'clamp(0.75rem,1.1vw,0.9rem)' }}>{label}</span>
    </div>
  );
}

export default function TechniquePage() {
  return (
    <main className="min-h-screen relative" style={{ background: '#060810', color: '#f4f3f8', fontFamily: 'Inter, sans-serif' }}>
      {/* Glows d'ambiance (cohérents avec la landing) */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div style={{ position: 'absolute', top: '-15%', left: '-10%', width: '620px', height: '620px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(123,57,252,0.16) 0%, transparent 66%)', filter: 'blur(50px)' }} />
        <div style={{ position: 'absolute', bottom: '-15%', right: '-12%', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,0.10) 0%, transparent 66%)', filter: 'blur(60px)' }} />
      </div>

      {/* Top bar */}
      <nav className="sticky top-0 z-50 px-6 md:px-10 py-4 flex items-center justify-between"
        style={{ background: 'rgba(6,8,16,0.7)', backdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(123,57,252,0.15)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #7b39fc, #06B6D4)', boxShadow: '0 0 15px rgba(123,57,252,0.3)' }}>
            <span className="text-white font-bold text-sm" style={{ fontFamily: 'Manrope' }}>Q</span>
          </div>
          <span className="font-bold text-white text-lg" style={{ fontFamily: 'Manrope' }}>
            Quant<span style={{ color: '#7b39fc' }}>Clarity</span>
          </span>
          <span className="hidden sm:inline text-xs px-2.5 py-1 rounded-full" style={{ background: 'rgba(6,182,212,0.1)', color: '#06B6D4', border: '1px solid rgba(6,182,212,0.25)', fontFamily: 'Manrope' }}>
            Architecture technique
          </span>
        </div>
        <Link href="/" className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-semibold transition-all hover:scale-105"
          style={{ background: 'rgba(123,57,252,0.18)', color: '#c4b5fd', border: '1px solid rgba(123,57,252,0.4)', fontFamily: 'Manrope' }}>
          <ArrowLeft size={13} strokeWidth={2.5} /> Retour à la démo
        </Link>
      </nav>

      <div className="relative z-10 max-w-5xl mx-auto px-6 pb-28">

        {/* HERO */}
        <header className="pt-16 pb-12 text-center">
          <span className="text-xs uppercase block mb-5" style={{ color: '#06B6D4', fontFamily: 'Manrope', letterSpacing: '0.3em' }}>
            Sous le capot
          </span>
          <h1 className="text-white" style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 'clamp(2.2rem,5vw,3.6rem)', lineHeight: 1.08, letterSpacing: '-0.03em' }}>
            Comment QuantClarity{' '}
            <em style={{ fontFamily: 'Instrument Serif', fontStyle: 'italic', fontWeight: 400, background: 'linear-gradient(120deg,#b79bff,#22d3ee)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              fonctionne vraiment
            </em>.
          </h1>
          <p className="mt-5 max-w-2xl mx-auto" style={{ color: 'rgba(244,243,248,0.6)', fontFamily: 'Inter', fontSize: 'clamp(1rem,1.5vw,1.15rem)', lineHeight: 1.6 }}>
            Un pipeline de 5 agents LLM qui se challengent, une génération de code paramétrée, un backtest exécuté
            en environnement isolé, et une traçabilité conforme à l’AI Act. Page destinée à un lecteur technique —
            chaque détail ci-dessous est tiré du code.
          </p>
        </header>

        {/* 1. ARCHITECTURE GLOBALE */}
        <section className="mb-16">
          <SectionTitle Icon={Boxes} kicker="01 — Vue d’ensemble" title="Architecture du monorepo" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {[
              { Icon: Cpu, t: 'agents/', d: 'Pipeline d’agents LLM (Python) + Codeur déterministe + templates de stratégies.' },
              { Icon: Server, t: 'backend/', d: 'API FastAPI. Orchestre agents → Codeur → sandbox, gère cache, rate-limit et persistance.' },
              { Icon: FlaskConical, t: 'sandbox/', d: 'Exécuteur E2B : lance le code de backtest dans une VM isolée et en extrait les métriques.' },
              { Icon: Globe, t: 'frontend/', d: 'Application Next.js (l’interface que vous utilisez), déployée sur Vercel.' },
            ].map((b) => {
              const Icon = b.Icon;
              return (
                <Card key={b.t}>
                  <div className="flex items-center gap-2.5 mb-2">
                    <Icon size={17} color="#a78bfa" strokeWidth={2} />
                    <span className="font-bold text-white" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.95rem' }}>{b.t}</span>
                  </div>
                  <p style={{ color: 'rgba(244,243,248,0.6)', fontFamily: 'Inter', fontSize: '0.9rem', lineHeight: 1.5 }}>{b.d}</p>
                </Card>
              );
            })}
          </div>
          <Card>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(244,243,248,0.72)', fontFamily: 'Inter' }}>
              <span className="text-white font-semibold" style={{ fontFamily: 'Manrope' }}>Communication. </span>
              Le frontend (Vercel) appelle <code style={codeStyle}>POST /api/pipeline/run</code> du backend (Railway, conteneur Docker, healthcheck <code style={codeStyle}>/health</code>).
              L’image backend embarque <code style={codeStyle}>agents/</code> et <code style={codeStyle}>sandbox/</code> : le backend les importe directement
              (<code style={codeStyle}>run_pipeline</code>, <code style={codeStyle}>generate_code</code>, <code style={codeStyle}>run_backtest</code>) — pas d’appel réseau interne. Persistance PostgreSQL, cache Redis.
            </p>
          </Card>
        </section>

        {/* DIAGRAMME DE FLUX */}
        <section className="mb-16">
          <SectionTitle Icon={GitBranch} kicker="Le flux complet" title="De l’intention aux résultats" />
          <Card>
            <div className="flex flex-wrap items-center gap-2.5">
              {FLOW_NODES.map((n, i) => (
                <div key={n.label} className="flex items-center gap-2.5">
                  <FlowNode label={n.label} kind={n.kind} />
                  {i < FLOW_NODES.length - 1 && (
                    <ArrowRight size={16} color="rgba(244,243,248,0.35)" strokeWidth={2.5} className="flex-none" />
                  )}
                </div>
              ))}
            </div>
            {/* Boucle Critique → Architecte */}
            <div className="mt-5 flex items-center gap-3 rounded-xl" style={{ padding: '12px 16px', background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.28)' }}>
              <CornerDownLeft size={18} color="#06B6D4" strokeWidth={2.2} className="flex-none" />
              <p style={{ fontFamily: 'Inter', fontSize: '0.88rem', lineHeight: 1.5, color: 'rgba(244,243,248,0.78)' }}>
                <span className="text-white font-semibold" style={{ fontFamily: 'Manrope' }}>Boucle de correction. </span>
                Si le Critique rejette, sa critique repart à l’Architecte — <span style={{ color: '#06B6D4', fontWeight: 600 }}>jusqu’à 2 fois</span> (3 passes Critique max). Sans approbation, la stratégie est rejetée.
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-xs" style={{ color: 'rgba(244,243,248,0.5)', fontFamily: 'Inter' }}>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: '#a78bfa' }} /> Agent LLM</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: '#06B6D4' }} /> Étape d’exécution (pas un LLM)</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: '#9aa7b8' }} /> Entrée / sortie</span>
            </div>
          </Card>
        </section>

        {/* 2. PIPELINE D'AGENTS */}
        <section className="mb-16">
          <SectionTitle Icon={Cpu} kicker="02 — Le cœur" title="5 agents LLM qui se challengent" />
          <div className="flex flex-col gap-3">
            {AGENTS.map((a, i) => {
              const Icon = a.Icon;
              const isCritique = a.name === 'Critique';
              return (
                <div key={a.name} className="rounded-2xl p-5 flex gap-4 items-start"
                  style={{
                    background: isCritique ? 'rgba(6,182,212,0.07)' : cardBg,
                    border: isCritique ? '1px solid rgba(6,182,212,0.4)' : cardBorder,
                    boxShadow: isCritique ? '0 0 26px rgba(6,182,212,0.16)' : cardShadow,
                    backdropFilter: 'blur(20px)',
                  }}>
                  <span className="flex-none w-11 h-11 rounded-xl flex items-center justify-center mt-0.5"
                    style={{ background: 'rgba(123,57,252,0.14)', border: '1px solid rgba(123,57,252,0.35)' }}>
                    <Icon size={20} color="#a78bfa" strokeWidth={2} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
                      <span className="text-[0.7rem] font-bold" style={{ color: '#06B6D4', fontFamily: 'Manrope' }}>{String(i + 1).padStart(2, '0')}</span>
                      <span className="font-bold text-white" style={{ fontFamily: 'Manrope', fontSize: '1.05rem' }}>{a.name}</span>
                      <span className="text-[0.68rem] px-2 py-0.5 rounded-md" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(244,243,248,0.55)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'JetBrains Mono, monospace' }}>{a.prompt}</span>
                      {isCritique && (
                        <span className="inline-flex items-center gap-1 text-[0.6rem] px-2 py-0.5 rounded-full font-bold uppercase"
                          style={{ background: 'linear-gradient(120deg,#06B6D4,#7b39fc)', color: '#fff', fontFamily: 'Manrope', letterSpacing: '0.1em' }}>
                          <RefreshCw size={10} strokeWidth={2.5} /> Garde-fou
                        </span>
                      )}
                    </div>
                    <p style={{ color: 'rgba(244,243,248,0.62)', fontFamily: 'Inter', fontSize: '0.9rem', lineHeight: 1.5 }}>{a.role}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <Card className="mt-4">
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(244,243,248,0.72)', fontFamily: 'Inter' }}>
              <span className="text-white font-semibold" style={{ fontFamily: 'Manrope' }}>Précision honnête. </span>
              Les 5 agents ci-dessus sont des appels au modèle <code style={codeStyle}>claude-opus-4-6</code>. Le <span className="text-white font-semibold">Codeur</span> et la <span className="text-white font-semibold">Sandbox</span> ne sont
              <span style={{ color: '#06B6D4' }}> pas des agents LLM</span> : le Codeur est déterministe (il traduit la spec en code via des templates), la Sandbox exécute. L’intelligence est en amont.
            </p>
          </Card>
        </section>

        {/* 3. GÉNÉRATION SUR-MESURE */}
        <section className="mb-16">
          <SectionTitle Icon={Layers} kicker="03 — Sur-mesure" title="Des paramètres adaptés à l’intention" />
          <Card className="mb-4">
            <p className="text-sm leading-relaxed mb-2" style={{ color: 'rgba(244,243,248,0.72)', fontFamily: 'Inter' }}>
              L’Architecte produit un bloc <code style={codeStyle}>strategy_params</code> (choix du template + paramètres). Avant toute génération de code, ces paramètres passent par
              <code style={codeStyle}>validate_strategy_params()</code> : chaque valeur est <span className="text-white font-semibold">typée, bornée (clampée)</span> et soumise à des invariants.
              Une valeur absente ou aberrante est <span className="text-white font-semibold">omise</span> → le défaut sûr du template s’applique. Résultat : <span style={{ color: '#06B6D4' }}>le code généré est toujours valide</span>, et il varie réellement selon l’intention.
            </p>
          </Card>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <p className="text-xs uppercase mb-3" style={{ color: '#06B6D4', fontFamily: 'Manrope', letterSpacing: '0.18em' }}>Paramètres & bornes</p>
              <div className="flex flex-col gap-2">
                {PARAM_BOUNDS.map((p) => (
                  <div key={p.key} className="flex items-center justify-between gap-3 rounded-lg" style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', color: '#c9d3e0' }}>{p.key}</span>
                    <span className="flex items-center gap-2 flex-none">
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.74rem', color: '#a78bfa' }}>{p.bound}</span>
                      <span className="text-[0.6rem] px-1.5 py-0.5 rounded" style={{ background: 'rgba(6,182,212,0.1)', color: '#06B6D4', fontFamily: 'Manrope' }}>{p.template}</span>
                    </span>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <p className="text-xs uppercase mb-3" style={{ color: '#06B6D4', fontFamily: 'Manrope', letterSpacing: '0.18em' }}>Invariants (garde-fous)</p>
              <div className="flex flex-col gap-2.5">
                {INVARIANTS.map((inv, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <CheckCircle2 size={15} color="#22c55e" strokeWidth={2} className="flex-none mt-0.5" />
                    <p style={{ color: 'rgba(244,243,248,0.66)', fontFamily: 'Inter', fontSize: '0.86rem', lineHeight: 1.45 }}>{inv}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 pt-4 text-xs" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', color: 'rgba(244,243,248,0.5)', fontFamily: 'Inter', lineHeight: 1.5 }}>
                4 templates disponibles : <span style={{ color: '#c9d3e0' }}>RSI, MA crossover, Bollinger, Momentum</span>. 7 actifs reconnus :
                BTC, ETH, SOL, SPY, AAPL, TSLA, QQQ.
              </p>
            </Card>
          </div>
        </section>

        {/* 4. BACKTEST & ANTI-BIAIS */}
        <section className="mb-16">
          <SectionTitle Icon={LineChart} kicker="04 — Rigueur" title="Backtest & anti-biais" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <div className="flex items-center gap-2 mb-2">
                <ShieldAlert size={16} color="#06B6D4" strokeWidth={2} />
                <span className="font-bold text-white" style={{ fontFamily: 'Manrope', fontSize: '0.95rem' }}>Anti-look-ahead</span>
              </div>
              <p style={{ color: 'rgba(244,243,248,0.65)', fontFamily: 'Inter', fontSize: '0.88rem', lineHeight: 1.5 }}>
                Les signaux sont calculés sur la clôture puis décalés d’une barre (<code style={codeStyle}>.shift(1)</code>), et l’exécution se fait sur l’<span className="text-white font-semibold">ouverture de la barre suivante</span> (<code style={codeStyle}>df[&quot;Open&quot;]</code>).
                On ne peut pas tricher avec une information non encore disponible.
              </p>
            </Card>
            <Card>
              <div className="flex items-center gap-2 mb-2">
                <Terminal size={16} color="#06B6D4" strokeWidth={2} />
                <span className="font-bold text-white" style={{ fontFamily: 'Manrope', fontSize: '0.95rem' }}>Moteur & coûts</span>
              </div>
              <p style={{ color: 'rgba(244,243,248,0.65)', fontFamily: 'Inter', fontSize: '0.88rem', lineHeight: 1.5 }}>
                <span className="text-white font-semibold">VectorBT</span> (<code style={codeStyle}>Portfolio.from_signals</code>), données <span className="text-white font-semibold">yfinance</span>, fréquence journalière.
                Frais <code style={codeStyle}>0.001</code> ; slippage <code style={codeStyle}>0.0015</code> (crypto) / <code style={codeStyle}>0.001</code> (actions) ; historique 2 ans (crypto) / 5 ans (actions).
              </p>
            </Card>
          </div>
          <Card className="mt-4">
            <p className="text-xs uppercase mb-3" style={{ color: '#06B6D4', fontFamily: 'Manrope', letterSpacing: '0.18em' }}>5 métriques extraites</p>
            <div className="flex flex-wrap gap-2.5">
              {['Sharpe Ratio', 'Max Drawdown', 'Total Return', 'Nombre de trades', 'Win Rate'].map((m) => (
                <span key={m} className="text-sm px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', color: '#c9d3e0', border: '1px solid rgba(123,57,252,0.25)', fontFamily: 'Inter' }}>{m}</span>
              ))}
            </div>
            <p className="mt-3 text-xs" style={{ color: 'rgba(244,243,248,0.5)', fontFamily: 'Inter', lineHeight: 1.5 }}>
              La courbe d’equity est sous-échantillonnée à ~200 points par pas uniforme — le pic de drawdown est préservé (pas de lissage trompeur).
            </p>
          </Card>
        </section>

        {/* 5. SANDBOX */}
        <section className="mb-16">
          <SectionTitle Icon={FlaskConical} kicker="05 — Isolation" title="Exécution en sandbox E2B" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <Lock size={16} color="#06B6D4" strokeWidth={2} />
                <span className="font-bold text-white" style={{ fontFamily: 'Manrope', fontSize: '0.95rem' }}>Contrôle de sécurité (AST)</span>
              </div>
              <p className="mb-3" style={{ color: 'rgba(244,243,248,0.65)', fontFamily: 'Inter', fontSize: '0.88rem', lineHeight: 1.5 }}>
                Avant toute exécution, le code est compilé puis analysé (AST). Modules et fonctions sensibles sont bloqués :
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[...SECURITY_BLOCKED.modules, ...SECURITY_BLOCKED.functions].map((b) => (
                  <span key={b} className="text-[0.72rem] px-2 py-0.5 rounded" style={{ background: 'rgba(248,113,113,0.1)', color: '#F87171', border: '1px solid rgba(248,113,113,0.25)', fontFamily: 'JetBrains Mono, monospace' }}>{b}</span>
                ))}
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <RefreshCw size={16} color="#06B6D4" strokeWidth={2} />
                <span className="font-bold text-white" style={{ fontFamily: 'Manrope', fontSize: '0.95rem' }}>Exécution & retry</span>
              </div>
              <div className="flex flex-col gap-2.5">
                {[
                  'VM E2B isolée, dépendances installées au runtime',
                  'Timeout d’exécution : 60 s',
                  'Jusqu’à 3 tentatives (2 retries) en cas d’échec',
                  'Aucun retry sur violation de sécurité',
                  'Échec total → FALLBACK (métriques nulles, badge dédié)',
                ].map((t, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <ArrowRight size={14} color="#a78bfa" strokeWidth={2.5} className="flex-none mt-1" />
                    <p style={{ color: 'rgba(244,243,248,0.66)', fontFamily: 'Inter', fontSize: '0.86rem', lineHeight: 1.45 }}>{t}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </section>

        {/* 6. CONFORMITÉ */}
        <section className="mb-16">
          <SectionTitle Icon={ShieldCheck} kicker="06 — Traçabilité" title="Conformité AI Act (Article 12)" />
          <Card>
            <p className="text-sm leading-relaxed mb-4" style={{ color: 'rgba(244,243,248,0.72)', fontFamily: 'Inter' }}>
              Chaque appel d’agent est enveloppé d’un <code style={codeStyle}>compliance_log</code> (<code style={codeStyle}>decision_traceable</code>, <code style={codeStyle}>ai_generated</code>, <code style={codeStyle}>agent_name</code>, <code style={codeStyle}>logged_at</code>).
              En fin de pipeline, l’agent Conformité agrège le tout dans une trace d’audit dédiée.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { t: 'decision_trace', d: 'Les décisions clés, qui les a prises, et pourquoi (key_decisions).' },
                { t: 'compliance_record', d: 'Référentiel + horodatage généré au moment du run.' },
                { t: 'oversight', d: 'Supervision humaine requise ou non, points de contrôle.' },
                { t: 'risk_documentation', d: 'Risques identifiés, mitigations, risques résiduels.' },
              ].map((b) => (
                <div key={b.t} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <p className="font-semibold mb-1" style={{ color: '#a78bfa', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem' }}>{b.t}</p>
                  <p style={{ color: 'rgba(244,243,248,0.6)', fontFamily: 'Inter', fontSize: '0.84rem', lineHeight: 1.45 }}>{b.d}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs" style={{ color: 'rgba(244,243,248,0.5)', fontFamily: 'Inter', lineHeight: 1.5 }}>
              Des disclaimers légaux sont injectés (recherche uniquement, pas de conseil en investissement). Cette trace est visible dans l’onglet « AI Act Log » et l’Audit Trail de chaque résultat.
            </p>
          </Card>
        </section>

        {/* 7. STACK */}
        <section className="mb-12">
          <SectionTitle Icon={Database} kicker="07 — Technologies" title="La stack complète" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {STACK.map((s) => {
              const Icon = s.Icon;
              return (
                <Card key={s.title}>
                  <div className="flex items-center gap-2.5 mb-3">
                    <Icon size={17} color="#06B6D4" strokeWidth={2} />
                    <span className="font-bold text-white" style={{ fontFamily: 'Manrope', fontSize: '0.92rem' }}>{s.title}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {s.items.map((it) => (
                      <span key={it} className="text-xs px-2.5 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', color: '#c9d3e0', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Inter' }}>{it}</span>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center pt-8" style={{ borderTop: '1px solid rgba(123,57,252,0.12)' }}>
          <Link href="/" className="inline-flex items-center gap-2 text-sm px-5 py-2.5 rounded-xl font-semibold text-white transition-all hover:scale-105"
            style={{ background: 'linear-gradient(120deg,#7b39fc,#06B6D4)', fontFamily: 'Manrope', boxShadow: '0 10px 30px rgba(123,57,252,0.35)' }}>
            <ArrowLeft size={16} strokeWidth={2} /> Retour à la démo
          </Link>
          <p className="mt-6 text-xs" style={{ color: '#444', fontFamily: 'Inter' }}>
            QuantClarity · ESIEE Paris 2025–2026 · Page technique — contenu vérifié dans le code source
          </p>
        </footer>
      </div>
    </main>
  );
}

const codeStyle: React.CSSProperties = {
  fontFamily: 'JetBrains Mono, ui-monospace, monospace',
  fontSize: '0.85em',
  color: '#a78bfa',
  background: 'rgba(123,57,252,0.1)',
  padding: '1px 6px',
  borderRadius: 5,
  border: '1px solid rgba(123,57,252,0.2)',
};
