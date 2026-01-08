'use client'

/**
 * Application Management Page
 * Super Admin page for configuring application-wide settings.
 * Tab-based layout allows for future expansion (notifications, workflows, etc.)
 */

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import {
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  Palette,
  AlertTriangle,
  Sparkles,
  ArrowRight,
} from 'lucide-react'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useStatusColors, DEFAULT_STATUS_COLORS } from '@/lib/contexts/StatusColorsContext'
import { updateStatusColors } from '@/lib/api-super-admin'
import {
  COLOR_PRESETS,
  STATUS_METADATA,
  getGroupedStatusKeys,
  isValidHex,
  getContrastLevel,
  type StatusColorKey,
  type StatusColorsMap,
  type PresetName,
} from '@/lib/utils/status-colors'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

// ============================================================================
// COLOR PICKER COMPONENT
// ============================================================================
function ColorPicker({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (color: string) => void
  label: string
}) {
  const [customColor, setCustomColor] = useState(value)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    setCustomColor(value)
  }, [value])

  const handlePresetClick = (color: string) => {
    onChange(color)
    setIsOpen(false)
  }

  const handleCustomChange = (input: string) => {
    let formatted = input.startsWith('#') ? input : `#${input}`
    formatted = formatted.toUpperCase()
    setCustomColor(formatted)
    if (isValidHex(formatted)) {
      onChange(formatted)
    }
  }

  const presetNames = Object.keys(COLOR_PRESETS) as PresetName[]

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className="group flex items-center gap-2.5 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all duration-150 min-w-[130px]"
          aria-label={label}
        >
          <div
            className="w-5 h-5 rounded-md ring-1 ring-black/10 shadow-inner"
            style={{ backgroundColor: value }}
          />
          <span className="text-sm font-mono text-gray-600 group-hover:text-gray-900 transition-colors">
            {value}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-4 shadow-xl border-gray-200" align="start">
        <div className="space-y-4">
          <div>
            <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2.5 block">
              Presets
            </Label>
            <div className="grid grid-cols-8 gap-1.5">
              {presetNames.map((name) => {
                const preset = COLOR_PRESETS[name]
                const colors = [preset.bg, preset.text]
                return colors.map((color, i) => (
                  <TooltipProvider key={`${name}-${i}`} delayDuration={150}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className={`w-6 h-6 rounded-md transition-all duration-150 ${
                            value === color
                              ? 'ring-2 ring-camp-green ring-offset-2 scale-110'
                              : 'ring-1 ring-black/10 hover:ring-black/25 hover:scale-105'
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() => handlePresetClick(color)}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="font-mono text-xs">
                        {color}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))
              })}
            </div>
          </div>

          <Separator className="bg-gray-100" />

          <div>
            <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2.5 block">
              Custom Hex
            </Label>
            <div className="flex gap-2">
              <Input
                value={customColor}
                onChange={(e) => handleCustomChange(e.target.value)}
                placeholder="#FFFFFF"
                className="font-mono text-sm h-10"
                maxLength={7}
              />
              <div
                className="w-10 h-10 rounded-lg ring-1 ring-black/10 flex-shrink-0 shadow-inner"
                style={{
                  backgroundColor: isValidHex(customColor) ? customColor : '#FFF',
                }}
              />
            </div>
            {!isValidHex(customColor) && customColor.length > 1 && (
              <p className="text-xs text-red-500 mt-1.5">
                Enter valid hex (e.g., #FF5733)
              </p>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ============================================================================
// COLOR CONFIG ROW
// ============================================================================
function ColorConfigRow({
  colorKey,
  config,
  onChange,
}: {
  colorKey: StatusColorKey
  config: { bg: string; text: string; label: string }
  onChange: (key: StatusColorKey, field: 'bg' | 'text' | 'label', value: string) => void
}) {
  const metadata = STATUS_METADATA[colorKey]
  const contrast = getContrastLevel(config.bg, config.text)

  return (
    <div className="grid grid-cols-[1fr_140px_140px_100px_70px] gap-3 items-center py-3.5 px-4 bg-white rounded-lg border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all duration-150">
      {/* Stage Label */}
      <div className="min-w-0">
        <div className="font-medium text-gray-900 text-sm truncate">{metadata.stage}</div>
        <div className="text-xs text-gray-400 truncate">{metadata.status}</div>
      </div>

      {/* Background Color */}
      <ColorPicker
        value={config.bg}
        onChange={(color) => onChange(colorKey, 'bg', color)}
        label={`${metadata.stage} background`}
      />

      {/* Text Color */}
      <ColorPicker
        value={config.text}
        onChange={(color) => onChange(colorKey, 'text', color)}
        label={`${metadata.stage} text`}
      />

      {/* Preview Badge */}
      <div className="flex justify-center">
        <span
          className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold shadow-sm whitespace-nowrap"
          style={{ backgroundColor: config.bg, color: config.text }}
        >
          {config.label}
        </span>
      </div>

      {/* Contrast */}
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex justify-center">
              <span
                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                  contrast.pass
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-amber-50 text-amber-700'
                }`}
              >
                {contrast.pass ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : (
                  <AlertTriangle className="w-3 h-3" />
                )}
                {contrast.ratio.toFixed(1)}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-medium">Contrast: {contrast.ratio.toFixed(2)}:1</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {contrast.pass ? 'Passes WCAG AA' : 'Below 4.5:1 requirement'}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}

// ============================================================================
// STATUS SECTION COMPONENT
// ============================================================================
function StatusSection({
  title,
  description,
  colorScheme,
  keys,
  localColors,
  onChange,
}: {
  title: string
  description: string
  colorScheme: 'blue' | 'purple' | 'gray'
  keys: StatusColorKey[]
  localColors: StatusColorsMap
  onChange: (key: StatusColorKey, field: 'bg' | 'text' | 'label', value: string) => void
}) {
  const schemes = {
    blue: 'from-blue-500 to-indigo-600',
    purple: 'from-purple-500 to-violet-600',
    gray: 'from-gray-400 to-gray-500',
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 px-1">
        <div className={`w-1 h-8 rounded-full bg-gradient-to-b ${schemes[colorScheme]}`} />
        <div>
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
      </div>
      <div className="space-y-2">
        {keys.map((key) => (
          <ColorConfigRow
            key={key}
            colorKey={key}
            config={localColors[key]}
            onChange={onChange}
          />
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================
export default function ApplicationManagementPage() {
  const { token } = useAuth()
  const { colors: contextColors, refreshColors } = useStatusColors()

  const [localColors, setLocalColors] = useState<StatusColorsMap>(DEFAULT_STATUS_COLORS)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    setLocalColors({ ...contextColors })
  }, [contextColors])

  useEffect(() => {
    const changed = Object.keys(localColors).some((key) => {
      const k = key as StatusColorKey
      return (
        localColors[k].bg !== contextColors[k].bg ||
        localColors[k].text !== contextColors[k].text ||
        localColors[k].label !== contextColors[k].label
      )
    })
    setHasChanges(changed)
  }, [localColors, contextColors])

  const handleColorChange = useCallback(
    (key: StatusColorKey, field: 'bg' | 'text' | 'label', value: string) => {
      setLocalColors((prev) => ({
        ...prev,
        [key]: { ...prev[key], [field]: value },
      }))
    },
    []
  )

  const handleSave = async () => {
    if (!token) return

    const invalidKeys = Object.entries(localColors).filter(
      ([, config]) => !isValidHex(config.bg) || !isValidHex(config.text)
    )
    if (invalidKeys.length > 0) {
      setSaveStatus('error')
      return
    }

    try {
      setSaving(true)
      setSaveStatus('idle')
      await updateStatusColors(token, localColors)
      await refreshColors()
      setSaveStatus('success')
      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch (error) {
      console.error('Failed to save status colors:', error)
      setSaveStatus('error')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setLocalColors({ ...DEFAULT_STATUS_COLORS })
  }

  const handleRevert = () => {
    setLocalColors({ ...contextColors })
  }

  const { stages, categories } = getGroupedStatusKeys()

  const hasContrastWarnings = Object.values(localColors).some(
    (config) => !getContrastLevel(config.bg, config.text).pass
  )

  return (
    <div className="space-y-6 pb-24">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Application Management</h1>
        <p className="text-gray-500 mt-1">
          Configure application-wide display settings and visual preferences
        </p>
      </div>

      {/* Status Messages */}
      {saveStatus === 'success' && (
        <Alert className="border-emerald-200 bg-emerald-50">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <AlertDescription className="text-emerald-800">
            Changes saved successfully! They&apos;re now visible across the entire application.
          </AlertDescription>
        </Alert>
      )}

      {saveStatus === 'error' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to save. Please ensure all colors are valid hex codes.
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs defaultValue="colors" className="space-y-6">
        <TabsList className="bg-gray-100/80 p-1">
          <TabsTrigger value="colors" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Palette className="h-4 w-4" />
            Status & Stage Colors
          </TabsTrigger>
          {/* Future tabs can be added here */}
        </TabsList>

        <TabsContent value="colors" className="space-y-6 mt-6">
          {/* Contrast Warning */}
          {hasContrastWarnings && (
            <Alert className="border-amber-200 bg-amber-50/80">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                Some color combinations have low contrast. Consider adjusting for better accessibility.
              </AlertDescription>
            </Alert>
          )}

          {/* How it works card */}
          <Card className="border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-gray-50 to-gray-100/50 px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-camp-green" />
                <span className="font-medium text-gray-900">How These Colors Work</span>
              </div>
            </div>
            <CardContent className="p-6">
              <div className="grid md:grid-cols-3 gap-6">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 font-semibold text-sm">1</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">Admin Dashboard</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Status badges in the applications table for quick identification
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-purple-600 font-semibold text-sm">2</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">Family Dashboard</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Application cards showing current status to families
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-600 font-semibold text-sm">3</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">Detail Views</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Headers and action panels throughout the review process
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Column Headers */}
          <div className="grid grid-cols-[1fr_140px_140px_100px_70px] gap-3 items-center px-4 py-2">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">Stage</div>
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">Background</div>
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">Text</div>
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wider text-center">Preview</div>
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wider text-center">AA</div>
          </div>

          {/* Status Sections */}
          <div className="space-y-8">
            <StatusSection
              title="Applicant Stages"
              description="New applications being reviewed"
              colorScheme="blue"
              keys={stages.filter((k) => k.startsWith('applicant_'))}
              localColors={localColors}
              onChange={handleColorChange}
            />

            <StatusSection
              title="Camper Stages"
              description="Accepted campers completing registration"
              colorScheme="purple"
              keys={stages.filter((k) => k.startsWith('camper_'))}
              localColors={localColors}
              onChange={handleColorChange}
            />

            <StatusSection
              title="Inactive Stages"
              description="Applications no longer active"
              colorScheme="gray"
              keys={stages.filter((k) => k.startsWith('inactive_'))}
              localColors={localColors}
              onChange={handleColorChange}
            />

            <Separator className="my-8" />

            <StatusSection
              title="Category Badges"
              description="Main status category labels"
              colorScheme="gray"
              keys={categories}
              localColors={localColors}
              onChange={handleColorChange}
            />
          </div>

          {/* Flow Preview */}
          <Card className="border-gray-200 shadow-sm mt-8">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">Status Flow Preview</CardTitle>
              <CardDescription>
                See how your configured badges will appear in sequence
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-6">
              <div className="flex items-center gap-2 flex-wrap">
                {['applicant_not_started', 'applicant_incomplete', 'applicant_complete', 'applicant_under_review'].map((key, i, arr) => (
                  <div key={key} className="flex items-center gap-2">
                    <span
                      className="px-2.5 py-1 rounded-md text-xs font-semibold shadow-sm"
                      style={{
                        backgroundColor: localColors[key as StatusColorKey].bg,
                        color: localColors[key as StatusColorKey].text,
                      }}
                    >
                      {localColors[key as StatusColorKey].label}
                    </span>
                    {i < arr.length - 1 && <ArrowRight className="w-4 h-4 text-gray-300" />}
                  </div>
                ))}
                <ArrowRight className="w-4 h-4 text-gray-300" />
                <span
                  className="px-2.5 py-1 rounded-md text-xs font-semibold shadow-sm"
                  style={{
                    backgroundColor: localColors.camper_incomplete.bg,
                    color: localColors.camper_incomplete.text,
                  }}
                >
                  {localColors.camper_incomplete.label}
                </span>
                <ArrowRight className="w-4 h-4 text-gray-300" />
                <span
                  className="px-2.5 py-1 rounded-md text-xs font-semibold shadow-sm"
                  style={{
                    backgroundColor: localColors.camper_complete.bg,
                    color: localColors.camper_complete.text,
                  }}
                >
                  {localColors.camper_complete.label}
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Floating Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
          <div className="ml-64"> {/* Offset for sidebar */}
            <div
              className={`pointer-events-auto bg-white rounded-xl shadow-lg border border-gray-200 px-4 py-3 flex items-center justify-between transition-all duration-300 ${
                hasChanges ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-sm text-gray-600">You have unsaved changes</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRevert}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  Discard
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                >
                  Reset Defaults
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-camp-green hover:bg-camp-green/90 text-white shadow-sm"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-1.5 h-3.5 w-3.5" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
