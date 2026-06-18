'use client';
import { useState } from 'react';
import Chat from "../components/Chat";
import PerformanceChart from "../components/PerformanceChart";
import WhiteBox from "../components/WhiteBox";
import AuditTrail from "../components/AuditTrail";
import StrategyHistory from "../components/StrategyHistory";

export interface BacktestResult {
  status: string;
  strategy_name?: string;
  intent?: string;
  metrics: {
    sharpe_ratio: number;
    max_drawdown_pct: number;
    total_return_pct: number;
    num_trades: number;
    win_rate_pct: number;
  };
  backtest?: {
    status: string;
    error?: string;
    generated_code?: string;
  };
  final_spec?: {
    architecture?: Record<string, unknown>;
    functions?: unknown[];
  };
  compliance_log?: {
    compliance_record?: Record<string, unknown>;
    decision_trace?: Record<string, unknown>;
  };
  pipeline?: {
    status: string;
    pipeline_start?: string;
  };
  chart_data?: { date: string; value: number; drawdown: number }[] | null;
}

export default function Home() {
  const [result, setResult] = useState<BacktestResult | null>(null);

  return (
    <main className="min-h-screen relative overflow-x-hidden" style={{ background: '#060810' }}>

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
          <div className="w-9 h-9 rounded-xl flex items-center justify-center glow-purple"
            style={{ background: 'linear-gradient(135deg, #7b39fc, #06B6D4)' }}>
            <span className="text-white font-bold text-sm" style={{ fontFamily: 'Manrope' }}>Q</span>
          </div>
          <span className="font-bold text-white text-lg" style={{ fontFamily: 'Manrope' }}>
            Quant<span style={{ color: '#7b39fc' }}>Clarity</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium"
            style={{ background: 'rgba(123,57,252,0.15)', color: '#a78bfa', border: '1px solid rgba(123,57,252,0.3)', fontFamily: 'Manrope' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Live
          </span>
          <span className="text-xs px-3 py-1.5 rounded-full"
            style={{ background: 'rgba(255,255,255,0.04)', color: '#666', border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'Manrope' }}>
            White-Box AI Trading
          </span>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">

        {/* Pill badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8"
          style={{ background: 'rgba(85,80,110,0.35)', backdropFilter: 'blur(12px)', border: '1px solid rgba(164,132,215,0.4)' }}>
          <span className="text-xs px-2 py-0.5 rounded font-semibold"
            style={{ background: '#7b39fc', color: '#fff', fontFamily: 'Manrope' }}>New</span>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.8)', fontFamily: 'Manrope' }}>
            6 agents IA · Backtest White-Box · AI Act compliant
          </span>
        </div>

        {/* Headline */}
        <h1 className="mb-6 leading-tight" style={{ fontFamily: 'Instrument Serif', fontSize: 'clamp(2.5rem, 6vw, 5rem)', lineHeight: 1.1 }}>
          <span className="text-white">Le trading est une boîte noire.</span><br />
          <span style={{ background: 'linear-gradient(90deg, #7b39fc, #06B6D4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            On allume <em>la lumière.</em>
          </span>
        </h1>

        {/* Subtext */}
        <p className="text-lg mb-10 max-w-xl mx-auto" style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'Inter', lineHeight: 1.7 }}>
          Décris ta stratégie en langage naturel. 6 agents IA construisent, backtestent et expliquent chaque décision — en toute transparence.
        </p>

        {/* CTA buttons */}
        <div className="flex items-center justify-center gap-4 mb-16 flex-wrap">
          <a href="#pipeline"
            className="px-8 py-3.5 rounded-xl font-semibold text-sm text-white transition-all hover:scale-105"
            style={{ background: '#7b39fc', fontFamily: 'Manrope', boxShadow: '0 0 30px rgba(123,57,252,0.4)' }}>
            Lancer une stratégie →
          </a>
          <a href="#pipeline"
            className="px-8 py-3.5 rounded-xl font-semibold text-sm transition-all hover:scale-105"
            style={{ background: 'rgba(43,35,68,0.8)', color: '#f6f7f9', fontFamily: 'Manrope', border: '1px solid rgba(123,57,252,0.3)' }}>
            Voir la démo
          </a>
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-center gap-10 flex-wrap">
          {[
            { value: '6', label: 'Agents IA' },
            { value: '100%', label: 'Transparent' },
            { value: 'AI Act', label: 'Compliant' },
            { value: 'Live', label: 'Backtest réel' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-xl font-bold" style={{ color: '#7b39fc', fontFamily: 'Manrope' }}>{s.value}</p>
              <p className="text-xs" style={{ color: '#666', fontFamily: 'Inter' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* DIVIDER */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(123,57,252,0.3))' }} />
          <span className="text-xs px-4 py-1.5 rounded-full" style={{ background: 'rgba(123,57,252,0.1)', color: '#7b39fc', border: '1px solid rgba(123,57,252,0.2)', fontFamily: 'Manrope' }}>
            Pipeline IA
          </span>
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(123,57,252,0.3), transparent)' }} />
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div id="pipeline" className="relative z-10 max-w-4xl mx-auto px-6 pb-20 flex flex-col gap-5">
        <Chat onResult={setResult} />
        <StrategyHistory onLoad={setResult} />
        {result && <PerformanceChart result={result} />}
        {result && <WhiteBox result={result} />}
        {result && <AuditTrail result={result} />}
      </div>

      {/* FOOTER */}
      <footer className="relative z-10 text-center py-10" style={{ borderTop: '1px solid rgba(123,57,252,0.1)' }}>
        <p className="text-xs" style={{ color: '#444', fontFamily: 'Inter' }}>
          QuantClarity · ESIEE Paris 2025–2026 · Vos données ne quittent pas votre session · Propulsé par 6 agents IA
        </p>
      </footer>
    </main>
  );
}