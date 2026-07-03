"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { TransitionStat } from "@/lib/types";

const COLORS = [
  "rgb(124, 92, 255)",
  "rgb(99, 179, 237)",
  "rgb(72, 187, 120)",
  "rgb(237, 137, 54)",
  "rgb(245, 101, 101)",
  "rgb(159, 122, 234)",
  "rgb(236, 201, 75)",
];

export function TransitionChart({ data }: { data: TransitionStat[] }) {
  if (data.length === 0) {
    return (
      <div className="card text-sm text-[rgb(var(--muted-foreground))]">
        Render a project to see your most-used transitions.
      </div>
    );
  }
  return (
    <div className="card">
      <h3 className="mb-3 text-sm font-semibold">Most used transitions</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="rgb(38,38,46)" strokeDasharray="3 3" />
            <XAxis dataKey="name" stroke="rgb(150,150,160)" fontSize={11} />
            <YAxis stroke="rgb(150,150,160)" fontSize={11} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: "rgb(24,24,30)",
                border: "1px solid rgb(38,38,46)",
                borderRadius: 8,
                color: "white",
                fontSize: 12,
              }}
              cursor={{ fill: "rgba(124,92,255,0.06)" }}
            />
            <Bar dataKey="count" radius={[6, 6, 0, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
