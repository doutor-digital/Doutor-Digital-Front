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
        <AreaChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="evolution-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#008eff" stopOpacity={0.55} />
              <stop offset="55%"  stopColor="#008eff" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#008eff" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="rgb(148 163 184 / 0.18)" vertical={false} />

          <XAxis
            dataKey="periodo"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "rgb(100 116 139)", fontSize: 11 }}
            padding={{ left: 8, right: 8 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={40}
            tick={{ fill: "rgb(100 116 139)", fontSize: 11 }}
            tickFormatter={(v) => formatNumber(Number(v))}
          />

          <Tooltip
            cursor={{ stroke: "rgb(0 134 247 / 0.35)", strokeWidth: 1.5 }}
            contentStyle={{
              background: "rgb(var(--surface) / 0.98)",
              border: "1px solid rgb(var(--hairline))",
              borderRadius: 10,
              boxShadow: "0 8px 24px rgba(15, 23, 42, 0.12)",
              color: "rgb(var(--slate-200))",
              fontSize: 12,
            }}
            labelStyle={{ color: "rgb(var(--slate-400))", fontSize: 11, marginBottom: 4 }}
            formatter={(v: number) => [formatNumber(v), "Leads"]}
          />

          <Area
            type="monotone"
            dataKey="total"
            stroke="#0086f7"
            strokeWidth={2.5}
            fill="url(#evolution-fill)"
            dot={{ r: 3, fill: "#0086f7", stroke: "#ffffff", strokeWidth: 1.5 }}
            activeDot={{ r: 5, fill: "#ffb500", stroke: "#0086f7", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
