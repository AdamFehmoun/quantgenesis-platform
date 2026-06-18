'use client';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { BarChart3 } from 'lucide-react';
import type { BacktestResult } from '../app/page';

const tooltipStyle = {
  background: 'rgba(10,8,20,0.95)',
  border: '1px solid rgba(123,57,252,0.3)',
  borderRadius: 12,
  color: '#fff',
  fontSize: 12,
  fontFamily: 'Inter',
};

interface PerformanceChartProps {
  result: BacktestResult;
}

export default function PerformanceChart({ result }: PerformanceChartProps) {
  const data = result.chart_data;
  const hasData = Array.isArray(data) && data.length > 0;

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(10,8,20,0.7)', border: '1px solid rgba(123,57,252,0.2)', backdropFilter: 'blur(24px)' }}>

      <div className="px-6 py-4 flex items-center gap-3"
        style={{ borderBottom: '1px solid rgba(123,57,252,0.12)', background: 'rgba(123,57,252,0.05)' }}>
        <span className="flex items-center gap-2 text-sm font-semibold text-white" style={{ fontFamily: 'Manrope' }}>
          <BarChart3 size={16} color="#a78bfa" strokeWidth={2} /> Performance du portefeuille
        </span>
      </div>

      {!hasData ? (
        <div className="p-6">
          <p className="text-sm text-center" style={{ color: '#888', fontFamily: 'Inter' }}>
            Données de performance non disponibles pour ce backtest
          </p>
        </div>
      ) : (
        <div className="p-6">
          <p className="text-xs mb-4" style={{ color: '#555', fontFamily: 'Inter' }}>Equity curve — évolution du capital</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="gradValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7b39fc" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#7b39fc" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(123,57,252,0.08)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#444', fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#444', fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="value" stroke="#7b39fc" strokeWidth={2} fill="url(#gradValue)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>

          <p className="text-xs mt-6 mb-4" style={{ color: '#555', fontFamily: 'Inter' }}>Drawdown — perte maximale depuis un pic</p>
          <ResponsiveContainer width="100%" height={130}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="gradDD" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F87171" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#F87171" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(248,113,113,0.06)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#444', fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#444', fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.08)" />
              <Area type="monotone" dataKey="drawdown" stroke="#F87171" strokeWidth={2} fill="url(#gradDD)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
