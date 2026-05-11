import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Report } from '@/types/admin/reports';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { ArrowLeft, CheckCircle, XCircle, Flag, User, MessageSquare, ShoppingBag, ExternalLink, Shield } from 'lucide-react';

interface Props {
  report: Report | null;
  onUpdateStatus: (reportId: string, status: 'accepted' | 'rejected', notes?: string) => Promise<void>;
  onBanUser: (userId: string, reason: string, reportId: string) => Promise<void>;
  onBack?: () => void;
  reportTallyByUser: Record<string, number>;
}

const icons = { listing: ShoppingBag, comment: MessageSquare, user: User };
const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400',
  accepted: 'bg-red-500/15 text-red-700 dark:text-red-400',
  rejected: 'bg-muted text-muted-foreground',
};
const initials = (u: string) => u.split(/[\s_@]/).filter(Boolean).map((n) => n[0]).slice(0, 2).join('').toUpperCase();

export function ReportDetail({ report, onUpdateStatus, onBanUser, onBack, reportTallyByUser }: Props) {
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  if (!report) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-background text-muted-foreground">
        <Flag className="h-12 w-12" />
        <p className="text-lg font-medium">Select a report to review</p>
        <p className="text-sm">Choose a report from the list to see details</p>
      </div>
    );
  }

  const TypeIcon = icons[report.report_type];
  const entity = report.reported_entity;

  const action = async (status: 'accepted' | 'rejected') => {
    setBusy(true);
    try { await onUpdateStatus(report.id, status, notes || undefined); setNotes(''); }
    finally { setBusy(false); }
  };

  const ban = async () => {
    setBusy(true);
    try { await onBanUser(report.reported_user_id, `Banned due to report: ${report.reason}`, report.id); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        {onBack && <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-5 w-5" /></Button>}
        <div className="flex items-center gap-2">
          <TypeIcon className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold capitalize">{report.report_type} Report</h2>
        </div>
        <Badge className={cn('ml-auto capitalize', statusColors[report.status])}>{report.status}</Badge>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="rounded-lg border border-border p-4">
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">Reported User</h3>
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src={report.reported_user_profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-destructive/10 text-destructive">{initials(report.reported_user_profile?.username || 'U')}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <Link to={`/seller/${report.reported_user_id}`} className="font-medium hover:underline">
                  {report.reported_user_profile?.username || 'Unknown'}
                </Link>
                <p className="truncate text-xs text-muted-foreground">ID: {report.reported_user_id}</p>
              </div>
              {(reportTallyByUser[report.reported_user_id] || 0) > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {reportTallyByUser[report.reported_user_id]} report{reportTallyByUser[report.reported_user_id] > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border p-4">
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">Reported By</h3>
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src={report.reporter_user_profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary">{initials(report.reporter_user_profile?.username || 'U')}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{report.reporter_user_profile?.username || 'Unknown'}</p>
                <p className="text-xs text-muted-foreground">{format(new Date(report.created_at), 'PPp')}</p>
              </div>
            </div>
          </div>

          {entity && (
            <div className="rounded-lg border border-border p-4">
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">Reported Content</h3>
              {entity.kind === 'listing' && (
                <Link to={`/listing/${entity.id}`} className="flex items-center gap-3 rounded-md border border-border bg-muted/30 p-3 hover:bg-muted/60">
                  {entity.image && <img src={entity.image} alt={entity.title} className="h-16 w-16 rounded object-cover" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{entity.title}</p>
                    <p className="text-xs text-muted-foreground">${entity.price} · {entity.status}</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </Link>
              )}
              {entity.kind === 'comment' && (
                <Link to={`/listing/${entity.listing_id}`} className="block rounded-md border border-border bg-muted/30 p-3 hover:bg-muted/60">
                  <p className="text-xs uppercase text-muted-foreground">Comment</p>
                  <p className="line-clamp-4 whitespace-pre-wrap text-sm">{entity.content}</p>
                </Link>
              )}
              {entity.kind === 'user' && (
                <Link to={`/seller/${entity.id}`} className="inline-flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm hover:bg-muted/60">
                  View profile: {entity.username}<ExternalLink className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          )}

          <div className="rounded-lg border border-border p-4">
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">Report Details</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Type:</span>
                <Badge variant="outline" className="capitalize">{report.report_type}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Item ID:</span>
                <code className="rounded bg-muted px-2 py-0.5 text-xs">{report.reported_item_id}</code>
              </div>
              <Separator />
              <div>
                <span className="text-sm font-medium">Reason:</span>
                <p className="mt-1 text-sm text-foreground">{report.reason || 'No reason provided'}</p>
              </div>
            </div>
          </div>

          {report.admin_notes && (
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">Admin Notes</h3>
              <p className="text-sm">{report.admin_notes}</p>
            </div>
          )}

          {report.status === 'pending' && (
            <div className="space-y-4 rounded-lg border border-border p-4">
              <h3 className="text-sm font-medium text-muted-foreground">Take Action</h3>
              <Textarea placeholder="Add admin notes (optional)..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => action('accepted')} disabled={busy} variant="destructive" className="gap-2">
                  <CheckCircle className="h-4 w-4" />Accept Report
                </Button>
                <Button onClick={() => action('rejected')} disabled={busy} variant="outline" className="gap-2">
                  <XCircle className="h-4 w-4" />Reject Report
                </Button>
                <Button onClick={ban} disabled={busy} variant="destructive" className="gap-2">
                  <Shield className="h-4 w-4" />Ban User
                </Button>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
