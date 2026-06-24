'use client';
import { ShieldCheck, Lock, FileText, Clock, Scale, AlertTriangle } from 'lucide-react';

// Volet "Confidentialité / RGPD" — purement statique, aucune logique de données.
// Discret au repos (un encart en verre dépoli), détaillé seulement si l'utilisateur
// déplie le <details> natif (plus robuste qu'un modal, pas d'état React).
const POINTS: { Icon: typeof FileText; title: string; body: string }[] = [
  {
    Icon: FileText,
    title: 'Données traitées',
    body: 'Uniquement le texte de la stratégie que vous saisissez. Aucune donnée financière ou personnelle identifiante n\'est demandée ni collectée.',
  },
  {
    Icon: ShieldCheck,
    title: 'Finalité',
    body: 'Cette description sert exclusivement à générer et exécuter votre backtest. Aucune revente, aucun profilage, aucune publicité.',
  },
  {
    Icon: Clock,
    title: 'Durée de conservation',
    body: 'Mise en cache temporaire (48 h) pour accélérer les requêtes identiques, puis suppression automatique.',
  },
  {
    Icon: Scale,
    title: 'Vos droits & traçabilité',
    body: 'Aucune donnée personnelle identifiante n\'est stockée (RGPD). La traçabilité des décisions des agents IA est assurée — conformité AI Act, Article 12.',
  },
];

export default function PrivacyNotice() {
  return (
    <details className="group rounded-2xl overflow-hidden"
      style={{ background: 'rgba(10,8,20,0.55)', border: '1px solid rgba(123,57,252,0.18)', backdropFilter: 'blur(20px)' }}>

      {/* Bandeau discret — toujours visible, sert aussi de bouton "En savoir plus" */}
      <summary className="px-5 py-4 flex items-center gap-3 cursor-pointer select-none list-none transition-all hover:bg-[rgba(123,57,252,0.05)]">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(123,57,252,0.15)', border: '1px solid rgba(123,57,252,0.3)' }}>
          <Lock size={15} color="#a78bfa" strokeWidth={2} />
        </div>
        <p className="flex-1 text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.62)', fontFamily: 'Inter' }}>
          <span className="font-semibold" style={{ color: '#a78bfa' }}>Confidentialité —</span>{' '}
          vos descriptions de stratégie servent uniquement à générer le backtest. Aucune donnée financière personnelle
          n&apos;est collectée, aucune donnée n&apos;est revendue.{' '}
          <span style={{ color: 'rgba(255,255,255,0.45)' }}>Conforme au RGPD.</span>
        </p>
        <span className="text-[11px] font-semibold flex items-center gap-1 flex-shrink-0 transition-all"
          style={{ color: '#7b39fc', fontFamily: 'Manrope' }}>
          <span className="group-open:hidden">En savoir plus</span>
          <span className="hidden group-open:inline">Réduire</span>
          <span className="inline-block transition-transform group-open:rotate-180">▾</span>
        </span>
      </summary>

      {/* Détail déplié */}
      <div className="px-5 pb-5 pt-1">
        <div className="h-px mb-4" style={{ background: 'linear-gradient(90deg, rgba(123,57,252,0.25), transparent)' }} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {POINTS.map(({ Icon, title, body }) => (
            <div key={title} className="rounded-xl p-4"
              style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(123,57,252,0.12)' }}>
              <div className="flex items-center gap-2 mb-1.5">
                <Icon size={14} color="#a78bfa" strokeWidth={2} className="flex-shrink-0" />
                <p className="text-xs font-semibold" style={{ color: '#c9d3e0', fontFamily: 'Manrope' }}>{title}</p>
              </div>
              <p className="text-[11px] leading-relaxed" style={{ color: '#8a96a8', fontFamily: 'Inter' }}>{body}</p>
            </div>
          ))}
        </div>

        {/* Disclaimer — pas de conseil en investissement */}
        <div className="mt-3 flex items-start gap-2 rounded-xl p-3"
          style={{ background: 'rgba(217,119,6,0.07)', border: '1px solid rgba(217,119,6,0.2)' }}>
          <AlertTriangle size={14} color="#FAC775" strokeWidth={2} className="flex-shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed" style={{ color: '#FAC775', fontFamily: 'Inter' }}>
            Les résultats présentés sont des backtests à but pédagogique et ne constituent pas des conseils en investissement.
          </p>
        </div>
      </div>
    </details>
  );
}
