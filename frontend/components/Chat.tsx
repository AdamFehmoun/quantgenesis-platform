'use client';
import { useState, useEffect, useRef } from 'react';
import { BacktestResult } from '../app/page';

interface ChatProps {
  onResult: (result: BacktestResult) => void;
}

const AGENTS = [
  { name: 'Brainstormer', role: 'Analyse de l\'intention et identification des marchés cibles...', avatar: '🧠', color: '#7b39fc' },
  { name: 'ChefProjet', role: 'Définition des contraintes et architecture de la stratégie...', avatar: '📋', color: '#6366f1' },
  { name: 'Architecte', role: 'Construction du modèle mathématique et des indicateurs...', avatar: '⚙️', color: '#0891B2' },
  { name: 'Codeur', role: 'Génération du code Python VectorBT optimisé...', avatar: '💻', color: '#059669' },
  { name: 'Sandbox', role: 'Exécution du backtest sur données de marché réelles...', avatar: '🔬', color: '#D97706' },
  { name: 'Critique', role: 'Validation des résultats et détection des biais statistiques...', avatar: '🎯', color: '#DC2626' },
];

interface AgentMessage {
  agent: typeof AGENTS[0];
  done: boolean;
}

export default function Chat({ onResult }: ChatProps) {
  const [intent, setIntent] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const elapsedRef = useRef(0);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (loading) {
      elapsedRef.current = 0;
      setElapsed(0);
      setMessages([{ agent: AGENTS[0], done: false }]);

      interval = setInterval(() => {
        elapsedRef.current += 1;
        setElapsed(elapsedRef.current);
        const agentIdx = Math.min(Math.floor(elapsedRef.current / 15), AGENTS.length - 1);

        setMessages(prev => {
          const newMessages = [...prev];
          // Marquer le dernier comme done
          if (newMessages.length > 0) {
            newMessages[newMessages.length - 1] = { ...newMessages[newMessages.length - 1], done: true };
          }
          // Ajouter le prochain agent si pas encore présent
          if (agentIdx >= newMessages.length && agentIdx < AGENTS.length) {
            newMessages.push({ agent: AGENTS[agentIdx], done: false });
          }
          return newMessages;
        });
      }, 1000);
    } else {
      setMessages(prev => prev.map(m => ({ ...m, done: true })));
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleAnalyse = async () => {
    if (!intent.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);
    setMessages([]);
    try {
      const res = await fetch('https://quantgenesis-platform-production.up.railway.app/api/pipeline/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent }),
      });
      if (!res.ok) {
        if (res.status === 429) {
          const retryAfter = res.headers.get('Retry-After');
          const minutes = retryAfter ? Math.ceil(Number(retryAfter) / 60) : 5;
          setError(`⏱ Limite atteinte — réessaie dans ${minutes} min.`);
        } else if (res.status === 500) {
          setError('Erreur serveur (500) — réessaie dans quelques instants.');
        } else if (res.status === 503) {
          setError('Service indisponible (503) — réessaie dans 1 min.');
        } else {
          setError(`Erreur ${res.status}`);
        }
        return;
      }
      const data: BacktestResult = await res.json();
      setResult(data);
      onResult(data);
      try {
        const entry = {
          id: `${Date.now()}`,
          savedAt: new Date().toISOString(),
          intent: data.intent || intent,
          strategy_name: data.strategy_name || data.intent || intent,
          status: data.status,
          metrics: data.metrics,
          full: data,
        };
        const raw = localStorage.getItem('qg_strategy_history');
        const prev = raw ? JSON.parse(raw) : [];
        const updated = [entry, ...prev].slice(0, 10);
        localStorage.setItem('qg_strategy_history', JSON.stringify(updated));
        window.dispatchEvent(new Event('qg_history_updated'));
      } catch {}
    } catch {
      setError('Connexion impossible — vérifie ta connexion.');
    } finally {
      setLoading(false);
    }
  };

  const getWarning = (metrics: BacktestResult['metrics']) => {
    if (metrics.sharpe_ratio > 5) return '⚠️ Sharpe > 5 — possible overfitting';
    if (metrics.max_drawdown_pct === 0) return '⚠️ Drawdown nul — vérifier les données';
    if (metrics.num_trades < 5) return '⚠️ Trop peu de trades pour être significatif';
    if (metrics.win_rate_pct > 90) return '⚠️ Win rate trop élevé — possible look-ahead bias';
    return null;
  };

  const isFallback = result?.backtest?.status === 'FALLBACK' || result?.status === 'FALLBACK';
  const progressPct = Math.min((elapsed / 90) * 100, 98);
  const examples = ['momentum Bitcoin drawdown 10%', 'ETH RSI 14 mean reversion', 'BTC/ETH ratio trading'];

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(10,8,20,0.7)', border: '1px solid rgba(123,57,252,0.2)', backdropFilter: 'blur(24px)' }}>

      {/* Header */}
      <div className="px-6 py-4 flex items-center gap-3"
        style={{ borderBottom: '1px solid rgba(123,57,252,0.12)', background: 'rgba(123,57,252,0.05)' }}>
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="text-sm font-semibold text-white" style={{ fontFamily: 'Manrope' }}>Pipeline IA — 6 agents</span>
        <span className="ml-auto text-xs" style={{ color: '#555', fontFamily: 'Inter' }}>QuantGenesis v1</span>
      </div>

      <div className="p-6">
        {/* Exemples */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {examples.map((ex) => (
            <button key={ex} onClick={() => setIntent(ex)}
              className="text-xs px-3 py-1.5 rounded-full transition-all hover:scale-105"
              style={{ background: 'rgba(123,57,252,0.12)', color: '#a78bfa', border: '1px solid rgba(123,57,252,0.25)', fontFamily: 'Manrope' }}>
              {ex}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="flex gap-3 mb-6">
          <input
            className="flex-1 rounded-xl px-4 py-3 text-sm text-white outline-none transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(123,57,252,0.25)', fontFamily: 'Inter' }}
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            placeholder="Décris ta stratégie en français..."
            disabled={loading}
            onKeyDown={(e) => e.key === 'Enter' && handleAnalyse()}
          />
          <button onClick={handleAnalyse} disabled={loading}
            className="px-6 py-3 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-40 hover:scale-105"
            style={{ background: '#7b39fc', fontFamily: 'Manrope', boxShadow: loading ? 'none' : '0 0 25px rgba(123,57,252,0.4)' }}>
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Analyse...
              </span>
            ) : 'Analyser →'}
          </button>
        </div>

        {/* Agent messages */}
        {messages.length > 0 && (
          <div className="mb-5 flex flex-col gap-2.5">
            {messages.map((msg, i) => (
              <div key={i} className="flex items-start gap-3 animate-fade-slide">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 mt-0.5"
                  style={{ background: `${msg.agent.color}20`, border: `1px solid ${msg.agent.color}40` }}>
                  {msg.agent.avatar}
                </div>
                <div className="flex-1 rounded-xl px-4 py-3"
                  style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${msg.agent.color}20` }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold" style={{ color: msg.agent.color, fontFamily: 'Manrope' }}>
                      {msg.agent.name}
                    </span>
                    {msg.done
                      ? <span className="text-xs" style={{ color: '#22c55e' }}>✓ Complété</span>
                      : <span className="flex gap-1 ml-1">
                          {[0, 1, 2].map(d => (
                            <span key={d} className="w-1 h-1 rounded-full animate-bounce inline-block"
                              style={{ background: msg.agent.color, animationDelay: `${d * 0.15}s` }} />
                          ))}
                        </span>
                    }
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: '#8899AA', fontFamily: 'Inter' }}>
                    {msg.agent.role}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Progress bar */}
        {loading && (
          <div className="mb-5">
            <div className="flex justify-between text-xs mb-2" style={{ color: '#555', fontFamily: 'Inter' }}>
              <span>Progression du pipeline</span>
              <span>{elapsed}s — ~90s estimé</span>
            </div>
            <div className="w-full rounded-full h-1" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="h-1 rounded-full transition-all duration-1000"
                style={{ background: 'linear-gradient(90deg, #7b39fc, #06B6D4)', width: `${progressPct}%`, boxShadow: '0 0 10px rgba(123,57,252,0.6)' }} />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-3 rounded-xl text-sm mb-4"
            style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', color: '#F87171', fontFamily: 'Inter' }}>
            {error}
          </div>
        )}

        {/* Fallback */}
        {result && isFallback && (
          <div className="p-3 rounded-xl text-sm mb-4"
            style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.25)', color: '#FAC775', fontFamily: 'Inter' }}>
            ⚠️ Stratégie de secours (FALLBACK) — métriques partielles.
          </div>
        )}

        {/* Résultats */}
        {result && (
          <div className="mt-2 animate-fade-slide">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-white font-bold" style={{ fontFamily: 'Manrope' }}>
                  {result.strategy_name || result.intent || 'Résultats'}
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#555', fontFamily: 'Inter' }}>Backtest terminé</p>
              </div>
              <span className="text-xs px-3 py-1.5 rounded-full font-semibold"
                style={{
                  background: isFallback ? 'rgba(217,119,6,0.15)' : 'rgba(123,57,252,0.15)',
                  color: isFallback ? '#FAC775' : '#a78bfa',
                  border: `1px solid ${isFallback ? 'rgba(217,119,6,0.3)' : 'rgba(123,57,252,0.3)'}`,
                  fontFamily: 'Manrope',
                }}>
                {result.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Sharpe Ratio', value: result.metrics.sharpe_ratio, color: '#a78bfa', icon: '📈' },
                { label: 'Max Drawdown', value: `-${Math.abs(result.metrics.max_drawdown_pct)}%`, color: '#F87171', icon: '📉' },
                { label: 'Total Return', value: `+${result.metrics.total_return_pct}%`, color: '#22c55e', icon: '💰' },
                { label: 'Win Rate', value: `${result.metrics.win_rate_pct}%`, color: '#06B6D4', icon: '🎯' },
              ].map((m) => (
                <div key={m.label} className="rounded-xl p-4 transition-all hover:scale-[1.02]"
                  style={{ background: 'rgba(123,57,252,0.06)', border: '1px solid rgba(123,57,252,0.15)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span>{m.icon}</span>
                    <p className="text-xs" style={{ color: '#666', fontFamily: 'Inter' }}>{m.label}</p>
                  </div>
                  <p className="text-2xl font-bold" style={{ color: m.color, fontFamily: 'Manrope' }}>{m.value}</p>
                </div>
              ))}
            </div>

            {getWarning(result.metrics) && (
              <div className="mt-3 p-3 rounded-xl text-xs"
                style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)', color: '#FAC775', fontFamily: 'Inter' }}>
                {getWarning(result.metrics)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}