'use client';
import { useState, useRef } from 'react';
import { Plus } from 'lucide-react';
import Chat, { type ChatHandle } from "../components/Chat";
import Onboarding from "../components/Onboarding";
import PerformanceChart from "../components/PerformanceChart";
import WhiteBox from "../components/WhiteBox";
import AuditTrail from "../components/AuditTrail";
import StrategyHistory from "../components/StrategyHistory";
import PrivacyNotice from "../components/PrivacyNotice";

export interface BacktestResult {
  status: string;
  strategy_name?: string;
  intent?: string;
  metrics: {
    sharpe_ratio: number;
    max_drawdown_pct: number;
    total_return_pct: number;
    // Clé canonique backend (anciennement `num_trades`). `null` en FALLBACK.
    trades_count: number | null;
    win_rate_pct: number;
  };
  backtest?: {
    status: string;
    error?: string;
    generated_code?: string;
    // Fallback hérité : certaines réponses sandbox exposent encore `num_trades`.
    num_trades?: number;
  };
  final_spec?: {
    architecture?: Record<string, unknown>;
    functions?: unknown[];
  };
  compliance_log?: {
    compliance_record?: Record<string, unknown>;
    decision_trace?: Record<string, unknown>;
    // Résumé pédagogique en français produit par l'agent Conformité.
    oversight?: {
      plain_language_summary?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  pipeline?: {
    status: string;
    pipeline_start?: string;
  };
  chart_data?: { date: string; value: number; drawdown: number }[] | null;
}

export default function Home() {
  const [result, setResult] = useState<BacktestResult | null>(null);
  // L'onboarding précède le flux existant ; une fois lancé, il se retire et
  // l'animation des 6 agents + résultats prennent le relais (inchangés).
  const [started, setStarted] = useState(false);
  const chatRef = useRef<ChatHandle | null>(null);

  const handleLaunch = (intent: string) => {
    setStarted(true);
    // Chat est déjà monté : on déclenche le pipeline existant avec l'intent construit.
    chatRef.current?.start(intent);
    // Amène l'utilisateur sur le pipeline (au-dessus : navbar + hero existants).
    setTimeout(() => {
      document.getElementById('pipeline')?.scrollIntoView({ behavior: 'smooth' });
    }, 80);
  };

  // « Nouvelle stratégie » — moyen DISCRET de relancer depuis l'écran de résultats :
  // on efface le résultat courant et on revient à l'onboarding (le grand hero d'accueil
  // ne réapparaît jamais au-dessus des résultats).
  const handleNewStrategy = () => {
    setResult(null);
    setStarted(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main className="min-h-screen relative overflow-x-hidden" style={{ background: '#060810' }}>

      {/* ONBOARDING — écran initial qui PRÉCÈDE le flux existant. Au lancement,
          il appelle chatRef.start(intent) puis se retire (started=true). */}
      {!started && <Onboarding onLaunch={handleLaunch} />}

      {/* FLUX EXISTANT — masqué tant que l'onboarding n'a pas lancé (started=false).
          display:none garde Chat MONTÉ (ref impérative + ambiance préservés) ; aucun
          résidu de l'ancien accueil ne reste visible derrière l'overlay. Une fois
          lancé, display:contents restitue exactement le layout d'origine. */}
      <div style={{ display: started ? 'contents' : 'none' }}>

      {/* BACKGROUND — gradient animé */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div style={{
          position: 'absolute', top: '-20%', left: '-10%',
          width: '600px', height: '600px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(123,57,252,0.15) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }} />
        <div style={{
          position: 'absolute', top: '10%', right: '-15%',
          width: '500px', height: '500px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(6,182,212,0.1) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }} />
        <div style={{
          position: 'absolute', bottom: '20%', left: '30%',
          width: '400px', height: '400px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(123,57,252,0.08) 0%, transparent 70%)',
          filter: 'blur(50px)',
        }} />
      </div>

      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 px-8 py-4 flex items-center justify-between"
        style={{ background: 'rgba(6,8,16,0.7)', backdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(123,57,252,0.15)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #7b39fc, #06B6D4)', boxShadow: '0 0 15px rgba(123,57,252,0.3)' }}>
            <span className="text-white font-bold text-sm" style={{ fontFamily: 'Manrope' }}>Q</span>
          </div>
          <span className="font-bold text-white text-lg" style={{ fontFamily: 'Manrope' }}>
            Quant<span style={{ color: '#7b39fc' }}>Clarity</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Relance discrète — remplace le grand hero d'accueil une fois l'analyse lancée */}
          <button onClick={handleNewStrategy}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-semibold text-white transition-all hover:scale-105"
            style={{ background: 'rgba(123,57,252,0.18)', color: '#c4b5fd', border: '1px solid rgba(123,57,252,0.4)', fontFamily: 'Manrope' }}>
            <Plus size={13} strokeWidth={2.5} />
            Nouvelle stratégie
          </button>
          <span className="hidden sm:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium"
            style={{ background: 'rgba(123,57,252,0.15)', color: '#a78bfa', border: '1px solid rgba(123,57,252,0.3)', fontFamily: 'Manrope' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            Live
          </span>
          <span className="hidden md:inline text-xs px-3 py-1.5 rounded-full"
            style={{ background: 'rgba(255,255,255,0.04)', color: '#666', border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'Manrope' }}>
            White-Box AI Trading
          </span>
        </div>
      </nav>

      {/* HERO d'accueil supprimé du flux de résultats : il faisait doublon avec
          l'onboarding et réapparaissait au-dessus des résultats (started=true).
          L'accueil complet reste géré par <Onboarding> (visible uniquement quand
          !started) ; ici on garde juste le bouton « Nouvelle stratégie » (navbar). */}

      {/* DIVIDER */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 pt-12 mb-10">
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(123,57,252,0.3))' }} />
          <span className="text-xs px-4 py-1.5 rounded-full" style={{ background: 'rgba(123,57,252,0.1)', color: '#7b39fc', border: '1px solid rgba(123,57,252,0.2)', fontFamily: 'Manrope' }}>
            Pipeline IA
          </span>
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(123,57,252,0.3), transparent)' }} />
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div id="pipeline" className="relative z-10 max-w-5xl mx-auto px-6 pb-24 flex flex-col gap-10">
        <Chat ref={chatRef} onResult={setResult} />
        <PrivacyNotice />
        <StrategyHistory onLoad={setResult} />
        {result && (
          <div className="flex flex-col gap-10">
            <div className="animate-fade-rise" style={{ animationDelay: '0.05s' }}><PerformanceChart result={result} /></div>
            <div className="animate-fade-rise" style={{ animationDelay: '0.15s' }}><WhiteBox result={result} /></div>
            <div className="animate-fade-rise" style={{ animationDelay: '0.25s' }}><AuditTrail result={result} /></div>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <footer className="relative z-10 text-center py-10" style={{ borderTop: '1px solid rgba(123,57,252,0.1)' }}>
        <p className="text-xs" style={{ color: '#444', fontFamily: 'Inter' }}>
          QuantClarity · ESIEE Paris 2025–2026 · Vos données ne quittent pas votre session · Propulsé par 6 agents IA
        </p>
      </footer>

      </div>{/* /FLUX EXISTANT */}
    </main>
  );
}