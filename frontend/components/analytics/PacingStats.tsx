"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { format } from "date-fns";
import type { QualityOverTimeEntry } from "@/lib/types";

interface PacingStatsProps {
  data: QualityOverTimeEntry[];
}

export function PacingStats({ data }: PacingStatsProps) {
  if (data.length === 0) {
    return (
      <div className="card text-sm text-[rgb(var(--muted-foreground))]">
        Quality trend will appear after you complete your first few projects.
      </div>
    );
  }
  const chartData = data.map((d) => ({
    label: format(new Date(d.createdAt), "MMM d"),
    name: d.name,
    quality: d.quality,
  }));

  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Quality over time</h3>
        <p className="text-xs text-[rgb(var(--muted-foreground))]">
          Watch the line rise as the feedback loop learns your preferences.
        </p>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="qualityFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(124,92,255)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="rgb(124,92,255)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgb(38,38,46)" strokeDasharray="3 3" />
            <XAxis dataKey="label" stroke="rgb(150,150,160)" fontSize={11} />
            <YAxis stroke="rgb(150,150,160)" fontSize={11} domain={[0, 100]} />
            <Tooltip
              contentStyle={{
                background: "rgb(24,24,30)",
                border: "1px solid rgb(38,38,46)",
                borderRadius: 8,
                color: "white",
                fontSize: 12,
              }}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.name ?? ""}
            />
            <Area
              type="monotone"
              dataKey="quality"
              stroke="rgb(124,92,255)"
              fill="url(#qualityFill)"
              strokeWidth={2}
            />
            <Line type="monotone" dataKey="quality" stroke="rgb(124,92,255)" dot={{ r: 3 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
