import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SessionSummary } from '@focusmentor/contracts';

const COLORS = ['#10b981', '#f59e0b', '#ef4444'];

interface Props {
  summary: SessionSummary;
}

export function SummaryCharts({ summary }: Props) {
  const pie = [
    { name: 'On Task', value: summary.onTaskPercent },
    { name: 'Away', value: summary.awayPercent },
    { name: 'Blocked', value: summary.blockedPercent },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="h-64 rounded-2xl border border-slate-200 bg-white p-4">
        <h4 className="mb-2 text-sm font-semibold text-slate-700">Focus mix</h4>
        <ResponsiveContainer width="100%" height="90%">
          <PieChart>
            <Pie data={pie} dataKey="value" nameKey="name" outerRadius={80} label>
              {pie.map((_, i) => (
                <Cell key={pie[i]!.name} fill={COLORS[i]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="h-64 rounded-2xl border border-slate-200 bg-white p-4">
        <h4 className="mb-2 text-sm font-semibold text-slate-700">App time (minutes)</h4>
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={summary.apps}>
            <XAxis dataKey="appName" tick={{ fontSize: 12 }} />
            <YAxis />
            <Tooltip />
            <Bar dataKey="minutes" fill="#2563eb" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
