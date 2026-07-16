import { useAdminErrors, type Severity } from '@/hooks/admin/useAdminErrors';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  RefreshCw,
  AlertTriangle,
  Wrench,
  CheckCircle2,
  Loader2,
  Activity,
} from 'lucide-react';
import { format } from 'date-fns';
import { AdminHeader } from '@/components/admin/shell/AdminHeader';
import { AdminBadge, type AdminBadgeTone } from '@/components/admin/shell/AdminBadge';

const sevMeta: Record<Severity, { tone: AdminBadgeTone; ring: string; label: string; emoji: string }> = {
  critical: { tone: 'danger', ring: 'border-l-destructive', label: 'Critical', emoji: '🚨' },
  high: { tone: 'warning', ring: 'border-l-amber-500', label: 'High', emoji: '⚠️' },
  medium: { tone: 'warning', ring: 'border-l-amber-400', label: 'Medium', emoji: '⚡' },
  low: { tone: 'neutral', ring: 'border-l-muted-foreground/40', label: 'Low', emoji: '🔹' },
};

export default function AdminErrors() {
  const { issues, summary, loading, fixing, reload, runFix } = useAdminErrors();

  return (
    <div className="admin-scope flex min-h-[100svh] flex-col bg-background pb-24">
      <AdminHeader
        title="Diagnostics"
        emoji="🩺"
        right={
          <Button variant="ghost" size="icon" onClick={reload} className="h-9 w-9 rounded-full">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        }
      />
      {summary && (
        <p className="px-4 pb-2 text-center text-[11px] text-muted-foreground">
          Last scan {format(new Date(summary.last_scan), 'HH:mm:ss')}
        </p>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
        {/* Summary */}
        <div className="mb-4 grid grid-cols-2 gap-3 sm:mb-6 sm:grid-cols-5">
          <SummaryCard label="Total issues" value={summary?.total ?? 0} icon={Activity} tone="muted" />
          <SummaryCard label="Critical" value={summary?.critical ?? 0} icon={AlertTriangle} tone="critical" />
          <SummaryCard label="High" value={summary?.high ?? 0} icon={AlertTriangle} tone="high" />
          <SummaryCard label="Medium" value={summary?.medium ?? 0} icon={AlertTriangle} tone="medium" />
          <SummaryCard label="Auto-fixable" value={summary?.auto_fixable ?? 0} icon={Wrench} tone="ok" />
        </div>

        {loading && issues.length === 0 ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-lg" />
            ))}
          </div>
        ) : issues.length === 0 ? (
          <Card className="border-emerald-200 bg-emerald-50/50">
            <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              <h3 className="text-lg font-semibold text-emerald-900">All systems healthy</h3>
              <p className="text-sm text-emerald-800/70">No issues detected. Auto-rescans every 60 seconds.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {issues.map((issue) => {
              const sev = sevStyles[issue.severity];
              const isFixing = fixing === issue.auto_fix_id;
              return (
                <Card key={issue.id} className={`border-l-4 ${sev.ring}`}>
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={sev.badge}>
                            {sev.label}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {issue.category}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {issue.count} affected
                          </Badge>
                          {issue.auto_fix_id && (
                            <Badge variant="outline" className="border-emerald-300 bg-emerald-500/10 text-emerald-700 text-xs">
                              Auto-fixable
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="text-base sm:text-lg">{issue.title}</CardTitle>
                        <CardDescription className="mt-1">{issue.description}</CardDescription>
                      </div>
                      {issue.auto_fix_id ? (
                        <Button
                          size="sm"
                          onClick={() => runFix(issue.auto_fix_id!)}
                          disabled={isFixing}
                          className="gap-1.5"
                        >
                          {isFixing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Wrench className="h-4 w-4" />
                          )}
                          Fix Now
                        </Button>
                      ) : (
                        <Badge variant="outline" className="border-border text-muted-foreground">
                          Manual review
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 pt-0 text-sm">
                    <div>
                      <span className="font-semibold text-foreground">User impact: </span>
                      <span className="text-muted-foreground">{issue.user_impact}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">Suggested fix: </span>
                      <span className="text-muted-foreground">{issue.suggested_fix}</span>
                    </div>
                    {issue.examples?.length > 0 && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                          Show {Math.min(issue.examples.length, 5)} example(s)
                        </summary>
                        <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-muted p-2 text-[11px] leading-relaxed text-muted-foreground">
                          {JSON.stringify(issue.examples, null, 2)}
                        </pre>
                      </details>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: any;
  tone: 'muted' | 'critical' | 'high' | 'medium' | 'ok';
}) {
  const tones: Record<string, string> = {
    muted: 'bg-muted/40 text-foreground',
    critical: 'bg-destructive/10 text-destructive',
    high: 'bg-orange-500/10 text-orange-700',
    medium: 'bg-yellow-500/10 text-yellow-700',
    ok: 'bg-emerald-500/10 text-emerald-700',
  };
  return (
    <Card className="overflow-hidden">
      <CardContent className={`flex items-center gap-3 p-3 sm:p-4 ${tones[tone]}`}>
        <Icon className="h-5 w-5 shrink-0" />
        <div className="min-w-0">
          <div className="text-xl font-bold leading-none sm:text-2xl">{value}</div>
          <div className="mt-1 truncate text-[11px] uppercase tracking-wide opacity-80 sm:text-xs">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
