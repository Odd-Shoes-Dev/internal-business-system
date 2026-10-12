'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  Tooltip,
  type ChartOptions,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { formatCurrency } from '@/lib/currency';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

// Colours: categorical slots 1-2 for revenue vs expenses; one blue ramp (light -> dark) for
// the ordered receivables buckets. Checked for colour-blind separation and contrast.
const C = {
  revenue: '#2a78d6',
  expenses: '#eb6834',
  agingRamp: ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#104281'],
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  muted: '#898781',
  ink: '#0b0b0b',
  inkSecondary: '#52514e',
  surface: '#ffffff',
};

export interface ChartData {
  currency: string;
  months: Array<{ month: string; revenue: number; expenses: number }>;
  days: Array<{ date: string; revenue: number }>;
  top_products: Array<{ name: string; amount: number; quantity: number }>;
  receivables_aging: Array<{ bucket: string; amount: number }>;
  expenses_by_account: Array<{ name: string; amount: number }>;
}

// Short axis labels: 1.2M, 850K (full amounts are in the tooltips and the table view)
function compact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  const units: Array<[number, string]> = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
  for (const [size, suffix] of units) {
    if (abs >= size) return `${sign}${Number((abs / size).toFixed(1))}${suffix}`;
  }
  return `${sign}${Number(abs.toFixed(1))}`;
}
const monthLabel = (ym: string) =>
  new Date(`${ym}-01T00:00:00`).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
const dayLabel = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

function baseOptions(currency: string, horizontal = false): ChartOptions<any> {
  const valueAxis = {
    beginAtZero: true,
    grid: { color: C.grid, lineWidth: 1, drawTicks: false },
    border: { display: false },
    ticks: { color: C.muted, font: { size: 11 }, padding: 6, maxTicksLimit: 5, callback: (v: number) => compact(Number(v)) },
  };
  const categoryAxis = {
    grid: { display: false },
    border: { color: C.axis },
    ticks: { color: C.muted, font: { size: 11 }, autoSkipPadding: 12, maxRotation: 0 },
  };
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    indexAxis: horizontal ? 'y' : 'x',
    interaction: { mode: horizontal ? 'nearest' : 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: C.surface,
        titleColor: C.ink,
        bodyColor: C.inkSecondary,
        borderColor: 'rgba(11,11,11,0.10)',
        borderWidth: 1,
        padding: 10,
        boxPadding: 4,
        usePointStyle: true,
        callbacks: {
          label: (ctx: any) => {
            const value = horizontal ? ctx.parsed.x : ctx.parsed.y;
            const name = ctx.dataset.label ? `${ctx.dataset.label}: ` : '';
            return ` ${name}${formatCurrency(value, currency as any)}`;
          },
        },
      },
    },
    scales: horizontal ? { x: valueAxis, y: { ...categoryAxis, border: { display: false } } } : { x: categoryAxis, y: valueAxis },
  };
}

// Bars: thin, 4px rounded at the data end, square on the baseline
const barStyle = { maxBarThickness: 24, borderRadius: 4, borderSkipped: 'start' as const, borderWidth: 0 };

function ChartCard({
  title,
  subtitle,
  legend,
  empty,
  table,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  legend?: Array<{ label: string; color: string }>;
  empty: boolean;
  table: { headers: string[]; rows: Array<Array<string>> };
  children: ReactNode;
  className?: string;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <div className={`bg-white/90 border border-blueox-primary/15 rounded-2xl shadow-sm p-5 flex flex-col ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {!empty && (
          <button onClick={() => setShowTable((v) => !v)} className="text-xs text-gray-500 hover:text-gray-800 whitespace-nowrap">
            {showTable ? 'Chart' : 'Table'}
          </button>
        )}
      </div>
      {legend && !empty && !showTable && (
        <div className="flex flex-wrap gap-4 mb-2">
          {legend.map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1.5 text-xs text-gray-600">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
      )}
      {empty ? (
        <div className="flex-1 min-h-[180px] flex items-center justify-center text-sm text-gray-400">Nothing recorded yet</div>
      ) : showTable ? (
        <div className="flex-1 overflow-auto max-h-64">
          <table className="w-full text-xs">
            <thead className="text-gray-500 border-b">
              <tr>{table.headers.map((h, i) => <th key={h} className={`py-1.5 font-medium ${i ? 'text-right' : 'text-left'}`}>{h}</th>)}</tr>
            </thead>
            <tbody className="tabular-nums">
              {table.rows.map((row, r) => (
                <tr key={r} className="border-b last:border-0">
                  {row.map((cell, i) => <td key={i} className={`py-1.5 ${i ? 'text-right' : ''}`}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex-1 min-h-[200px] relative">{children}</div>
      )}
    </div>
  );
}

export default function DashboardCharts({ companyId }: { companyId: string }) {
  const [data, setData] = useState<ChartData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(`/api/dashboard/charts?company_id=${companyId}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setFailed(true));
  }, [companyId]);

  if (failed) return null;
  if (!data) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => <div key={i} className="h-72 rounded-2xl bg-white/70 animate-pulse" />)}
      </div>
    );
  }
  return <DashboardChartsView data={data} />;
}

export function DashboardChartsView({ data }: { data: ChartData }) {
  const cur = data.currency;
  const money = (n: number) => formatCurrency(n, cur as any);
  const monthsEmpty = data.months.every((m) => !m.revenue && !m.expenses);
  const daysEmpty = data.days.every((d) => !d.revenue);
  const agingEmpty = data.receivables_aging.every((a) => !a.amount);
  const profit = data.months.reduce((s, m) => s + m.revenue - m.expenses, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard
          className="lg:col-span-2"
          title="Revenue and expenses"
          subtitle={`Last 12 months, from the ledger · ${profit >= 0 ? 'profit' : 'loss'} ${money(Math.abs(profit))}`}
          legend={[{ label: 'Revenue', color: C.revenue }, { label: 'Expenses', color: C.expenses }]}
          empty={monthsEmpty}
          table={{
            headers: ['Month', 'Revenue', 'Expenses', 'Profit'],
            rows: data.months.map((m) => [monthLabel(m.month), money(m.revenue), money(m.expenses), money(m.revenue - m.expenses)]),
          }}
        >
          <Bar
            options={baseOptions(cur)}
            data={{
              labels: data.months.map((m) => monthLabel(m.month)),
              datasets: [
                { label: 'Revenue', data: data.months.map((m) => m.revenue), backgroundColor: C.revenue, ...barStyle, categoryPercentage: 0.6, barPercentage: 0.9 },
                { label: 'Expenses', data: data.months.map((m) => m.expenses), backgroundColor: C.expenses, ...barStyle, categoryPercentage: 0.6, barPercentage: 0.9 },
              ],
            }}
          />
        </ChartCard>

        <ChartCard
          title="Who owes you"
          subtitle="Unpaid invoices, by days overdue"
          empty={agingEmpty}
          table={{ headers: ['Days overdue', 'Owed'], rows: data.receivables_aging.map((a) => [a.bucket, money(a.amount)]) }}
        >
          <Bar
            options={baseOptions(cur)}
            data={{
              labels: data.receivables_aging.map((a) => a.bucket),
              datasets: [{ data: data.receivables_aging.map((a) => a.amount), backgroundColor: C.agingRamp, ...barStyle }],
            }}
          />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard
          title="Daily revenue"
          subtitle="Last 30 days"
          empty={daysEmpty}
          table={{ headers: ['Day', 'Revenue'], rows: data.days.filter((d) => d.revenue).map((d) => [dayLabel(d.date), money(d.revenue)]) }}
        >
          <Bar
            options={baseOptions(cur)}
            data={{
              labels: data.days.map((d) => dayLabel(d.date)),
              datasets: [{ label: 'Revenue', data: data.days.map((d) => d.revenue), backgroundColor: C.revenue, ...barStyle, maxBarThickness: 10 }],
            }}
          />
        </ChartCard>

        <ChartCard
          title="Top products"
          subtitle="By sales, last 30 days"
          empty={!data.top_products.length}
          table={{ headers: ['Product', 'Qty', 'Sales'], rows: data.top_products.map((p) => [p.name, String(p.quantity), money(p.amount)]) }}
        >
          <Bar
            options={baseOptions(cur, true)}
            data={{
              labels: data.top_products.map((p) => (p.name.length > 22 ? `${p.name.slice(0, 21)}…` : p.name)),
              datasets: [{ data: data.top_products.map((p) => p.amount), backgroundColor: C.revenue, ...barStyle, maxBarThickness: 16 }],
            }}
          />
        </ChartCard>

        <ChartCard
          title="Where money went"
          subtitle="Expenses this month, by account"
          empty={!data.expenses_by_account.length}
          table={{ headers: ['Account', 'Amount'], rows: data.expenses_by_account.map((e) => [e.name, money(e.amount)]) }}
        >
          <Bar
            options={baseOptions(cur, true)}
            data={{
              labels: data.expenses_by_account.map((e) => (e.name.length > 22 ? `${e.name.slice(0, 21)}…` : e.name)),
              datasets: [{ data: data.expenses_by_account.map((e) => e.amount), backgroundColor: C.expenses, ...barStyle, maxBarThickness: 16 }],
            }}
          />
        </ChartCard>
      </div>
    </div>
  );
}
