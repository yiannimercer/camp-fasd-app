'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Save, Loader2, AlertCircle, CheckCircle2, Calendar, Settings2, DollarSign, AlertTriangle, RotateCcw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/contexts/AuthContext';
import { getAllConfigurations, updateConfiguration, SystemConfiguration } from '@/lib/api-super-admin';

interface SystemConfig {
  general: {
    campYear: number;
    tuitionAmount: number;
  };
  billing: {
    invoiceDueDays: number;
    invoiceDueUnit: 'days' | 'weeks' | 'months';
    invoiceFinalDueDate: string;
    invoiceFinalDueDateEnabled: boolean;
  };
  application: {
    allowNewApplications: boolean;
  };
}

// Generate year options (current year - 1 to current year + 2)
const generateYearOptions = () => {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let i = currentYear - 1; i <= currentYear + 2; i++) {
    years.push(i);
  }
  return years;
};

export default function SettingsPage() {
  const { token } = useAuth();
  const [config, setConfig] = useState<SystemConfig>({
    general: {
      campYear: new Date().getFullYear(),
      tuitionAmount: 500,
    },
    billing: {
      invoiceDueDays: 30,
      invoiceDueUnit: 'days',
      invoiceFinalDueDate: '',
      invoiceFinalDueDateEnabled: false,
    },
    application: {
      allowNewApplications: true,
    },
  });

  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [loading, setLoading] = useState(true);
  const [resetConfirmText, setResetConfirmText] = useState('');

  useEffect(() => {
    loadConfig();
  }, [token]);

  const loadConfig = async () => {
    if (!token) return;

    try {
      setLoading(true);
      const configurations = await getAllConfigurations(token);

      // Map database configs to our local state
      const campYearConfig = configurations.find(c => c.key === 'camp_year');
      const campFeeConfig = configurations.find(c => c.key === 'camp_fee');
      const invoiceDueDaysConfig = configurations.find(c => c.key === 'invoice_due_days');
      const invoiceDueUnitConfig = configurations.find(c => c.key === 'invoice_due_unit');
      const invoiceFinalDueDateConfig = configurations.find(c => c.key === 'invoice_final_due_date');
      const invoiceFinalDueDateEnabledConfig = configurations.find(c => c.key === 'invoice_final_due_date_enabled');
      const allowNewApplicationsConfig = configurations.find(c => c.key === 'allow_new_applications');

      setConfig(prev => ({
        ...prev,
        general: {
          campYear: campYearConfig ? parseInt(campYearConfig.value) : new Date().getFullYear(),
          tuitionAmount: campFeeConfig ? parseFloat(campFeeConfig.value) : 500,
        },
        billing: {
          invoiceDueDays: invoiceDueDaysConfig ? parseInt(invoiceDueDaysConfig.value) : 30,
          invoiceDueUnit: (invoiceDueUnitConfig?.value as 'days' | 'weeks' | 'months') || 'days',
          invoiceFinalDueDate: invoiceFinalDueDateConfig?.value || '',
          invoiceFinalDueDateEnabled: invoiceFinalDueDateEnabledConfig ?
            invoiceFinalDueDateEnabledConfig.value === true || invoiceFinalDueDateEnabledConfig.value === 'true' : false,
        },
        application: {
          allowNewApplications: allowNewApplicationsConfig ?
            allowNewApplicationsConfig.value === true || allowNewApplicationsConfig.value === 'true' : true,
        },
      }));
    } catch (error) {
      console.error('Failed to load config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!token) return;

    try {
      setSaving(true);
      setSaveStatus('idle');

      // Save camp year
      await updateConfiguration(token, 'camp_year', { value: config.general.campYear });

      // Save tuition/billing settings
      await updateConfiguration(token, 'camp_fee', { value: config.general.tuitionAmount.toString() });

      // Save invoice due date settings
      await updateConfiguration(token, 'invoice_due_days', { value: config.billing.invoiceDueDays.toString() });
      await updateConfiguration(token, 'invoice_due_unit', { value: config.billing.invoiceDueUnit });
      await updateConfiguration(token, 'invoice_final_due_date', { value: config.billing.invoiceFinalDueDate });
      await updateConfiguration(token, 'invoice_final_due_date_enabled', { value: config.billing.invoiceFinalDueDateEnabled.toString() });

      // Save application settings
      await updateConfiguration(token, 'allow_new_applications', { value: config.application.allowNewApplications.toString() });

      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Failed to save config:', error);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (section: keyof SystemConfig, field: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const yearOptions = generateYearOptions();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Configuration</h1>
          <p className="text-muted-foreground mt-1">
            Manage application-wide settings and preferences
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      {saveStatus === 'success' && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Settings saved successfully!
          </AlertDescription>
        </Alert>
      )}

      {saveStatus === 'error' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to save settings. Please try again.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="billing" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Billing
          </TabsTrigger>
          <TabsTrigger value="application" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Application
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Camp Season</CardTitle>
              <CardDescription>
                Configure the current camp season year
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="campYear">Camp Year</Label>
                <Select
                  value={config.general.campYear.toString()}
                  onValueChange={(value) => updateConfig('general', 'campYear', parseInt(value))}
                >
                  <SelectTrigger id="campYear" className="w-48">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  The current camp season year. This is used in email templates and application tracking.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Organization Settings</CardTitle>
              <CardDescription>
                Basic organization configuration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Organization Name</Label>
                  <Input value="CAMP - A FASD Community" disabled />
                  <p className="text-xs text-muted-foreground">Contact support to change</p>
                </div>
                <div className="space-y-2">
                  <Label>Website</Label>
                  <Input value="fasdcamp.org" disabled />
                  <p className="text-xs text-muted-foreground">Contact support to change</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-600" />
                Tuition & Fees
              </CardTitle>
              <CardDescription>
                Configure camp tuition amount and payment settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="tuitionAmount">Camp Tuition Amount (USD)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                  <Input
                    id="tuitionAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    className="pl-7 text-lg font-semibold max-w-[200px]"
                    value={config.general.tuitionAmount}
                    onChange={(e) =>
                      updateConfig('general', 'tuitionAmount', parseFloat(e.target.value) || 0)
                    }
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  This is the full tuition amount that will be invoiced to accepted campers.
                  Scholarships and payment plans can be applied per-application.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                Invoice Due Dates
              </CardTitle>
              <CardDescription>
                Configure how invoice due dates are calculated
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Dynamic Due Date Setting */}
              <div className="space-y-3">
                <Label>Default Due Date (After Invoice Creation)</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min="1"
                    max="365"
                    className="w-24 text-center text-lg font-semibold"
                    value={config.billing.invoiceDueDays}
                    onChange={(e) =>
                      updateConfig('billing', 'invoiceDueDays', parseInt(e.target.value) || 30)
                    }
                  />
                  <Select
                    value={config.billing.invoiceDueUnit}
                    onValueChange={(value) => updateConfig('billing', 'invoiceDueUnit', value)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="days">Days</SelectItem>
                      <SelectItem value="weeks">Weeks</SelectItem>
                      <SelectItem value="months">Months</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-muted-foreground">after invoice is created</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Example: If set to &quot;30 days&quot;, an invoice created on Jan 1 would be due Jan 31.
                </p>
              </div>

              <Separator />

              {/* Global Final Due Date */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Global Final Due Date</Label>
                    <p className="text-sm text-muted-foreground">
                      Set an absolute deadline for all invoice payments
                    </p>
                  </div>
                  <Switch
                    checked={config.billing.invoiceFinalDueDateEnabled}
                    onCheckedChange={(checked) =>
                      updateConfig('billing', 'invoiceFinalDueDateEnabled', checked)
                    }
                  />
                </div>

                {config.billing.invoiceFinalDueDateEnabled && (
                  <div className="ml-0 p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="finalDueDate">Final Due Date</Label>
                      <Input
                        id="finalDueDate"
                        type="date"
                        className="max-w-[200px]"
                        value={config.billing.invoiceFinalDueDate}
                        onChange={(e) =>
                          updateConfig('billing', 'invoiceFinalDueDate', e.target.value)
                        }
                      />
                    </div>
                    <p className="text-sm text-blue-700">
                      <strong>Logic:</strong> Invoices will use the <em>earlier</em> of the calculated due date
                      or this final date. For example, if the final date is June 1 and the calculated date
                      is June 15, the invoice will be due June 1.
                    </p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Preview */}
              <div className="rounded-lg border border-dashed p-4 bg-muted/30">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Due Date Preview
                </h4>
                <div className="space-y-2 text-sm">
                  {(() => {
                    const today = new Date();
                    let calculatedDue = new Date(today);

                    if (config.billing.invoiceDueUnit === 'days') {
                      calculatedDue.setDate(calculatedDue.getDate() + config.billing.invoiceDueDays);
                    } else if (config.billing.invoiceDueUnit === 'weeks') {
                      calculatedDue.setDate(calculatedDue.getDate() + (config.billing.invoiceDueDays * 7));
                    } else {
                      calculatedDue.setMonth(calculatedDue.getMonth() + config.billing.invoiceDueDays);
                    }

                    const globalDue = config.billing.invoiceFinalDueDateEnabled && config.billing.invoiceFinalDueDate
                      ? new Date(config.billing.invoiceFinalDueDate + 'T00:00:00')
                      : null;

                    const effectiveDue = globalDue && globalDue < calculatedDue ? globalDue : calculatedDue;
                    const usesGlobal = globalDue && globalDue < calculatedDue;

                    const formatDate = (d: Date) => d.toLocaleDateString('en-US', {
                      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
                    });

                    return (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Invoice created today:</span>
                          <span>{formatDate(today)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Calculated due date:</span>
                          <span>{formatDate(calculatedDue)}</span>
                        </div>
                        {globalDue && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Global final date:</span>
                            <span>{formatDate(globalDue)}</span>
                          </div>
                        )}
                        <div className="flex justify-between pt-2 border-t font-medium">
                          <span>Effective due date:</span>
                          <span className={usesGlobal ? 'text-blue-600' : 'text-green-600'}>
                            {formatDate(effectiveDue)}
                            {usesGlobal && <span className="ml-1 text-xs">(global)</span>}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>How Billing Works</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-dashed p-4 bg-muted/30">
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Invoices are <strong>automatically created</strong> when a camper is accepted</li>
                  <li>Families receive a Stripe payment link via email and in their dashboard</li>
                  <li>Admins can apply scholarships (partial or full) from the Payment tab</li>
                  <li>Admins can split into payment plans if needed</li>
                  <li>Due dates use the <strong>earlier</strong> of calculated date or global final date</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="application" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>New Applications</CardTitle>
              <CardDescription>
                Control whether new users can create applications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                <div className="space-y-1">
                  <Label className="text-base">Allow New Applications</Label>
                  <p className="text-sm text-muted-foreground">
                    When disabled, existing users can still edit their in-progress applications,
                    but no new applications can be created.
                  </p>
                </div>
                <Switch
                  checked={config.application.allowNewApplications}
                  onCheckedChange={(checked) =>
                    updateConfig('application', 'allowNewApplications', checked)
                  }
                />
              </div>

              <div className="rounded-lg border border-dashed p-4 bg-muted/20">
                <h4 className="font-medium mb-2 flex items-center gap-2 text-sm">
                  What this controls:
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>The &quot;Start New Application&quot; button on the family dashboard</li>
                  <li>Existing in-progress applications can still be edited and submitted</li>
                  <li>Does not affect accepted campers or paid applications</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-red-200">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                Danger Zone
              </CardTitle>
              <CardDescription>
                Irreversible actions that affect all applications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-4">
                <div className="space-y-2">
                  <h4 className="font-semibold text-red-800 flex items-center gap-2">
                    <RotateCcw className="h-4 w-4" />
                    Annual Reset
                  </h4>
                  <p className="text-sm text-red-700">
                    Reset all active applications for the new camp season. This will:
                  </p>
                  <ul className="text-sm text-red-600 list-disc list-inside space-y-1 ml-2">
                    <li>Reset all camper and applicant applications to &quot;Inactive&quot;</li>
                    <li>Delete non-persistent responses</li>
                    <li>Clear all admin notes and approval flags</li>
                  </ul>
                </div>

                <Separator className="bg-red-200" />

                <div className="space-y-3">
                  <Label htmlFor="resetConfirm" className="text-red-800">
                    Type <code className="bg-red-100 px-1 py-0.5 rounded text-xs">RESET ALL APPLICATIONS</code> to confirm:
                  </Label>
                  <Input
                    id="resetConfirm"
                    placeholder="RESET ALL APPLICATIONS"
                    value={resetConfirmText}
                    onChange={(e) => setResetConfirmText(e.target.value)}
                    className="max-w-sm border-red-200 focus:border-red-400"
                  />
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      disabled={resetConfirmText !== 'RESET ALL APPLICATIONS'}
                      className="border-amber-300 text-amber-700 hover:bg-amber-50"
                      onClick={() => {
                        // TODO: Preview reset endpoint
                        alert('Preview feature coming soon - will show what would be reset');
                      }}
                    >
                      Preview Reset
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={resetConfirmText !== 'RESET ALL APPLICATIONS'}
                      onClick={() => {
                        // TODO: Execute reset endpoint
                        alert('Reset feature coming soon - backend endpoint exists at POST /api/super-admin/annual-reset');
                      }}
                    >
                      Execute Reset
                    </Button>
                  </div>
                  <p className="text-xs text-red-500">
                    This action cannot be undone. Make sure you have exported any necessary data first.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
