import { useCallback, useEffect, useRef, useState } from 'react';
import { callAdminData } from './useAdminData';
import { toast } from 'sonner';

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface SystemIssue {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  user_impact: string;
  suggested_fix: string;
  auto_fix_id: string | null;
  category: string;
  count: number;
  examples: any[];
  detected_at: string;
}

export interface IssueSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  auto_fixable: number;
  last_scan: string;
}

const REFRESH_MS = 60_000;

export function useAdminErrors() {
  const [issues, setIssues] = useState<SystemIssue[]>([]);
  const [summary, setSummary] = useState<IssueSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [fixing, setFixing] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  const load = useCallback(async (showToast = false) => {
    try {
      const data = await callAdminData<{ issues: SystemIssue[]; summary: IssueSummary }>('listSystemIssues');
      setIssues(data.issues || []);
      setSummary(data.summary);
      if (showToast) toast.success('Diagnostics refreshed.');
    } catch (e: any) {
      toast.error(e.message || 'Failed to load diagnostics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    timer.current = window.setInterval(() => load(false), REFRESH_MS);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [load]);

  const runFix = useCallback(async (fixId: string) => {
    setFixing(fixId);
    try {
      const result = await callAdminData<{ ok: boolean; fixed: number; message: string }>('runSystemFix', { fixId });
      toast.success(result.message || 'Fix applied.');
      await load();
    } catch (e: any) {
      toast.error(e.message || 'Fix failed.');
    } finally {
      setFixing(null);
    }
  }, [load]);

  return { issues, summary, loading, fixing, reload: () => load(true), runFix };
}
