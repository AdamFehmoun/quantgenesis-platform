'use client';
import { Lightbulb, TrendingUp, TrendingDown, Target, Gauge, ScrollText, type LucideIcon } from 'lucide-react';
import { BacktestResult } from '../app/page';
import { getTradesCount } from '../lib/metrics';

interface ExplanationProps {
  result: BacktestResult;
}

// Affichage léger : entiers tels quels, décimaux bornés à 2 chiffres.
const fmt = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(2));

// Le résumé pédagogique FR produit par l'agent Conformité (peut être absent).
function getPlainSummary(result: BacktestResult): string | null {
  const s = result.compliance_log?.oversight?.plain_language_summary;
  return typeof s === 'string' && s.trim() ? s.trim() : null;
}

// "ENTRY: RSI < 30 ET close > MA200" → "Achat quand RSI < 30 ET close > MA200".
// Tout préfixe inconnu (ex. "slippage=0.0015") est conservé tel quel.
function humanizeRule(rule: string): string {
  const match = rule.match(/^(ENTRY|LONG|EXIT|SHORT|STOP|SL|TP)\s*:\s*(.+)$/i);
  if (!match) return rule;
  const kind = match[1].toUpperCase();
  const cond = match[2].trim();
  const label =
    kind === 'ENTRY' || kind === 'LONG' ? 'Achat quand'
    : kind === 'EXIT' || kind === 'SHORT' ? 'Vente quand'
    : kind === 'STOP' || kind === 'SL' ? 'Stop-loss'
    : kind === 'TP' ? 'Take-profit'
    : kind;
  return `${label} ${cond}`;
}

// Règles métier concrètes, agrégées sur toutes les fonctions, dédupliquées.
function getBusinessRules(result: BacktestResult): string[] {
  const fns = result.final_spec?.functions;
  if (!Array.isArray(fns)) return [];
  const out: string[] = [];
  for (const fn of fns) {
    if (!fn || typeof fn !== 'object') continue;
    const rules = (fn as Record<string, unknown>).business_rules;
    if (!Array.isArray(rules)) continue;
    for (const r of rules) {
      if (typeof r === 'string' && r.trim()) out.push(humanizeRule(r.trim()));
    }
  }
  return Array.from(new Set(out));
}

interface InterpLine {
  Icon: LucideIcon;
  color: string;
  text: string;
}

// Interprétation templatée des métriques, honnête (positif/négatif assumé).
function buildInterpretation(result: BacktestResult): InterpLine[] {
  const m = result.metrics;
  if (!m) return [];
  const lines: InterpLine[] = [];

  if (m.total_return_pct != null) {
    const tr = m.total_return_pct;
    const positive = tr >= 0;
    lines.push({
      Icon: positive ? TrendingUp : TrendingDown,
      color: positive ? '#22c55e' : '#F87171',
      text: positive
        ? `Sur la période testée, cette stratégie aurait réalisé un gain de +${fmt(tr)} %.`
        : `Sur la période testée, cette stratégie aurait subi une perte de ${fmt(tr)} %.`,
    });
  }

  if (m.sharpe_ratio != null) {
    const s = m.sharpe_ratio;
    const interp =
      s >= 1 ? 'au-dessus de 1, signe d’un bon équilibre entre rendement et risque'
      : s >= 0 ? 'entre 0 et 1, soit un équilibre rendement/risque modéré'
      : 'négatif : la stratégie a moins bien performé qu’un placement sans risque';
    lines.push({
      Icon: Gauge,
      color: '#a78bfa',
      text: `Le ratio de Sharpe est de ${fmt(s)} — ${interp}.`,
    });
  }

  if (m.max_drawdown_pct != null) {
    lines.push({
      Icon: TrendingDown,
      color: '#F87171',
      text: `La perte maximale subie a été de ${fmt(Math.abs(m.max_drawdown_pct))} % (c’est la pire baisse depuis un sommet).`,
    });
  }

  if (m.win_rate_pct != null) {
    const trades = getTradesCount(result);
    const tradesPart = trades !== null ? `, sur ${trades} trades au total` : '';
    lines.push({
      Icon: Target,
      color: '#06B6D4',
      text: `${fmt(m.win_rate_pct)} % des trades ont été gagnants${tradesPart}.`,
    });
  }

  return lines;
}

export default function Explanation({ result }: ExplanationProps) {
  const summary = getPlainSummary(result);
  const lines = buildInterpretation(result);
  const rules = getBusinessRules(result);

  // Rien d'exploitable → on n'affiche pas un bloc vide.
  if (!summary && lines.length === 0 && rules.length === 0) return null;

  return (
    <div className="rounded-2xl p-6 mb-4 animate-fade-slide"
      style={{
        background: 'linear-gradient(135deg, rgba(123,57,252,0.08) 0%, rgba(6,182,212,0.05) 100%)',
        border: '1px solid rgba(123,57,252,0.2)',
      }}>

      {/* En-tête */}
      <div className="flex items-center gap-2 mb-4">
        <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(123,57,252,0.15)', border: '1px solid rgba(123,57,252,0.3)' }}>
          <Lightbulb size={15} color="#a78bfa" strokeWidth={2} />
        </span>
        <p className="text-sm font-semibold text-white" style={{ fontFamily: 'Manrope' }}>Explication</p>
        <span className="text-xs" style={{ color: 'rgba(244,243,248,0.45)', fontFamily: 'Inter' }}>en langage clair</span>
      </div>

      {/* Résumé pédagogique de l'agent Conformité (si disponible) */}
      {summary && (
        <p className="text-sm leading-relaxed mb-4" style={{ color: '#c9d3e0', fontFamily: 'Inter' }}>
          {summary}
        </p>
      )}

      {/* Interprétation templatée des métriques */}
      {lines.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {lines.map((l, i) => {
            const Icon = l.Icon;
            return (
              <div key={i} className="flex items-start gap-2.5">
                <Icon size={15} color={l.color} strokeWidth={2} className="flex-shrink-0 mt-0.5" />
                <p className="text-[13px] leading-relaxed" style={{ color: '#aab6c6', fontFamily: 'Inter' }}>{l.text}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Règles concrètes de la stratégie (optionnel) */}
      {rules.length > 0 && (
        <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-2 mb-2.5">
            <ScrollText size={14} color="#06B6D4" strokeWidth={2} />
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#06B6D4', fontFamily: 'Manrope' }}>
              Règles de la stratégie
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {rules.map((r, i) => (
              <span key={i} className="text-xs px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.04)', color: '#c9d3e0', border: '1px solid rgba(6,182,212,0.2)', fontFamily: 'Inter' }}>
                {r}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
