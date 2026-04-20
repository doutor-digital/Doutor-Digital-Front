import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNumber } from "@/lib/utils";

type Point = { periodo: string; total: number };

export function EvolutionLine({ data }: { data: Point[] }) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="evolution-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="2 4"
            stroke="rgba(255,255,255,0.05)"
            vertical={false}
          />

          <XAxis
            dataKey="periodo"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#64748b", fontSize: 10 }}
            padding={{ left: 8, right: 8 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={40}
            tick={{ fill: "#64748b", fontSize: 10 }}
            tickFormatter={(v) => formatNumber(Number(v))}
          />

          <Tooltip
            cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 1 }}
            contentStyle={{
              background: "rgba(10,10,13,.96)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8,
              fontSize: 12,
              padding: "8px 10px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
              color: "#e2e8f0",
            }}
            labelStyle={{ color: "#64748b", fontSize: 11, marginBottom: 4 }}
            formatter={(v: number) => [formatNumber(v), "Leads"]}
          />

          <Area
            type="monotone"
            dataKey="total"
            stroke="#38bdf8"
            strokeWidth={2}
            fill="url(#evolution-fill)"
            dot={false}
            activeDot={{ r: 4, fill: "#38bdf8", stroke: "#0a0a0d", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
