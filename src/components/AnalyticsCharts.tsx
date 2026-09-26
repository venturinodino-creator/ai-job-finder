"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import type { AnalyticsSummary } from "@/lib/analytics";

const SOURCE_COLORS = ["var(--chart-cat-1)", "var(--chart-cat-2)", "var(--chart-cat-3)"];

const tooltipStyle = {
  background: "var(--color-bg-elevated)",
  border: "1px solid var(--color-border)",
  borderRadius: 6,
  fontSize: 12,
};

export function CvScoreHistoryChart({ data }: { data: AnalyticsSummary["cvScoreHistory"] }) {
  if (data.length === 0) {
    return <EmptyState label="Upload and review a CV to start tracking score history." />;
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} tickLine={false} axisLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} tickLine={false} axisLine={false} width={32} />
        <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "var(--color-text)" }} />
        <Line
          type="monotone"
          dataKey="score"
          name="CV score"
          stroke="var(--color-accent)"
          strokeWidth={2}
          dot={{ r: 4, fill: "var(--color-accent)", strokeWidth: 0 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ScoreDistributionChart({ data }: { data: AnalyticsSummary["scoreDistribution"] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  if (total === 0) {
    return <EmptyState label="Run a match to see how your matches score." />;
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
        <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} tickLine={false} axisLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} tickLine={false} axisLine={false} width={28} />
        <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "var(--color-text)" }} cursor={{ fill: "var(--color-border)", opacity: 0.3 }} />
        <Bar dataKey="count" name="Matches" fill="var(--color-secondary)" radius={[4, 4, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SourceBreakdownChart({ data }: { data: AnalyticsSummary["sourceBreakdown"] }) {
  if (data.length === 0) {
    return <EmptyState label="Run an ingest to see your matches by source." />;
  }
  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={Math.max(120, data.length * 44)}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="source"
            tick={{ fontSize: 12, fill: "var(--color-text)" }}
            tickLine={false}
            axisLine={false}
            width={90}
          />
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "var(--color-text)" }} cursor={{ fill: "var(--color-border)", opacity: 0.3 }} />
          <Bar dataKey="count" name="Matches" radius={[0, 4, 4, 0]} maxBarSize={28}>
            {data.map((_, i) => (
              <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="h-[220px] flex items-center justify-center text-sm text-center px-6" style={{ color: "var(--color-text-muted)" }}>
      {label}
    </div>
  );
}
