'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Compass, GraduationCap, Zap, TrendingUp, Repeat, Sparkles,
  Bitcoin, Gem, BarChart3, Shield, Scale, Flame, Calendar, Mountain,
  Coins, Rocket, ArrowRight, Send, RotateCcw,
  type LucideIcon,
} from 'lucide-react';

interface OnboardingProps {
  // Construit l'intent en langage naturel et le passe au flux EXISTANT.
  onLaunch: (intent: string) => void;
}

type Level = 'debute' | 'connais' | 'direct';
interface Opt { Icon: LucideIcon; label: string; value: string }
interface Question { q: string; opts: Opt[] }
interface ChatMsg { role: 'bot' | 'user'; text: string; typing?: boolean }
interface Answer { label: string; value: string }

// Rythme du "chatbot" scripté (aucun réseau, aucune IA).
const TYPING_MS = 750;

// --- Banques de questions : MÊME ordre pour 'debute' et 'connais' (5 étapes).
// Chaque option porte un `value` = mots-clés que le backend comprend.
const QUESTIONS: Record<'debute' | 'connais', Question[]> = {
  debute: [
    {
      q: 'Comment voulez-vous que la stratégie réagisse ?',
      opts: [
        { Icon: TrendingUp, label: 'Suivre les tendances', value: 'suivi de tendance (momentum)' },
        { Icon: Repeat, label: 'Acheter bas, vendre haut', value: 'retour à la moyenne (mean reversion)' },
        { Icon: Sparkles, label: "Laisse l'IA choisir", value: "logique choisie automatiquement par l'IA" },
      ],
    },
    {
      q: 'Sur quel marché ?',
      opts: [
        { Icon: Bitcoin, label: 'Bitcoin', value: 'Bitcoin (BTC)' },
        { Icon: Gem, label: 'Ethereum', value: 'Ethereum (ETH)' },
        { Icon: BarChart3, label: 'Actions US', value: 'actions US' },
      ],
    },
    {
      q: 'Quel niveau de risque ?',
      opts: [
        { Icon: Shield, label: 'Prudent', value: 'prudent' },
        { Icon: Scale, label: 'Équilibré', value: 'équilibré' },
        { Icon: Flame, label: 'Gros risque', value: 'agressif' },
      ],
    },
    {
      q: 'Sur quelle durée ?',
      opts: [
        { Icon: Zap, label: 'Court terme', value: 'court terme' },
        { Icon: Calendar, label: 'Moyen terme', value: 'moyen terme' },
        { Icon: Mountain, label: 'Long terme', value: 'long terme' },
      ],
    },
    {
      q: 'Avec quel capital de test ?',
      opts: [
        { Icon: Coins, label: '10 000 €', value: '10 000 €' },
        { Icon: Coins, label: '100 000 €', value: '100 000 €' },
        { Icon: Coins, label: '1 M€', value: '1 000 000 €' },
      ],
    },
  ],
  connais: [
    {
      q: 'Quel type de signal pour le moteur ?',
      opts: [
        { Icon: TrendingUp, label: 'Momentum / Trend-following', value: 'momentum / suivi de tendance' },
        { Icon: Repeat, label: 'Mean-reversion', value: 'mean reversion (retour à la moyenne)' },
        { Icon: Sparkles, label: "Sélection auto par l'IA", value: "logique choisie automatiquement par l'IA" },
      ],
    },
    {
      q: "Univers d'actifs ?",
      opts: [
        { Icon: Bitcoin, label: 'BTC', value: 'BTC' },
        { Icon: Gem, label: 'ETH', value: 'ETH' },
        { Icon: BarChart3, label: 'US Equities', value: 'actions US (US equities)' },
      ],
    },
    {
      q: 'Profil de risque (volatilité cible) ?',
      opts: [
        { Icon: Shield, label: 'Conservateur', value: 'prudent (conservateur)' },
        { Icon: Scale, label: 'Modéré', value: 'équilibré (modéré)' },
        { Icon: Flame, label: 'Agressif', value: 'agressif' },
      ],
    },
    {
      q: 'Horizon de détention ?',
      opts: [
        { Icon: Zap, label: 'Intraday / Court', value: 'court terme (intraday)' },
        { Icon: Calendar, label: 'Swing / Moyen', value: 'moyen terme (swing)' },
        { Icon: Mountain, label: 'Position / Long', value: 'long terme (position)' },
      ],
    },
    {
      q: 'Capital de backtest ?',
      opts: [
        { Icon: Coins, label: '10 000 €', value: '10 000 €' },
        { Icon: Coins, label: '100 000 €', value: '100 000 €' },
        { Icon: Coins, label: '1 M€', value: '1 000 000 €' },
      ],
    },
  ],
};

const CHIP_LABELS = ['Réaction', 'Marché', 'Risque', 'Durée', 'Capital'];

const WELCOME_CARDS: { Icon: LucideIcon; title: string; sub: string; cta: string; level: Level; accent: string }[] = [
  { Icon: Compass, title: 'Je débute', sub: 'On vous guide pas à pas, en mots simples', cta: 'Commencer', level: 'debute', accent: '#7b39fc' },
  { Icon: GraduationCap, title: "Je m'y connais", sub: 'Guidé, avec le vocabulaire technique', cta: 'Commencer', level: 'connais', accent: '#7b39fc' },
  { Icon: Zap, title: 'Je tape directement', sub: 'Décrivez votre stratégie librement', cta: 'Écrire', level: 'direct', accent: '#06B6D4' },
];

export default function Onboarding({ onLaunch }: OnboardingProps) {
  const [phase, setPhase] = useState<'welcome' | 'chat'>('welcome');
  const [level, setLevel] = useState<Level | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [step, setStep] = useState<number | null>(null);
  const [botTyping, setBotTyping] = useState(false);
  const [done, setDone] = useState(false);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [directDraft, setDirectDraft] = useState('');
  const [lit, setLit] = useState(false);

  // Refs pour lire l'état "frais" dans les enchaînements scriptés (timers).
  const levelRef = useRef<Level | null>(null);
  const answersRef = useRef<Answer[]>([]);
  const notesRef = useRef<string[]>([]);
  const directSentRef = useRef('');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const lightTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const at = (fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, ms)); };

  useEffect(() => () => { clearTimers(); lightTimers.current.forEach(clearTimeout); }, []);

  // Mise en lumière de l'accueil (bloom qui s'allume, en boucle douce).
  useEffect(() => {
    if (phase !== 'welcome') return;
    const push = (fn: () => void, ms: number) => { lightTimers.current.push(setTimeout(fn, ms)); };
    setLit(false);
    push(() => setLit(true), 200);
    const iv = setInterval(() => { setLit(false); push(() => setLit(true), 780); }, 13000);
    return () => { clearInterval(iv); lightTimers.current.forEach(clearTimeout); lightTimers.current = []; };
  }, [phase]);

  // Auto-scroll du fil de chat.
  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, step, done]);

  const botSay = (text: string, cb?: () => void) => {
    setBotTyping(true);
    setMessages((m) => [...m, { role: 'bot', text: '', typing: true }]);
    at(() => {
      setMessages((m) => {
        const n = [...m];
        n[n.length - 1] = { role: 'bot', text, typing: false };
        return n;
      });
      setBotTyping(false);
      cb?.();
    }, TYPING_MS);
  };

  const ask = (i: number, lvl: Level) => {
    if (lvl === 'direct') return;
    const q = QUESTIONS[lvl][i];
    botSay(q.q, () => setStep(i));
  };

  const begin = (lvl: Level) => {
    clearTimers();
    lightTimers.current.forEach(clearTimeout); lightTimers.current = [];
    levelRef.current = lvl;
    answersRef.current = [];
    notesRef.current = [];
    directSentRef.current = '';
    setLevel(lvl);
    setAnswers([]);
    setMessages([]);
    setStep(null);
    setBotTyping(false);
    setDone(false);
    setNoteDraft('');
    setDirectDraft('');
    setPhase('chat');
    if (lvl === 'direct') {
      botSay(
        'Bonjour 👋 Décrivez votre stratégie en quelques mots — marché, style, risque, horizon. Je traduis ça en paramètres pour vos experts.',
        () => setStep(0),
      );
    } else {
      ask(0, lvl);
    }
  };

  const recap = (list: Answer[]) => {
    const a = list;
    const text = `Parfait ! Voici votre stratégie : « ${a[0].label} », profil ${a[2].label.toLowerCase()}, horizon ${a[3].label.toLowerCase()}, sur ${a[1].label}, avec ${a[4].label} de capital de test. On lance vos 6 experts ?`;
    botSay(text, () => setDone(true));
  };

  const answer = (opt: Opt) => {
    const lvl = levelRef.current;
    if (!lvl || lvl === 'direct') return;
    const note = noteDraft.trim();
    const userText = opt.label + (note ? '  ·  ' + note : '');
    const next = [...answersRef.current, { label: opt.label, value: opt.value }];
    answersRef.current = next;
    notesRef.current = [...notesRef.current, note];
    setAnswers(next);
    setMessages((m) => [...m, { role: 'user', text: userText }]);
    setNoteDraft('');
    setStep(null);
    if (next.length <= 4) ask(next.length, lvl);
    else recap(next);
  };

  const sendDirect = () => {
    const v = directDraft.trim();
    if (!v) return;
    directSentRef.current = v;
    setMessages((m) => [...m, { role: 'user', text: v }]);
    setDirectDraft('');
    setStep(null);
    botSay(
      "C'est noté. J'ai traduit votre description en paramètres exploitables — vos 6 experts sont prêts à démarrer.",
      () => setDone(true),
    );
  };

  const buildGuidedIntent = (): string => {
    const a = answersRef.current;
    const notes = notesRef.current.filter(Boolean);
    let intent = `Stratégie ${a[0].value} sur ${a[1].value}, profil ${a[2].value}, horizon ${a[3].value}, avec ${a[4].value} de capital de test.`;
    if (notes.length) intent += ` Précisions : ${notes.join(' ; ')}.`;
    return intent;
  };

  const launch = () => {
    const intent = levelRef.current === 'direct'
      ? directSentRef.current.trim()
      : buildGuidedIntent();
    if (!intent) return;
    onLaunch(intent);
  };

  const reset = () => {
    clearTimers();
    levelRef.current = null;
    answersRef.current = [];
    notesRef.current = [];
    directSentRef.current = '';
    setLevel(null);
    setAnswers([]);
    setMessages([]);
    setStep(null);
    setBotTyping(false);
    setDone(false);
    setNoteDraft('');
    setDirectDraft('');
    setPhase('welcome');
  };

  const isChat = phase === 'chat';
  const showOptions = isChat && level !== 'direct' && !done && !botTyping && typeof step === 'number';
  const showDirect = isChat && level === 'direct' && !done && !botTyping && step === 0;
  const doneGuided = done && level !== 'direct';
  const currentOptions = showOptions && level ? QUESTIONS[level][step as number].opts : [];
  const progressLabel = `Question ${Math.min(answers.length + 1, 5)} / 5`;
  const showProgress = isChat && level !== 'direct' && !done;

  return (
    <div className="fixed inset-0 overflow-y-auto" style={{ zIndex: 60, background: '#060810', color: '#f4f3f8', fontFamily: 'Inter, sans-serif' }}>
      {/* Glows d'ambiance (cohérents avec page.tsx) */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '640px', height: '640px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(123,57,252,0.18) 0%, transparent 66%)', filter: 'blur(40px)' }} />
        <div style={{ position: 'absolute', bottom: '-20%', right: '-12%', width: '620px', height: '620px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 66%)', filter: 'blur(60px)' }} />
      </div>

      {/* Header */}
      <div className="relative z-10 max-w-5xl mx-auto px-8 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #7b39fc, #06B6D4)', boxShadow: '0 0 15px rgba(123,57,252,0.3)' }}>
            <span className="text-white font-bold text-sm" style={{ fontFamily: 'Manrope' }}>Q</span>
          </div>
          <span className="font-bold text-white text-lg" style={{ fontFamily: 'Manrope' }}>
            Quant<span style={{ color: '#7b39fc' }}>Clarity</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          {isChat && (
            <button onClick={reset} className="flex items-center gap-1.5 text-xs transition-colors hover:text-white"
              style={{ color: 'rgba(244,243,248,0.5)', fontFamily: 'Manrope', letterSpacing: '0.04em' }}>
              <RotateCcw size={13} strokeWidth={2} /> Recommencer
            </button>
          )}
          {showProgress && (
            <span className="text-xs uppercase" style={{ color: 'rgba(244,243,248,0.5)', fontFamily: 'Manrope', letterSpacing: '0.12em' }}>
              {progressLabel}
            </span>
          )}
        </div>
      </div>

      {/* ===== WELCOME ===== */}
      {phase === 'welcome' && (
        <>
          {/* Bloom central */}
          <div className="fixed pointer-events-none z-0" style={{
            top: '44%', left: '50%', width: 'min(150vh, 1400px)', height: 'min(150vh, 1400px)',
            transform: lit ? 'translate(-50%,-50%) scale(1)' : 'translate(-50%,-50%) scale(0.45)',
            opacity: lit ? 1 : 0,
            transition: 'opacity 2.2s ease, transform 2.6s cubic-bezier(.16,.84,.3,1)',
          }}>
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(123,57,252,0.34) 0%, rgba(123,57,252,0.18) 24%, rgba(6,182,212,0.12) 44%, transparent 64%)', filter: 'blur(12px)' }} />
          </div>

          <div className="relative z-10 max-w-4xl mx-auto px-6 pt-6 pb-20 flex flex-col items-center text-center">
            <div style={{ transition: 'opacity 1.5s ease, filter 1.6s ease', opacity: lit ? 1 : 0.1, filter: lit ? 'none' : 'blur(6px) brightness(0.5)' }}>
              <span className="text-xs uppercase block mb-6" style={{ color: '#06B6D4', fontFamily: 'Manrope', letterSpacing: '0.32em' }}>
                Onboarding · Stratégie IA
              </span>
              <h1 className="leading-tight mb-0" style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 'clamp(2.6rem, 6vw, 4.6rem)', lineHeight: 1.06, letterSpacing: '-0.03em' }}>
                <span className="text-white">Le trading est une boîte noire.</span><br />
                On allume la{' '}
                <em style={{ fontFamily: 'Instrument Serif', fontStyle: 'italic', fontWeight: 400, background: 'linear-gradient(120deg,#b79bff,#22d3ee)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  lumière
                </em>.
              </h1>
              <p className="mt-6 max-w-xl mx-auto" style={{ color: 'rgba(244,243,248,0.6)', fontFamily: 'Inter', fontSize: 'clamp(1rem,1.6vw,1.2rem)', lineHeight: 1.6 }}>
                Construisons ensemble votre stratégie. Choisissez par où commencer — l'interface s'adapte à votre niveau.
              </p>
            </div>

            <div className="w-full" style={{ transition: 'opacity 1.4s ease, transform 1.5s ease', transitionDelay: '0.4s', opacity: lit ? 1 : 0.06, transform: lit ? 'none' : 'translateY(18px)' }}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-10 w-full">
                {WELCOME_CARDS.map((c) => {
                  const Icon = c.Icon;
                  return (
                    <button key={c.title} onClick={() => begin(c.level)}
                      className="onb-card text-left p-7 rounded-2xl flex flex-col transition-all"
                      style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)', minHeight: '236px', color: '#f4f3f8', ['--onb-accent' as string]: c.accent }}>
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: `${c.accent}24`, border: `1px solid ${c.accent}4d` }}>
                        <Icon size={26} color={c.accent} strokeWidth={2} />
                      </div>
                      <div className="mt-5 font-bold" style={{ fontFamily: 'Manrope', fontSize: 'clamp(1.4rem,2.4vw,1.75rem)', letterSpacing: '-0.02em' }}>{c.title}</div>
                      <div className="mt-2.5" style={{ color: 'rgba(244,243,248,0.6)', fontFamily: 'Inter', fontSize: '0.95rem', lineHeight: 1.45 }}>{c.sub}</div>
                      <div className="mt-auto pt-5 flex items-center gap-2 text-xs font-semibold uppercase" style={{ color: 'rgba(244,243,248,0.6)', fontFamily: 'Manrope', letterSpacing: '0.08em' }}>
                        {c.cta} <ArrowRight size={14} strokeWidth={2.2} />
                      </div>
                    </button>
                  );
                })}
              </div>

              <span className="mt-8 inline-flex items-center gap-2 text-xs" style={{ color: 'rgba(244,243,248,0.4)', fontFamily: 'Manrope', letterSpacing: '0.1em' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#06B6D4' }} />
                Environnement de test — aucun capital réel engagé
              </span>
            </div>
          </div>
        </>
      )}

      {/* ===== CHAT ===== */}
      {isChat && (
        <div className="relative z-10 max-w-2xl mx-auto px-5 pb-8 flex flex-col" style={{ height: 'calc(100vh - 92px)' }}>
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto py-5 px-1">
            {messages.map((m, i) => {
              const isBot = m.role === 'bot';
              return (
                <div key={i} className="flex items-end mb-3.5 animate-fade-slide" style={{ gap: '11px', justifyContent: isBot ? 'flex-start' : 'flex-end' }}>
                  {isBot && (
                    <div className="flex-none w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#7b39fc,#06B6D4)', boxShadow: '0 4px 14px rgba(123,57,252,0.4)' }}>
                      <Sparkles size={15} color="#fff" strokeWidth={2} />
                    </div>
                  )}
                  <div style={{
                    maxWidth: '80%', padding: '13px 17px', fontFamily: 'Inter', fontSize: '0.95rem', lineHeight: 1.5,
                    borderRadius: isBot ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
                    background: isBot ? 'rgba(255,255,255,0.045)' : 'linear-gradient(135deg, rgba(123,57,252,0.95), rgba(123,57,252,0.72))',
                    border: isBot ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(123,57,252,0.5)',
                    color: isBot ? '#eceaf3' : '#fff',
                    backdropFilter: isBot ? 'blur(20px)' : undefined,
                    boxShadow: isBot ? '0 8px 30px rgba(0,0,0,0.3)' : '0 8px 30px rgba(123,57,252,0.25)',
                  }}>
                    {m.typing ? (
                      <span className="flex gap-1.5 items-center py-0.5">
                        {[0, 1, 2].map((d) => (
                          <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce inline-block" style={{ background: 'rgba(244,243,248,0.6)', animationDelay: `${d * 0.15}s` }} />
                        ))}
                      </span>
                    ) : m.text}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Zone de saisie / options */}
          <div className="pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {showOptions && (
              <div className="animate-fade-slide">
                <div className="flex flex-wrap gap-2.5">
                  {currentOptions.map((opt) => {
                    const Icon = opt.Icon;
                    return (
                      <button key={opt.label} onClick={() => answer(opt)}
                        className="onb-opt inline-flex items-center gap-2.5 rounded-xl transition-all"
                        style={{ padding: '12px 17px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#f4f3f8', fontFamily: 'Inter', fontSize: '0.95rem', fontWeight: 500 }}>
                        <Icon size={17} color="#a78bfa" strokeWidth={2} />
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
                <input value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Préciser (facultatif)…"
                  className="mt-3 w-full rounded-xl outline-none"
                  style={{ padding: '11px 15px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#f4f3f8', fontFamily: 'Inter', fontSize: '0.85rem' }} />
              </div>
            )}

            {showDirect && (
              <div className="flex gap-2.5 items-end animate-fade-slide">
                <textarea value={directDraft} onChange={(e) => setDirectDraft(e.target.value)} rows={2}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendDirect(); } }}
                  placeholder="Ex : stratégie momentum sur BTC, risque modéré, horizon swing, 100 000 € de test…"
                  className="flex-1 rounded-xl outline-none resize-none"
                  style={{ padding: '12px 15px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#f4f3f8', fontFamily: 'Inter', fontSize: '0.95rem', lineHeight: 1.45 }} />
                <button onClick={sendDirect}
                  className="flex-none inline-flex items-center gap-2 rounded-xl text-white font-semibold transition-all hover:scale-105"
                  style={{ padding: '12px 20px', background: 'linear-gradient(120deg,#7b39fc,#06B6D4)', fontFamily: 'Manrope', fontSize: '0.95rem', boxShadow: '0 8px 24px rgba(123,57,252,0.35)' }}>
                  <Send size={16} strokeWidth={2} /> Envoyer
                </button>
              </div>
            )}

            {done && (
              <div className="animate-fade-slide">
                {doneGuided && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {answers.map((a, i) => (
                      <div key={i} className="flex flex-col gap-0.5 rounded-lg" style={{ padding: '9px 13px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <span className="uppercase" style={{ fontFamily: 'Manrope', fontSize: '0.6rem', letterSpacing: '0.14em', color: 'rgba(244,243,248,0.4)' }}>{CHIP_LABELS[i]}</span>
                        <span style={{ fontFamily: 'Inter', fontSize: '0.85rem', fontWeight: 500 }}>{a.label}</span>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={launch}
                  className="w-full inline-flex items-center justify-center gap-2.5 rounded-2xl text-white font-semibold transition-all hover:scale-[1.02]"
                  style={{ padding: '17px', background: 'linear-gradient(120deg,#7b39fc,#06B6D4)', fontFamily: 'Manrope', fontSize: '1.1rem', letterSpacing: '-0.01em', boxShadow: '0 12px 40px rgba(123,57,252,0.4)' }}>
                  <Rocket size={20} strokeWidth={2} /> Lancer mes 6 experts IA
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
