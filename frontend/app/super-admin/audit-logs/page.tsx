'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Activity,
  User,
  FileText,
  Settings,
  Mail,
  Shield,
  Filter,
  Download,
  Search,
  Clock,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  Info,
  XCircle,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { getAuditLogs, AuditLog as ApiAuditLog } from '@/lib/api-super-admin';

// Frontend display type with mapped fields
interface DisplayAuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: string;
  category: 'user' | 'application' | 'system' | 'email' | 'security';
  severity: 'info' | 'warning' | 'error' | 'success';
  details: string;
  metadata: Record<string, any>;
  ipAddress: string;
}

// Maps entity_type to category
function mapEntityTypeToCategory(entityType: string): DisplayAuditLog['category'] {
  const mapping: Record<string, DisplayAuditLog['category']> = {
    'user': 'user',
    'application': 'application',
    'system': 'system',
    'configuration': 'system',
    'email': 'email',
    'email_template': 'email',
    'security': 'security',
    'team': 'system',
  };
  return mapping[entityType] || 'system';
}

// Derives severity from action type
function deriveSeverityFromAction(action: string): DisplayAuditLog['severity'] {
  // Success actions
  if (['login_success', 'user_created', 'status_promoted', 'team_approved', 'application_created'].includes(action)) {
    return 'success';
  }
  // Warning actions
  if (['login_failed', 'status_waitlisted', 'status_deferred', 'status_withdrawn', 'team_declined'].includes(action)) {
    return 'warning';
  }
  // Error actions
  if (['status_rejected', 'error'].includes(action)) {
    return 'error';
  }
  // Default to info
  return 'info';
}

// Formats action to human-readable text
function formatAction(action: string, details: Record<string, any> | null): string {
  const actionLabels: Record<string, string> = {
    'login_success': 'Logged in successfully',
    'login_failed': 'Failed login attempt',
    'user_created': 'New user registered',
    'user_updated': 'Updated user information',
    'role_changed': 'Changed user role',
    'status_changed': 'Changed user status',
    'application_created': 'Created new application',
    'application_updated': 'Updated application',
    'responses_saved': 'Saved application responses',
    'status_promoted': 'Promoted to Camper',
    'status_waitlisted': 'Added to waitlist',
    'status_deferred': 'Deferred application',
    'status_withdrawn': 'Withdrew application',
    'status_rejected': 'Rejected application',
    'status_reactivated': 'Reactivated application',
    'team_approved': 'Approved application',
    'team_declined': 'Declined application',
    'note_added': 'Added admin note',
    'note_deleted': 'Deleted admin note',
    'cabin_assigned': 'Assigned cabin',
    'password_changed': 'Changed password',
    'password_reset': 'Reset password',
    'config_updated': 'Updated system configuration',
    'template_updated': 'Updated email template',
    'team_created': 'Created new team',
    'team_updated': 'Updated team',
    'annual_reset': 'Performed annual reset',
    'updated': 'Updated record',
    'created': 'Created record',
  };

  return actionLabels[action] || action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// Formats details object to human-readable description
function formatDetails(action: string, details: Record<string, any> | null): string {
  if (!details) return '';

  const parts: string[] = [];

  // Handle camper name for application events
  if (details.camper_name && details.camper_name.trim()) {
    parts.push(`Camper: ${details.camper_name}`);
  }

  // Handle team for approval/decline
  if (details.team) {
    parts.push(`Team: ${details.team}`);
  }

  // Handle role changes
  if (details.old_role && details.new_role) {
    parts.push(`Role changed from ${details.old_role} to ${details.new_role}`);
  }

  // Handle status changes
  if (details.old_status && details.new_status) {
    parts.push(`Status changed from ${details.old_status} to ${details.new_status}`);
  }

  // Handle login failures
  if (details.reason) {
    parts.push(`Reason: ${details.reason.replace(/_/g, ' ')}`);
  }

  // Handle email
  if (details.email && action.includes('login')) {
    parts.push(`Email: ${details.email}`);
  }

  // Handle configuration updates
  if (details.key) {
    parts.push(`Key: ${details.key}`);
  }

  // Handle annual reset
  if (details.applications_reset !== undefined) {
    parts.push(`${details.applications_reset} applications reset`);
  }

  // Handle note previews
  if (details.note_preview) {
    parts.push(`"${details.note_preview}"`);
  }

  return parts.join(' • ') || JSON.stringify(details).slice(0, 100);
}

// Converts API audit log to display format
function mapToDisplayLog(log: ApiAuditLog): DisplayAuditLog {
  return {
    id: log.id,
    timestamp: log.created_at,
    userId: log.actor_id || '',
    userName: log.actor_name || 'System',
    userEmail: log.actor_email || '',
    action: formatAction(log.action, log.details),
    category: mapEntityTypeToCategory(log.entity_type),
    severity: deriveSeverityFromAction(log.action),
    details: formatDetails(log.action, log.details),
    metadata: log.details || {},
    ipAddress: log.ip_address || '',
  };
}

const categoryIcons = {
  user: User,
  application: FileText,
  system: Settings,
  email: Mail,
  security: Shield,
};

const severityConfigs = {
  info: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-200' },
  warning: { icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  error: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200' },
  success: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50', border: 'border-green-200' },
};

export default function AuditLogsPage() {
  const { token } = useAuth();
  const [logs, setLogs] = useState<DisplayAuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<DisplayAuditLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<DisplayAuditLog | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const fetchLogs = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      // Map category filter to entity_type
      const entityTypeMap: Record<string, string | undefined> = {
        'all': undefined,
        'user': 'user',
        'application': 'application',
        'system': 'system',
        'email': 'email',
        'security': 'security',
      };

      const rawLogs = await getAuditLogs(token, {
        entity_type: entityTypeMap[categoryFilter],
        limit: 100,
      });

      const displayLogs = rawLogs.map(mapToDisplayLog);
      setLogs(displayLogs);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch audit logs');
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [token, categoryFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    applyFilters();
  }, [searchQuery, severityFilter, dateRange, logs]);

  const applyFilters = () => {
    let filtered = [...logs];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(log =>
        log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.userName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Severity filter
    if (severityFilter !== 'all') {
      filtered = filtered.filter(log => log.severity === severityFilter);
    }

    // Date range filter
    if (dateRange.start) {
      filtered = filtered.filter(log => new Date(log.timestamp) >= new Date(dateRange.start));
    }
    if (dateRange.end) {
      filtered = filtered.filter(log => new Date(log.timestamp) <= new Date(dateRange.end));
    }

    setFilteredLogs(filtered);
  };

  const handleViewDetails = (log: DisplayAuditLog) => {
    setSelectedLog(log);
    setDetailsOpen(true);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const csvContent = [
        ['Timestamp', 'User', 'Action', 'Category', 'Severity', 'Details', 'IP Address'].join(','),
        ...filteredLogs.map(log => [
          new Date(log.timestamp).toISOString(),
          log.userName,
          log.action,
          log.category,
          log.severity,
          log.details.replace(/,/g, ';'),
          log.ipAddress || '',
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export logs:', error);
    } finally {
      setExporting(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString();
  };

  const groupLogsByDate = (logs: DisplayAuditLog[]) => {
    const groups: { [key: string]: DisplayAuditLog[] } = {};

    logs.forEach(log => {
      const date = new Date(log.timestamp).toLocaleDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(log);
    });

    return groups;
  };

  const logGroups = groupLogsByDate(filteredLogs);

  if (loading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Audit Logs</h1>
          <p className="text-muted-foreground mt-1">
            View system activity and user actions
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export
              </>
            )}
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search logs..."
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={categoryFilter} onValueChange={(value) => {
                setCategoryFilter(value);
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="application">Application</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="security">Security</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Severity</Label>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="start-date">Date Range</Label>
              <div className="flex gap-2">
                <Input
                  id="start-date"
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              <span>{filteredLogs.length} log{filteredLogs.length !== 1 ? 's' : ''}</span>
            </div>
            {(searchQuery || categoryFilter !== 'all' || severityFilter !== 'all' || dateRange.start) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setCategoryFilter('all');
                  setSeverityFilter('all');
                  setDateRange({ start: '', end: '' });
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {Object.entries(logGroups).map(([date, dateLogs]) => (
          <div key={date} className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="text-sm font-medium text-muted-foreground">
                {date}
              </div>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-6 top-6 bottom-0 w-px bg-border" />

              <div className="space-y-4">
                {dateLogs.map((log) => {
                  const CategoryIcon = categoryIcons[log.category];
                  const severityConfig = severityConfigs[log.severity];
                  const SeverityIcon = severityConfig.icon;

                  return (
                    <div key={log.id} className="relative flex gap-4">
                      {/* Timeline dot */}
                      <div className={`relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 ${severityConfig.bg} ${severityConfig.border}`}>
                        <CategoryIcon className={`h-5 w-5 ${severityConfig.color}`} />
                      </div>

                      {/* Log card */}
                      <Card className="flex-1 hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleViewDetails(log)}>
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <CardTitle className="text-base">{log.action}</CardTitle>
                                <Badge variant={log.severity === 'error' ? 'destructive' : 'secondary'}>
                                  {log.category}
                                </Badge>
                              </div>
                              <CardDescription className="flex items-center gap-2">
                                <Clock className="h-3 w-3" />
                                {formatTimestamp(log.timestamp)}
                              </CardDescription>
                            </div>
                            <SeverityIcon className={`h-5 w-5 ${severityConfig.color}`} />
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <p className="text-sm text-muted-foreground mb-3">{log.details || 'No additional details'}</p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-xs">
                                  {log.userName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs text-muted-foreground">{log.userName}</span>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}

        {filteredLogs.length === 0 && !loading && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Activity className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No logs found</h3>
              <p className="text-sm text-muted-foreground text-center max-w-sm">
                {logs.length === 0
                  ? 'No audit logs have been recorded yet. Actions like logins, approvals, and status changes will appear here.'
                  : 'No audit logs match your current filters. Try adjusting your search criteria.'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Audit Log Details
            </DialogTitle>
            <DialogDescription>
              Detailed information about this audit log entry
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Timestamp</Label>
                  <div className="text-sm font-medium">
                    {new Date(selectedLog.timestamp).toLocaleString()}
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">User</Label>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">
                        {selectedLog.userName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-sm font-medium">{selectedLog.userName}</div>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Category</Label>
                  <Badge variant="secondary">{selectedLog.category}</Badge>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Severity</Label>
                  <Badge variant={selectedLog.severity === 'error' ? 'destructive' : 'secondary'}>
                    {selectedLog.severity}
                  </Badge>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <div className="text-sm">{selectedLog.userEmail || 'N/A'}</div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">IP Address</Label>
                  <div className="text-sm font-mono">{selectedLog.ipAddress || 'N/A'}</div>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Action</Label>
                <div className="text-sm font-medium">{selectedLog.action}</div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Details</Label>
                <div className="text-sm">{selectedLog.details || 'No additional details'}</div>
              </div>

              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Metadata</Label>
                  <div className="rounded-md bg-muted p-3 font-mono text-xs">
                    <pre>{JSON.stringify(selectedLog.metadata, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
