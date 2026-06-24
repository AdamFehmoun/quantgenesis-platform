'use client';
import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  Brain, ClipboardList, Cog, Code2, Scale, Target,
  Coins, TrendingUp, TrendingDown, AlertTriangle, Info,
  type LucideIcon,
} from 'lucide-react';
import { BacktestResult } from '../app/page';
import { getTradesCount } from '../lib/metrics';
import Waiting from './Waiting';
import Explanation from './Explanation';

// Écran d'attente plein écran (design « Attente ») pendant un vrai run.
// Mettre à false pour revenir à l'animation inline des 6 agents (préservée).
const USE_WAITING_SCREEN = true;

interface ChatProps {
  onResult: (result: BacktestResult) => void;
}

// API impérative exposée au parent : permet à l'onboarding de lancer le
// pipeline EXISTANT avec un intent construit, sans toucher à sa logique.
export interface ChatHandle {
  start: (intent: string) => void;
}

const AGENTS: { name: string; role: string; Icon: LucideIcon; color: string }[] = [
  { name: 'Brainstormer', role: 'Analyse de l\'intention et identification des marchés cibles...', Icon: Brain, color: '#7b39fc' },
  { name: 'ChefProjet', role: 'Définition des contraintes et architecture de la stratégie...', Icon: ClipboardList, color: '#6366f1' },
  { name: 'Architecte', role: 'Construction du modèle mathématique et des indicateurs...', Icon: Cog, color: '#0891B2' },
  { name: 'Codeur', role: 'Génération du code Python VectorBT optimisé...', Icon: Code2, color: '#059669' },
  { name: 'Conformité', role: 'Vérification de la conformité réglementaire et du log AI Act (Article 12)...', Icon: Scale, color: '#D97706' },
  { name: 'Critique', role: 'Validation des résultats et détection des biais statistiques...', Icon: Target, color: '#DC2626' },
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

// --- Pédagogie des métriques : tooltips + badges qualitatifs --------------
// Explications COURTES en français affichées via une icône "i" (survol + clic,
// robuste sur tactile). Aucune logique de données : on lit les valeurs backend.

type QualTone = 'good' | 'mid' | 'bad';
interface QualBadge { label: string; tone: QualTone; }

const TONE_STYLE: Record<QualTone, { color: string; bg: string; border: string }> = {
  good: { color: '#22c55e', bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.45)' },
  mid:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.45)' },
  bad:  { color: '#F87171', bg: 'rgba(248,113,113,0.15)', border: 'rgba(248,113,113,0.45)' },
};

function sharpeBadge(v: number): QualBadge {
  if (v >= 1) return { label: 'Bon', tone: 'good' };
  if (v >= 0) return { label: 'Moyen', tone: 'mid' };
  return { label: 'Faible', tone: 'bad' };
}
function drawdownBadge(v: number): QualBadge {
  const dd = Math.abs(v);
  if (dd < 15) return { label: 'Maîtrisé', tone: 'good' };
  if (dd <= 30) return { label: 'Modéré', tone: 'mid' };
  return { label: 'Élevé', tone: 'bad' };
}
function winRateBadge(v: number): QualBadge {
  if (v >= 55) return { label: 'Bon', tone: 'good' };
  if (v >= 45) return { label: 'Moyen', tone: 'mid' };
  return { label: 'Faible', tone: 'bad' };
}

// Badge qualitatif coloré, lisible de loin (pour le stand).
function QualBadgeChip({ badge }: { badge: QualBadge }) {
  const t = TONE_STYLE[badge.tone];
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
      style={{ background: t.bg, color: t.color, border: `1px solid ${t.border}`, fontFamily: 'Manrope' }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.color, boxShadow: `0 0 6px ${t.color}` }} />
      {badge.label}
    </span>
  );
}

// Icône "i" + bulle d'explication. Survol (desktop) ET clic (tactile/mobile).
function InfoTooltip({ text, placement = 'top' }: { text: string; placement?: 'top' | 'bottom' }) {
  const [open, setOpen] = useState(false);
  const pos: React.CSSProperties = placement === 'top'
    ? { bottom: 'calc(100% + 8px)' }
    : { top: 'calc(100% + 8px)' };
  return (
    <span className="relative inline-flex items-center"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}>
      <button type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        aria-label="Explication"
        className="inline-flex items-center justify-center transition-opacity hover:opacity-100"
        style={{ opacity: 0.55, cursor: 'help', background: 'transparent', lineHeight: 0 }}>
        <Info size={13} color="#a78bfa" strokeWidth={2} />
      </button>
      {open && (
        <span role="tooltip"
          className="absolute z-50 left-1/2 -translate-x-1/2 px-3 py-2 rounded-lg text-left normal-case"
          style={{
            ...pos,
            width: 210,
            background: 'rgba(10,8,20,0.97)',
            border: '1px solid rgba(123,57,252,0.45)',
            color: 'rgba(244,243,248,0.88)',
            fontFamily: 'Inter',
            fontSize: 11,
            fontWeight: 400,
            letterSpacing: 'normal',
            lineHeight: 1.5,
            boxShadow: '0 8px 24px rgba(0,0,0,0.55)',
            backdropFilter: 'blur(12px)',
          }}>
          {text}
        </span>
      )}
    </span>
  );
}

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

function getWarning(result: BacktestResult): string | null {
  const metrics = result.metrics;
  if (!metrics) return null;
  if (metrics.sharpe_ratio > 5) return '⚠️ Sharpe > 5 — possible overfitting';
  if (metrics.max_drawdown_pct === 0) return '⚠️ Drawdown nul — vérifier les données';
  const trades = getTradesCount(result);
  if (trades !== null && trades < 5) return '⚠️ Trop peu de trades pour être significatif';
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
        const warning = getWarning(r);
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

function ChatInner({ onResult }: ChatProps, ref: React.Ref<ChatHandle>) {
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
  // Vrai run déjà déclenché ? → coupe l'ambiance et empêche toute reprise.
  const startedRealRunRef = useRef(false);
  // Jeton de la boucle d'ambiance : tout incrément invalide les timers en vol.
  const ambianceTokenRef = useRef(0);

  // Auto-scroll — UNIQUEMENT pour un vrai run (pas en mode ambiance, pour ne
  // pas tirer le viewport tout seul tant que personne n'a interagi).
  useEffect(() => {
    if (!startedRealRunRef.current) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // --- MODE AMBIANCE (état "vierge" initial) -------------------------------
  // Boucle PUREMENT visuelle : AUCUN fetch, AUCUN appel réseau. Les 6 agents
  // s'illuminent à tour de rôle avec leur phrase générique + effet typing, en
  // boucle douce — exactement le rendu de la vraie démo, mais sans run.
  // S'active seulement tant qu'aucun vrai run n'a été lancé et qu'aucun
  // résultat/erreur n'est affiché. Se coupe net dès handleAnalyse et au unmount.
  useEffect(() => {
    if (startedRealRunRef.current) return;   // un vrai run a eu lieu → jamais de reprise
    if (loading || result || error) return;  // vrai run en cours / résultat affiché

    const myToken = ++ambianceTokenRef.current;
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const alive = () => ambianceTokenRef.current === myToken && !startedRealRunRef.current;
    const at = (fn: () => void, ms: number) => {
      timeouts.push(setTimeout(() => { if (alive()) fn(); }, ms));
    };

    const cycle = () => {
      if (!alive()) return;
      setMessages([]);
      AGENTS.forEach((agent, i) => {
        at(() => {
          setMessages((prev) => {
            const next = prev.map((m) => ({ ...m, done: true }));
            next.push({ agent, done: false, text: '', fullText: agent.role });
            return next;
          });
        }, i * AGENT_INTERVAL);
      });
      // Pause sur le dernier agent (le temps qu'il finisse de "taper"), puis relance.
      at(cycle, AGENTS.length * AGENT_INTERVAL + 2200);
    };

    cycle();

    return () => {
      ambianceTokenRef.current++;        // invalide les timers en vol
      timeouts.forEach(clearTimeout);    // pas de fuite, pas de double boucle
    };
  }, [loading, result, error]);

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
    if (!result && !error) return; // pas encore de réponse
    // Avec l'écran d'attente : on révèle DÈS que la réponse arrive (cache 0,3s
    // comme run 2min30) — l'attente s'auto-anime, aucune durée fixe à attendre,
    // et son démontage coupe net l'animation. Sans écran d'attente : on conserve
    // l'ancien comportement (attendre la fin de l'animation inline).
    if (!USE_WAITING_SCREEN && !animationDone) return;
    setMessages((prev) =>
      USE_WAITING_SCREEN
        ? AGENTS.map((agent) => ({ agent, done: true, text: agent.role, fullText: agent.role }))
        : prev.map((m) => ({ ...m, done: true })),
    );
    setRevealed(true);
    setLoading(false);
  }, [animationDone, result, error]);

  const handleAnalyse = async (intentOverride?: string) => {
    // intentOverride (string) = lancement piloté par l'onboarding. Sinon on lit
    // l'input local. Garde sur le typeof : onClick passe un événement, pas un intent.
    const source = typeof intentOverride === 'string' ? intentOverride : intent;
    const effectiveIntent = source.trim();
    if (!effectiveIntent || loading) return;
    if (typeof intentOverride === 'string') setIntent(effectiveIntent);
    // Coupe immédiatement la boucle d'ambiance et empêche toute reprise future.
    startedRealRunRef.current = true;
    ambianceTokenRef.current++;
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
          body: JSON.stringify({ intent: effectiveIntent }),
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
            intent: data.intent || effectiveIntent,
            strategy_name: data.strategy_name || data.intent || effectiveIntent,
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

    // (b) Animation des agents. Avec l'écran d'attente actif, Waiting.tsx gère
    // TOUTE l'animation en boucle continue → on ne lance pas l'animation inline
    // (qui avait une durée fixe et figeait en fin de course).
    const animation = (async () => {
      if (USE_WAITING_SCREEN) return;
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

  // Le parent (onboarding) déclenche le pipeline existant via cette poignée.
  useImperativeHandle(ref, () => ({
    start: (i: string) => { void handleAnalyse(i); },
  }));

  const isFallback = !!result && (result.backtest?.status === 'FALLBACK' || result.status === 'FALLBACK');
  const totalAgents = AGENTS.length;
  const doneCount = messages.filter((m) => m.done).length;
  const progressPct = revealed ? 100 : Math.min(Math.round((doneCount / totalAgents) * 100), 95);
  // --- Écran d'attente plein écran : monté tant qu'un vrai run est en cours,
  // démonté dès la révélation (Waiting s'auto-anime et se coupe à son démontage).
  const showWaiting = USE_WAITING_SCREEN && loading && startedRealRunRef.current && !revealed;
  // Résultats affichés → on masque tout le « chrome » du pipeline (titre, chips,
  // champ Analyser, liste des 6 agents « ✓ Complété ») : doublon inutile au-dessus
  // des résultats. Relance possible via « + Nouvelle stratégie » (navbar).
  const showResults = revealed && !!result;
  const examples = ['momentum Bitcoin drawdown 10%', 'ETH RSI 14 mean reversion', 'BTC/ETH ratio trading'];

  return (
    <>
    {showWaiting && (
      <Waiting agents={AGENTS.map((a) => ({ name: a.name, color: a.color, Icon: a.Icon }))} />
    )}
    <div className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)', boxShadow: '0 10px 40px rgba(0,0,0,0.35)' }}>

      {/* Header — masqué une fois les résultats affichés (doublon inutile) */}
      {!showResults && (
      <div className="px-6 py-4 flex items-center gap-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(123,57,252,0.05)' }}>
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="text-sm font-semibold text-white" style={{ fontFamily: 'Manrope' }}>Pipeline IA — 6 agents</span>
        <span className="ml-auto text-xs" style={{ color: '#555', fontFamily: 'Inter' }}>QuantClarity v1</span>
      </div>
      )}

      <div className="p-6">
        {/* Exemples + champ Analyser — masqués quand les résultats sont là (relance
            via « + Nouvelle stratégie » dans la navbar). */}
        {!showResults && (
        <>
        {/* Exemples */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {examples.map((ex) => (
            <button key={ex} onClick={() => setIntent(ex)}
              className="text-xs px-3 py-1.5 rounded-full transition-all"
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
          <button onClick={() => handleAnalyse()} disabled={loading}
            className="px-6 py-3 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-40 hover:scale-105"
            style={{ background: '#7b39fc', fontFamily: 'Manrope', boxShadow: loading ? 'none' : '0 0 12px rgba(123,57,252,0.4)' }}>
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

        {/* Agent messages — le "chat live", cœur du spectacle */}
        {messages.length > 0 && (
          <div className="mb-6 flex flex-col gap-3">
            {messages.map((msg, i) => {
              const active = !msg.done; // l'agent qui "parle" en ce moment
              return (
                <div key={i}
                  className="flex items-start animate-fade-slide transition-all duration-500"
                  style={{
                    gap: active ? '16px' : '12px',
                    opacity: active ? 1 : 0.5,
                    transform: active ? 'scale(1)' : 'scale(0.985)',
                    filter: active ? 'none' : 'saturate(0.7)',
                  }}>
                  {/* Avatar — l'actif est plus grand et pulse */}
                  <div className={`rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500 ${active ? 'avatar-pulse mt-0.5' : 'mt-1'}`}
                    style={{
                      width: active ? '44px' : '32px',
                      height: active ? '44px' : '32px',
                      background: active ? `${msg.agent.color}2e` : `${msg.agent.color}18`,
                      border: `1px solid ${msg.agent.color}${active ? '80' : '33'}`,
                    }}>
                    {(() => {
                      const Icon = msg.agent.Icon;
                      return <Icon size={active ? 22 : 15} color={msg.agent.color} strokeWidth={2} />;
                    })()}
                  </div>
                  {/* Bulle — l'actif a un halo lumineux animé, le complété est discret */}
                  <div className={`flex-1 rounded-xl transition-all duration-500 ${active ? 'active-agent' : ''}`}
                    style={{
                      padding: active ? '14px 18px' : '10px 16px',
                      background: active ? 'rgba(123,57,252,0.10)' : 'rgba(255,255,255,0.025)',
                      border: `1px solid ${active ? 'rgba(123,57,252,0.55)' : `${msg.agent.color}1a`}`,
                    }}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="font-bold" style={{ color: msg.agent.color, fontFamily: 'Manrope', fontSize: active ? '14px' : '12px' }}>
                        {msg.agent.name}
                      </span>
                      {msg.done
                        ? <span className="text-xs" style={{ color: '#22c55e' }}>✓ Complété</span>
                        : <span className="flex items-center gap-1.5 ml-1">
                            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                              style={{ background: `${msg.agent.color}22`, color: msg.agent.color, fontFamily: 'Manrope' }}>
                              En cours
                            </span>
                            <span className="flex gap-1">
                              {[0, 1, 2].map(d => (
                                <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce inline-block"
                                  style={{ background: msg.agent.color, animationDelay: `${d * 0.15}s` }} />
                              ))}
                            </span>
                          </span>
                      }
                    </div>
                    <p className="leading-relaxed" style={{ color: active ? '#c9d3e0' : '#7a899c', fontFamily: 'Inter', fontSize: active ? '13px' : '12px' }}>
                      {msg.text}
                      {msg.text !== msg.fullText && (
                        <span className="inline-block animate-pulse" style={{ color: msg.agent.color }}>▋</span>
                      )}
                    </p>
                  </div>
                </div>
              );
            })}
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
                style={{ background: 'linear-gradient(90deg, #7b39fc, #06B6D4)', width: `${progressPct}%`, boxShadow: '0 0 5px rgba(123,57,252,0.6)' }} />
            </div>
          </div>
        )}
        </>
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
            <span className="flex items-center gap-2">
              <AlertTriangle size={15} color="#FAC775" strokeWidth={2} className="flex-shrink-0" />
              Stratégie de secours (FALLBACK) — métriques partielles.
            </span>
          </div>
        )}

        {/* Résultats — affichés seulement après reveal (max anim/réponse) */}
        {revealed && result && (
          <div className="mt-2 animate-fade-slide">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-1" style={{ color: '#06B6D4', fontFamily: 'Manrope' }}>
                  Résultats du backtest
                </p>
                <p className="text-white font-bold text-lg" style={{ fontFamily: 'Manrope' }}>
                  {result.strategy_name || result.intent || 'Résultats'}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(244,243,248,0.5)', fontFamily: 'Inter' }}>
                  Backtest terminé · {getTradesCount(result) ?? 'n/a'} trades
                </p>
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

            {/* HERO METRIC — Total Return, le chiffre que le jury regarde */}
            {(() => {
              const tr = result.metrics.total_return_pct;
              // Défensif (cf. lib/metrics.ts) : null/undefined/NaN en FALLBACK/ERROR.
              const hasTr = typeof tr === 'number' && Number.isFinite(tr);
              const positive = hasTr && tr >= 0;
              const accent = !hasTr ? '#9aa7b8' : positive ? '#22c55e' : '#F87171';
              return (
                <div className="rounded-2xl p-7 mb-4 relative overflow-hidden animate-metric-pop"
                  style={{
                    background: `linear-gradient(135deg, ${!hasTr ? 'rgba(154,167,184,0.08)' : positive ? 'rgba(34,197,94,0.10)' : 'rgba(248,113,113,0.10)'} 0%, rgba(123,57,252,0.06) 100%)`,
                    border: `1px solid ${!hasTr ? 'rgba(154,167,184,0.28)' : positive ? 'rgba(34,197,94,0.28)' : 'rgba(248,113,113,0.28)'}`,
                  }}>
                  {/* glow décoratif */}
                  <div className="absolute pointer-events-none" style={{
                    top: '-40%', right: '-10%', width: '320px', height: '320px', borderRadius: '50%',
                    background: `radial-gradient(circle, ${!hasTr ? 'rgba(154,167,184,0.16)' : positive ? 'rgba(34,197,94,0.18)' : 'rgba(248,113,113,0.18)'} 0%, transparent 70%)`,
                    filter: 'blur(20px)',
                  }} />
                  <div className="relative flex items-end justify-between flex-wrap gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Coins size={20} color="#9aa7b8" strokeWidth={2} />
                        <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: '#9aa7b8', fontFamily: 'Manrope' }}>
                          Total Return
                        </p>
                        <InfoTooltip text="Le gain (ou la perte) total sur toute la période testée." placement="bottom" />
                      </div>
                      <p className={`font-bold leading-none ${positive ? 'hero-number-glow' : ''}`}
                        style={{ color: accent, fontFamily: 'Manrope', fontSize: 'clamp(3.2rem, 9vw, 5rem)', letterSpacing: '-0.03em' }}>
                        {hasTr
                          ? <>{positive ? '+' : ''}{tr}<span style={{ fontSize: '0.4em', opacity: 0.7 }}>%</span></>
                          : '—'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs mb-1" style={{ color: '#667', fontFamily: 'Inter' }}>Performance globale</p>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold"
                        style={{ background: `${accent}1f`, color: accent, border: `1px solid ${accent}55`, fontFamily: 'Manrope' }}>
                        {!hasTr ? 'n/a' : positive ? '▲ Gain' : '▼ Perte'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* EXPLICATION — résumé conformité + interprétation FR des métriques */}
            <Explanation result={result} />

            {/* MÉTRIQUES SECONDAIRES — tooltips pédagogiques + badges qualitatifs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  label: 'Sharpe Ratio', Icon: TrendingUp, color: '#a78bfa',
                  // Défensif (cf. lib/metrics.ts) : null/NaN en FALLBACK/ERROR → "—".
                  has: Number.isFinite(result.metrics.sharpe_ratio),
                  value: `${result.metrics.sharpe_ratio}`,
                  info: 'Mesure si les gains valent le risque pris. Au-dessus de 1 = bon, négatif = mauvais.',
                  badge: sharpeBadge(result.metrics.sharpe_ratio),
                },
                {
                  label: 'Max Drawdown', Icon: TrendingDown, color: '#F87171',
                  has: Number.isFinite(result.metrics.max_drawdown_pct),
                  value: `-${Math.abs(result.metrics.max_drawdown_pct)}%`,
                  info: 'La pire perte subie depuis un sommet. Plus c\'est petit (proche de 0), mieux c\'est.',
                  badge: drawdownBadge(result.metrics.max_drawdown_pct),
                },
                {
                  label: 'Win Rate', Icon: Target, color: '#06B6D4',
                  has: Number.isFinite(result.metrics.win_rate_pct),
                  value: `${result.metrics.win_rate_pct}%`,
                  info: 'Le pourcentage de trades gagnants.',
                  badge: winRateBadge(result.metrics.win_rate_pct),
                },
              ].map((m, idx) => {
                const Icon = m.Icon;
                return (
                <div key={m.label} className="rounded-xl p-5 transition-all hover:scale-[1.03] animate-metric-pop"
                  style={{
                    background: `linear-gradient(160deg, ${m.color}10 0%, rgba(255,255,255,0.02) 100%)`,
                    border: `1px solid ${m.color}2e`,
                    animationDelay: `${0.08 * (idx + 1)}s`,
                  }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Icon size={16} color={m.color} strokeWidth={2} />
                    <p className="text-xs font-medium" style={{ color: '#8a96a8', fontFamily: 'Inter' }}>{m.label}</p>
                    <InfoTooltip text={m.info} />
                  </div>
                  <p className="font-bold mb-3" style={{ color: m.has ? m.color : '#9aa7b8', fontFamily: 'Manrope', fontSize: '2.1rem', letterSpacing: '-0.02em', textShadow: m.has ? `0 0 12px ${m.color}55` : 'none' }}>
                    {m.has ? m.value : '—'}
                  </p>
                  {/* badge qualitatif — masqué si la métrique est absente (FALLBACK/ERROR) */}
                  {m.has && <QualBadgeChip badge={m.badge} />}
                </div>
                );
              })}
            </div>

            {getWarning(result) && (
              <div className="mt-4 p-3 rounded-xl text-xs"
                style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)', color: '#FAC775', fontFamily: 'Inter' }}>
                {getWarning(result)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    </>
  );
}

const Chat = forwardRef(ChatInner);
export default Chat;
