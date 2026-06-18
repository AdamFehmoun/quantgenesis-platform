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
  { name: 'Conformité', role: 'Vérification de la conformité réglementaire et du log AI Act (Article 12)...', avatar: '⚖️', color: '#D97706' },
  { name: 'Critique', role: 'Validation des résultats et détection des biais statistiques...', avatar: '🎯', color: '#DC2626' },
];

type Agent = (typeof AGENTS)[number];

interface AgentMessage {
  agent: Agent;
  done: boolean;
  text: string;     // texte actuellement affiché (animé caractère par caractère)
  fullText: string; // texte cible à atteindre
}

// --- Rythme de l'animation (indépendant du réseau / du cache Redis) ---
const AGENT_INTERVAL = 1800; // ms par agent → ~10.8s pour les 6
const TYPING_SPEED = 18;     // ms par tick de "typing"
const TYPING_CHUNK = 2;      // caractères ajoutés par tick

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// --- Helpers d'extraction défensifs (chaque champ peut être absent) ---
function pickString(obj: unknown, keys: string[]): string | null {
  if (!obj || typeof obj !== 'object') return null;
  const rec = obj as Record<string, unknown>;
  for (const k of keys) {
    const val = rec[k];
    if (typeof val === 'string' && val.trim()) return val.trim();
    if (typeof val === 'number' && Number.isFinite(val)) return String(val);
    if (Array.isArray(val)) {
      const strs = val.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
      if (strs.length) return strs.join(', ');
    }
  }
  return null;
}

function traceFor(r: BacktestResult, name: string): string | null {
  const dt = r.compliance_log?.decision_trace;
  if (!dt || typeof dt !== 'object') return null;
  const val = (dt as Record<string, unknown>)[name];
  if (val == null) return null;
  if (typeof val === 'string') return val.trim() || null;
  if (typeof val === 'object') {
    const summary = pickString(val, ['summary', 'decision', 'rationale', 'description', 'result', 'output']);
    if (summary) return summary;
    const str = JSON.stringify(val);
    return str.length > 140 ? str.slice(0, 140) + '…' : str;
  }
  return String(val);
}

function getWarning(metrics: BacktestResult['metrics']): string | null {
  if (!metrics) return null;
  if (metrics.sharpe_ratio > 5) return '⚠️ Sharpe > 5 — possible overfitting';
  if (metrics.max_drawdown_pct === 0) return '⚠️ Drawdown nul — vérifier les données';
  if (metrics.num_trades < 5) return '⚠️ Trop peu de trades pour être significatif';
  if (metrics.win_rate_pct > 90) return '⚠️ Win rate trop élevé — possible look-ahead bias';
  return null;
}

// Contenu réel best-effort pour un agent. Retourne null si rien d'exploitable
// → l'appelant retombe alors sur la phrase générique de l'agent.
function enrichAgent(name: string, r: BacktestResult): string | null {
  try {
    switch (name) {
      case 'Brainstormer':
      case 'ChefProjet':
      case 'Architecte': {
        const trace = traceFor(r, name);
        if (trace) return trace;
        const arch = r.final_spec?.architecture;
        const asset = pickString(arch, ['asset', 'assets', 'symbol', 'symbols', 'market', 'markets', 'ticker', 'pair']);
        const indicator = pickString(arch, ['indicator', 'indicators', 'signal', 'signals', 'strategy_type', 'type', 'logic']);
        const parts: string[] = [];
        if (asset) parts.push(`Actif : ${asset}`);
        if (indicator) parts.push(`Indicateur : ${indicator}`);
        if (parts.length) return parts.join(' · ');
        const fns = r.final_spec?.functions;
        const fnCount = Array.isArray(fns) ? fns.length : 0;
        if (fnCount > 0) return `Spécification produite — ${fnCount} fonction${fnCount > 1 ? 's' : ''} définie${fnCount > 1 ? 's' : ''}.`;
        return null;
      }
      case 'Codeur': {
        const code = r.backtest?.generated_code;
        if (typeof code === 'string' && code.trim()) {
          const n = code.split('\n').length;
          return `Code généré (${n} ligne${n > 1 ? 's' : ''}) — VectorBT prêt à l'exécution.`;
        }
        return null;
      }
      case 'Conformité': {
        const cl = r.compliance_log;
        if (!cl) return null;
        const status = pickString(cl.compliance_record, ['status', 'ai_act_status', 'compliance_status', 'verdict', 'article_12']);
        if (status) return `Conformité AI Act : ${status}.`;
        if (cl.compliance_record || cl.decision_trace) return 'Log de conformité AI Act (Article 12) enregistré.';
        return null;
      }
      case 'Critique': {
        const warning = getWarning(r.metrics);
        if (warning) return `${r.status || 'Validé'} — ${warning.replace(/^⚠️\s*/, '')}`;
        if (r.status) return `Verdict : ${r.status}.`;
        return null;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export default function Chat({ onResult }: ChatProps) {
  const [intent, setIntent] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [animationDone, setAnimationDone] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const runIdRef = useRef(0);
  const errorRef = useRef<string | null>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Effet "typing" : fait converger text → fullText pour chaque message.
  useEffect(() => {
    const pending = messages.some((m) => m.text !== m.fullText);
    if (!pending) return;
    const id = setInterval(() => {
      setMessages((prev) => {
        let changed = false;
        const next = prev.map((m) => {
          if (m.text === m.fullText) return m;
          changed = true;
          const nextLen = Math.min(m.fullText.length, m.text.length + TYPING_CHUNK);
          return { ...m, text: m.fullText.slice(0, nextLen) };
        });
        return changed ? next : prev;
      });
    }, TYPING_SPEED);
    return () => clearInterval(id);
  }, [messages]);

  // Enrichissement : dès que la réponse est là, chaque agent "done" reçoit son
  // vrai contenu (sinon il garde sa phrase générique). Re-typing déclenché en
  // remettant text à '' uniquement quand la cible change réellement.
  useEffect(() => {
    if (!result) return;
    setMessages((prev) => {
      let changed = false;
      const next = prev.map((m) => {
        if (!m.done) return m;
        const enriched = enrichAgent(m.agent.name, result);
        const target = enriched ?? m.agent.role;
        if (m.fullText !== target) {
          changed = true;
          return { ...m, fullText: target, text: '' };
        }
        return m;
      });
      return changed ? next : prev;
    });
  }, [result, messages]);

  // Révélation des résultats = max(fin d'animation, arrivée de la réponse/erreur).
  useEffect(() => {
    if (!animationDone) return;
    if (!result && !error) return; // MISS lent : on attend encore la réponse
    setMessages((prev) => prev.map((m) => ({ ...m, done: true })));
    setRevealed(true);
    setLoading(false);
  }, [animationDone, result, error]);

  const handleAnalyse = async () => {
    if (!intent.trim() || loading) return;
    const myRun = ++runIdRef.current;
    errorRef.current = null;
    setLoading(true);
    setResult(null);
    setError(null);
    setRevealed(false);
    setAnimationDone(false);
    setMessages([]);

    // (a) Appel API — fetch POST classique, attend la réponse complète.
    const apiCall = (async () => {
      try {
        const res = await fetch('https://quantgenesis-platform-production.up.railway.app/api/pipeline/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ intent }),
        });
        if (runIdRef.current !== myRun) return;
        if (!res.ok) {
          let msg: string;
          if (res.status === 429) {
            const retryAfter = res.headers.get('Retry-After');
            const minutes = retryAfter ? Math.ceil(Number(retryAfter) / 60) : 5;
            msg = `⏱ Limite atteinte — réessaie dans ${minutes} min.`;
          } else if (res.status === 500) {
            msg = 'Erreur serveur (500) — réessaie dans quelques instants.';
          } else if (res.status === 503) {
            msg = 'Service indisponible (503) — réessaie dans 1 min.';
          } else {
            msg = `Erreur ${res.status}`;
          }
          errorRef.current = msg;
          setError(msg);
          return;
        }
        const data: BacktestResult = await res.json();
        if (runIdRef.current !== myRun) return;
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
        if (runIdRef.current !== myRun) return;
        const msg = 'Connexion impossible — vérifie ta connexion.';
        errorRef.current = msg;
        setError(msg);
      }
    })();

    // (b) Animation — rythme FIXE, totalement indépendante du réseau/cache.
    const animation = (async () => {
      for (let i = 0; i < AGENTS.length; i++) {
        if (runIdRef.current !== myRun) return;
        if (errorRef.current) break; // une erreur API stoppe l'animation
        setMessages((prev) => {
          const next = prev.map((m) => ({ ...m, done: true }));
          next.push({ agent: AGENTS[i], done: false, text: AGENTS[i].role, fullText: AGENTS[i].role });
          return next;
        });
        await sleep(AGENT_INTERVAL);
      }
      if (runIdRef.current === myRun) setAnimationDone(true);
    })();

    await Promise.allSettled([apiCall, animation]);
  };

  const isFallback = !!result && (result.backtest?.status === 'FALLBACK' || result.status === 'FALLBACK');
  const totalAgents = AGENTS.length;
  const doneCount = messages.filter((m) => m.done).length;
  const progressPct = revealed ? 100 : Math.min(Math.round((doneCount / totalAgents) * 100), 95);
  const examples = ['momentum Bitcoin drawdown 10%', 'ETH RSI 14 mean reversion', 'BTC/ETH ratio trading'];

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(10,8,20,0.7)', border: '1px solid rgba(123,57,252,0.2)', backdropFilter: 'blur(24px)' }}>

      {/* Header */}
      <div className="px-6 py-4 flex items-center gap-3"
        style={{ borderBottom: '1px solid rgba(123,57,252,0.12)', background: 'rgba(123,57,252,0.05)' }}>
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="text-sm font-semibold text-white" style={{ fontFamily: 'Manrope' }}>Pipeline IA — 6 agents</span>
        <span className="ml-auto text-xs" style={{ color: '#555', fontFamily: 'Inter' }}>QuantClarity v1</span>
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
                    {msg.text}
                    {msg.text !== msg.fullText && (
                      <span className="inline-block animate-pulse" style={{ color: msg.agent.color }}>▋</span>
                    )}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Progress bar — reflète l'avancement de l'ANIMATION (agents passés) */}
        {loading && (
          <div className="mb-5">
            <div className="flex justify-between text-xs mb-2" style={{ color: '#555', fontFamily: 'Inter' }}>
              <span>{animationDone && !result ? 'Finalisation du backtest…' : 'Progression du pipeline'}</span>
              <span>{doneCount}/{totalAgents} agents</span>
            </div>
            <div className="w-full rounded-full h-1" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="h-1 rounded-full transition-all duration-500"
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
        {revealed && result && isFallback && (
          <div className="p-3 rounded-xl text-sm mb-4"
            style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.25)', color: '#FAC775', fontFamily: 'Inter' }}>
            ⚠️ Stratégie de secours (FALLBACK) — métriques partielles.
          </div>
        )}

        {/* Résultats — affichés seulement après reveal (max anim/réponse) */}
        {revealed && result && (
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
