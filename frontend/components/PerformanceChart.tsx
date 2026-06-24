'use client';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot } from 'recharts';
import { BarChart3 } from 'lucide-react';
import type { BacktestResult } from '../app/page';

interface PerformanceChartProps {
  result: BacktestResult;
}

// --- Formatters ------------------------------------------------------------
const eurFmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const eurCompactFmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 });
const pctFmt = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)} %`;

// Dates backend = "YYYY-MM-DD". Affichage court et lisible (« 12 janv. »).
function formatDate(raw: string): string {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

// --- Tooltip soigné --------------------------------------------------------
interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: { payload?: { date: string; value: number; drawdown: number } }[];
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  return (
    <div
      style={{
        background: 'rgba(10,8,20,0.96)',
        border: '1px solid rgba(123,57,252,0.35)',
        borderRadius: 12,
        padding: '10px 14px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(12px)',
        fontFamily: 'Inter',
        minWidth: 150,
      }}
    >
      <p className="text-[0.7rem] mb-2" style={{ color: '#06B6D4', fontFamily: 'Manrope', letterSpacing: '0.08em' }}>
        {formatDate(String(label))}
      </p>
      <div className="flex items-center justify-between gap-4 mb-1">
        <span className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(244,243,248,0.7)' }}>
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: '#7b39fc' }} />
          Capital
        </span>
        <span className="text-xs font-semibold text-white">{eurFmt.format(point.value)}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(244,243,248,0.7)' }}>
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: '#F87171' }} />
          Drawdown
        </span>
        <span className="text-xs font-semibold" style={{ color: point.drawdown < 0 ? '#F87171' : 'rgba(244,243,248,0.85)' }}>
          {pctFmt(point.drawdown)}
        </span>
      </div>
    </div>
  );
}

export default function PerformanceChart({ result }: PerformanceChartProps) {
  const data = result.chart_data;
  const hasData = Array.isArray(data) && data.length > 0;

  // Point de drawdown maximal (le creux le plus profond) — marqueur visuel.
  let worstDD: { date: string; drawdown: number } | null = null;
  if (hasData) {
    for (const p of data!) {
      if (worstDD === null || p.drawdown < worstDD.drawdown) {
        worstDD = { date: p.date, drawdown: p.drawdown };
      }
    }
    if (worstDD && worstDD.drawdown >= 0) worstDD = null; // pas de drawdown réel
  }

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)', boxShadow: '0 10px 40px rgba(0,0,0,0.35)' }}>

      <div className="px-6 py-4 flex items-center gap-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(123,57,252,0.05)' }}>
        <span className="flex-none w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(123,57,252,0.14)', border: '1px solid rgba(123,57,252,0.3)' }}>
          <BarChart3 size={16} color="#a78bfa" strokeWidth={2} />
        </span>
        <span className="text-sm font-semibold text-white" style={{ fontFamily: 'Manrope' }}>Performance du portefeuille</span>
      </div>

      {!hasData ? (
        <div className="p-6">
          <p className="text-sm text-center" style={{ color: 'rgba(244,243,248,0.5)', fontFamily: 'Inter' }}>
            Données de performance non disponibles pour ce backtest
          </p>
        </div>
      ) : (
        <div className="p-6">
          <p className="text-[0.7rem] uppercase mb-4" style={{ color: '#06B6D4', fontFamily: 'Manrope', letterSpacing: '0.2em' }}>Equity curve — évolution du capital</p>
          <ResponsiveContainer width="100%" height={210}>
            <AreaChart data={data!} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="gradValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7b39fc" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#7b39fc" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(123,57,252,0.08)" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 10, fill: 'rgba(244,243,248,0.45)', fontFamily: 'Inter' }}
                axisLine={false}
                tickLine={false}
                minTickGap={48}
                tickMargin={8}
              />
              <YAxis
                tickFormatter={(v: number) => eurCompactFmt.format(v)}
                tick={{ fontSize: 10, fill: 'rgba(244,243,248,0.45)', fontFamily: 'Inter' }}
                axisLine={false}
                tickLine={false}
                width={56}
                domain={['auto', 'auto']}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(123,57,252,0.4)', strokeWidth: 1, strokeDasharray: '4 4' }} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#7b39fc"
                strokeWidth={2.5}
                fill="url(#gradValue)"
                dot={false}
                activeDot={{ r: 4, fill: '#7b39fc', stroke: '#0a0814', strokeWidth: 2 }}
                isAnimationActive
                animationDuration={1100}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>

          <div className="flex items-baseline justify-between mt-6 mb-4">
            <p className="text-[0.7rem] uppercase" style={{ color: '#06B6D4', fontFamily: 'Manrope', letterSpacing: '0.2em' }}>Drawdown — perte maximale depuis un pic</p>
            {worstDD && (
              <span className="text-[0.7rem] font-semibold" style={{ color: '#F87171', fontFamily: 'Manrope' }}>
                Creux max {pctFmt(worstDD.drawdown)}
              </span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={data!} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="gradDD" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F87171" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#F87171" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(248,113,113,0.06)" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 10, fill: 'rgba(244,243,248,0.45)', fontFamily: 'Inter' }}
                axisLine={false}
                tickLine={false}
                minTickGap={48}
                tickMargin={8}
              />
              <YAxis
                tickFormatter={(v: number) => `${v.toFixed(0)} %`}
                tick={{ fontSize: 10, fill: 'rgba(244,243,248,0.45)', fontFamily: 'Inter' }}
                axisLine={false}
                tickLine={false}
                width={56}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(248,113,113,0.4)', strokeWidth: 1, strokeDasharray: '4 4' }} />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.08)" />
              <Area
                type="monotone"
                dataKey="drawdown"
                stroke="#F87171"
                strokeWidth={2}
                fill="url(#gradDD)"
                dot={false}
                activeDot={{ r: 4, fill: '#F87171', stroke: '#0a0814', strokeWidth: 2 }}
                isAnimationActive
                animationDuration={1100}
                animationEasing="ease-out"
              />
              {worstDD && (
                <ReferenceDot
                  x={worstDD.date}
                  y={worstDD.drawdown}
                  r={5}
                  fill="#F87171"
                  stroke="#0a0814"
                  strokeWidth={2}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
