'use client';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

const MOCK_DATA = [
  { date: '2024-01', value: 100, drawdown: 0 },
  { date: '2024-02', value: 108, drawdown: -2 },
  { date: '2024-03', value: 105, drawdown: -5 },
  { date: '2024-04', value: 115, drawdown: -1 },
  { date: '2024-05', value: 112, drawdown: -3 },
  { date: '2024-06', value: 120, drawdown: 0 },
  { date: '2024-07', value: 118, drawdown: -8 },
  { date: '2024-08', value: 125, drawdown: -2 },
  { date: '2024-09', value: 123, drawdown: -4 },
  { date: '2024-10', value: 130, drawdown: 0 },
  { date: '2024-11', value: 128, drawdown: -3 },
  { date: '2024-12', value: 135, drawdown: 0 },
];

const tooltipStyle = {
  background: 'rgba(10,8,20,0.95)',
  border: '1px solid rgba(123,57,252,0.3)',
  borderRadius: 12,
  color: '#fff',
  fontSize: 12,
  fontFamily: 'Inter',
};

export default function PerformanceChart() {
  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(10,8,20,0.7)', border: '1px solid rgba(123,57,252,0.2)', backdropFilter: 'blur(24px)' }}>

      <div className="px-6 py-4 flex items-center gap-3"
        style={{ borderBottom: '1px solid rgba(123,57,252,0.12)', background: 'rgba(123,57,252,0.05)' }}>
        <span className="text-sm font-semibold text-white" style={{ fontFamily: 'Manrope' }}>📊 Performance du portefeuille</span>
        <span className="ml-auto text-xs px-2 py-1 rounded-full"
          style={{ background: 'rgba(123,57,252,0.12)', color: '#a78bfa', border: '1px solid rgba(123,57,252,0.2)', fontFamily: 'Manrope' }}>
          données mock
        </span>
      </div>

      <div className="p-6">
        <p className="text-xs mb-4" style={{ color: '#555', fontFamily: 'Inter' }}>Equity curve — évolution du capital</p>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={MOCK_DATA}>
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
          <AreaChart data={MOCK_DATA}>
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
    </div>
  );
}