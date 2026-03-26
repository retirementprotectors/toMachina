'use client';

import { useState, useEffect } from 'react';
import { getDocs, query, where, Timestamp } from 'firebase/firestore';
import { getDb } from '@tomachina/db';
import { useEntitlements } from '@tomachina/auth';

interface ConversationStats {
  total_today: number;
  total_week: number;
  total_month: number;
  avg_messages_per_conversation: number;
  tool_usage: ToolUsageStat[];
  specialist_routing: SpecialistStat[];
  error_rate_percent: number;
  total_tokens_week: number;
}

interface ToolUsageStat {
  tool_name: string;
  call_count: number;
  success_rate_percent: number;
}

interface SpecialistStat {
  specialist_key: string;
  display_name: string;
  conversation_count: number;
  percent_of_total: number;
}

export default function MDJAdminDashboard() {
  const { profile, loading: entitlementsLoading } = useEntitlements();
  const [stats, setStats] = useState<ConversationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Numeric level: 0=OWNER, 1=EXECUTIVE, 2=LEADER, 3=USER
  // Gate: EXECUTIVE (1) and above (0=OWNER) only
  const userLevel = profile?.level ?? 3;
  const hasAccess = userLevel <= 1;

  useEffect(() => {
    if (entitlementsLoading) return;
    if (!hasAccess) {
      setLoading(false);
      return;
    }

    async function loadStats() {
      try {
        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - 7);
        const monthStart = new Date(now);
        monthStart.setDate(monthStart.getDate() - 30);

        const { collection } = await import('firebase/firestore');
        const convRef = collection(getDb(), 'mdj_conversations');
        const monthQuery = query(
          convRef,
          where('created_at', '>=', Timestamp.fromDate(monthStart))
        );
        const snapshot = await getDocs(monthQuery);
        const conversations = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Record<string, unknown>[];

        const todayConvs = conversations.filter((c) => {
          const d = (c.created_at as { toDate?: () => Date } | undefined)?.toDate?.();
          return d ? d >= todayStart : false;
        });
        const weekConvs = conversations.filter((c) => {
          const d = (c.created_at as { toDate?: () => Date } | undefined)?.toDate?.();
          return d ? d >= weekStart : false;
        });

        const toolCounts: Record<string, { calls: number; successes: number }> = {};
        const specialistCounts: Record<string, number> = {};
        let totalMessages = 0;
        let totalTokens = 0;
        let errorCount = 0;

        for (const conv of weekConvs) {
          totalMessages += (conv.message_count as number) || 0;
          totalTokens += (conv.token_usage as number) || 0;
          if (conv.status === 'error') errorCount++;

          if (conv.specialist_key) {
            const key = conv.specialist_key as string;
            specialistCounts[key] = (specialistCounts[key] || 0) + 1;
          }

          for (const tool of (conv.tool_calls as Array<{ name: string; status: string }>) || []) {
            if (!toolCounts[tool.name]) toolCounts[tool.name] = { calls: 0, successes: 0 };
            toolCounts[tool.name].calls++;
            if (tool.status === 'success') toolCounts[tool.name].successes++;
          }
        }

        const tool_usage: ToolUsageStat[] = Object.entries(toolCounts)
          .sort((a, b) => b[1].calls - a[1].calls)
          .slice(0, 10)
          .map(([name, data]) => ({
            tool_name: name,
            call_count: data.calls,
            success_rate_percent: data.calls > 0 ? Math.round((data.successes / data.calls) * 100) : 0,
          }));

        const totalSpecialistConvs = Object.values(specialistCounts).reduce((a, b) => a + b, 0);
        const specialist_routing: SpecialistStat[] = Object.entries(specialistCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([key, count]) => ({
            specialist_key: key,
            display_name: key.charAt(0).toUpperCase() + key.slice(1),
            conversation_count: count,
            percent_of_total: totalSpecialistConvs > 0 ? Math.round((count / totalSpecialistConvs) * 100) : 0,
          }));

        setStats({
          total_today: todayConvs.length,
          total_week: weekConvs.length,
          total_month: conversations.length,
          avg_messages_per_conversation:
            weekConvs.length > 0 ? Math.round(totalMessages / weekConvs.length) : 0,
          tool_usage,
          specialist_routing,
          error_rate_percent:
            weekConvs.length > 0 ? Math.round((errorCount / weekConvs.length) * 100) : 0,
          total_tokens_week: totalTokens,
        });
      } catch {
        setError('Failed to load analytics data.');
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, [entitlementsLoading, hasAccess]);

  // Access gate — rendered after hooks
  if (!entitlementsLoading && !hasAccess) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">Access Restricted</p>
          <p className="text-sm text-muted-foreground mt-1">Executive access required to view MDJ analytics.</p>
        </div>
      </div>
    );
  }

  if (entitlementsLoading || loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground text-sm">Loading MDJ analytics...</div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-destructive text-sm">{error || 'No data available.'}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">MDJ Analytics</h1>
        <p className="text-muted-foreground text-sm mt-1">MyDigitalJosh usage across the platform</p>
      </div>

      {/* Volume stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Conversations Today', value: stats.total_today },
          { label: 'Conversations This Week', value: stats.total_week },
          { label: 'Conversations This Month', value: stats.total_month },
        ].map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="text-3xl font-bold text-foreground mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Metric stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Avg Messages / Conversation', value: stats.avg_messages_per_conversation },
          { label: 'Error Rate (This Week)', value: `${stats.error_rate_percent}%` },
          {
            label: 'Total Tokens (This Week)',
            value:
              stats.total_tokens_week > 1000
                ? `${(stats.total_tokens_week / 1000).toFixed(1)}K`
                : String(stats.total_tokens_week),
          },
        ].map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="text-3xl font-bold text-foreground mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Top Tools table */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h2 className="text-lg font-semibold text-foreground mb-4">Top Tools (This Week)</h2>
        {stats.tool_usage.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tool calls recorded this week.</p>
        ) : (
          <div className="space-y-2">
            {stats.tool_usage.map((tool) => (
              <div
                key={tool.tool_name}
                className="flex items-center justify-between py-2 border-b border-border last:border-0"
              >
                <span className="text-sm font-mono text-foreground">{tool.tool_name}</span>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground">{tool.call_count} calls</span>
                  <span
                    className={
                      tool.success_rate_percent >= 90
                        ? 'text-green-600'
                        : tool.success_rate_percent >= 70
                        ? 'text-yellow-600'
                        : 'text-red-600'
                    }
                  >
                    {tool.success_rate_percent}% success
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Specialist Routing bar chart */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h2 className="text-lg font-semibold text-foreground mb-4">Specialist Routing (This Week)</h2>
        {stats.specialist_routing.length === 0 ? (
          <p className="text-sm text-muted-foreground">No specialist routing data this week.</p>
        ) : (
          <div className="space-y-3">
            {stats.specialist_routing.map((spec) => (
              <div key={spec.specialist_key}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-foreground">{spec.display_name}</span>
                  <span className="text-muted-foreground">
                    {spec.conversation_count} ({spec.percent_of_total}%)
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-[var(--portal)] h-2 rounded-full transition-all"
                    style={{ width: `${spec.percent_of_total}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
