import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import type { StageCount } from "@/types";

const COLORS = [
  "#38bdf8",
  "#34d399",
  "#fbbf24",
  "#f472b6",
  "#818cf8",
  "#2dd4bf",
  "#fb7185",
  "#a78bfa",
  "#facc15",
  "#94a3b8",
];

export function StageBarChart({ data }: { data: StageCount[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
          <defs>
            {COLORS.map((c, i) => (
              <linearGradient
                key={i}
                id={`stageBar${i}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={c} stopOpacity={0.95} />
                <stop offset="100%" stopColor={c} stopOpacity={0.55} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid
            strokeDasharray="2 4"
            stroke="rgba(255,255,255,0.05)"
            vertical={false}
          />
          <XAxis
            dataKey="stage"
            tick={{ fill: "#64748b", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval={0}
            angle={-12}
            textAnchor="end"
            height={40}
          />
          <YAxis
            tick={{ fill: "#64748b", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.03)" }}
            contentStyle={{
              background: "rgba(10,10,13,.96)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8,
              fontSize: 12,
              padding: "8px 10px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
              color: "#e2e8f0",
            }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={`url(#stageBar${i % COLORS.length})`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
