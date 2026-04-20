import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = [
  "#38bdf8", // sky
  "#34d399", // emerald
  "#fbbf24", // amber
  "#f472b6", // pink
  "#818cf8", // indigo
  "#2dd4bf", // teal
  "#fb7185", // rose
  "#a78bfa", // violet
  "#facc15", // yellow
  "#94a3b8", // slate
];

export function SourceDonut({
  data,
}: {
  data: Array<{ name: string; value: number }>;
}) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={54}
            outerRadius={82}
            paddingAngle={3}
            stroke="rgba(10,10,13,1)"
            strokeWidth={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
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
          <Legend
            verticalAlign="bottom"
            height={32}
            wrapperStyle={{ color: "#cbd5e1", fontSize: 11 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
