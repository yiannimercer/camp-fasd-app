# Email Template HTML Preview - Implementation Plan

> **Estimated Time:** 1.5-2 hours
> **Primary Developer:** Claude Code
> **Last Updated:** January 5, 2026

---

## Overview

Add a live HTML preview feature to the Email Template Edit dialog in Super Admin > Email Communication > Templates. This allows admins to instantly see how the email will look with CAMP branding and example variables populated.

---

## Current State

### Template Edit Dialog (lines 1126-1207)
Currently a simple modal with:
- Template key (on create only)
- Name input
- Subject input
- HTML Content textarea (plain, no syntax highlighting)
- Active toggle
- Save/Cancel buttons

**Dialog size:** `max-w-4xl` (already large)

### Mass Email Tab (lines 768-881) - Inspiration
Two-column layout:
- **Left:** Compose form (audience, subject, content textarea)
- **Right:** Preview card with iframe showing rendered HTML
- Preview button triggers API call → renders in iframe

---

## Proposed Design

### Layout: Split-View with Tabs

Transform the dialog into a two-panel layout:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Edit Template: Welcome Email                                    [X] │
│─────────────────────────────────────────────────────────────────────│
│                                                                     │
│  ┌──────────────────────────┐  ┌──────────────────────────────────┐ │
│  │ EDITOR                   │  │ PREVIEW                          │ │
│  │                          │  │                                  │ │
│  │ Name: [Welcome Email   ] │  │ ┌──────────────────────────────┐ │ │
│  │                          │  │ │                              │ │ │
│  │ Subject:                 │  │ │   [Rendered Email Preview]   │ │ │
│  │ [Welcome to CAMP {{..]] │  │ │                              │ │ │
│  │                          │  │ │   With CAMP branding,        │ │ │
│  │ HTML Content:            │  │ │   header, footer, and        │ │ │
│  │ ┌──────────────────────┐ │  │ │   sample variables           │ │ │
│  │ │ <h2>Welcome!</h2>    │ │  │ │   substituted                │ │ │
│  │ │ <p>Dear {{firstName}}│ │  │ │                              │ │ │
│  │ │ ...                  │ │  │ │                              │ │ │
│  │ │                      │ │  │ │                              │ │ │
│  │ └──────────────────────┘ │  │ └──────────────────────────────┘ │ │
│  │                          │  │                                  │ │
│  │ Variables:               │  │ Sample Data:                     │ │
│  │ {{firstName}}, {{camp..}}│  │ [John Doe ▼] [Sarah Smith ▼]    │ │
│  │                          │  │                                  │ │
│  │ [x] Active               │  │ [🔄 Refresh Preview]             │ │
│  └──────────────────────────┘  └──────────────────────────────────┘ │
│                                                                     │
│─────────────────────────────────────────────────────────────────────│
│                                         [Cancel]  [Save Template]   │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Features

1. **Live Preview Panel**
   - Iframe showing rendered HTML with full CAMP branding
   - Updates on button click (not on every keystroke to avoid API spam)
   - Shows exactly how the email will look in recipient's inbox

2. **Sample Data Controls**
   - Preset sample data dropdowns for common scenarios:
     - Recipient: "John Doe", "Jane Smith", "Alex Johnson"
     - Camper: "Sarah Smith", "Michael Brown", "Emma Wilson"
   - Allows testing different name lengths and formats

3. **Variable Reference**
   - Quick-reference list of available variables
   - Optionally: Click to insert variable at cursor position

4. **Visual Feedback**
   - Loading spinner while generating preview
   - "Preview outdated" indicator when content changes
   - Error message if preview fails

---

## UI Component Design

### Color Scheme (Matches Existing UI)
- Editor panel: White background
- Preview panel: Light gray background (`bg-gray-50`)
- Preview iframe: White with subtle border
- Refresh button: CAMP green accent

### Responsive Behavior
- Desktop (≥1024px): Side-by-side panels
- Mobile (<1024px): Stack vertically with tabs to switch between editor and preview

### Sample Data Presets

```typescript
const SAMPLE_RECIPIENTS = [
  { name: 'John', lastName: 'Doe' },
  { name: 'Jane', lastName: 'Smith' },
  { name: 'Alex', lastName: 'Johnson' },
]

const SAMPLE_CAMPERS = [
  { firstName: 'Sarah', lastName: 'Smith' },
  { firstName: 'Michael', lastName: 'Brown' },
  { firstName: 'Emma', lastName: 'Wilson' },
]
```

---

## Implementation Details

### Files to Modify

| File | Changes |
|------|---------|
| `frontend/app/super-admin/email-communication/page.tsx` | Redesign Template Dialog section |

### New State Variables

```typescript
// Add to existing component state
const [templatePreviewHtml, setTemplatePreviewHtml] = useState<string>('')
const [loadingTemplatePreview, setLoadingTemplatePreview] = useState(false)
const [previewSampleRecipient, setPreviewSampleRecipient] = useState<string>('John')
const [previewSampleCamper, setPreviewSampleCamper] = useState({ first: 'Sarah', last: 'Smith' })
const [previewOutdated, setPreviewOutdated] = useState(false)
```

### Preview Handler Function

```typescript
const handlePreviewTemplate = async () => {
  if (!token || !editingTemplate?.html_content) return
  try {
    setLoadingTemplatePreview(true)
    const result = await previewEmail(
      token,
      editingTemplate.subject || 'Preview Subject',
      editingTemplate.html_content,
      {
        recipientName: previewSampleRecipient,
        camperFirstName: previewSampleCamper.first,
        camperLastName: previewSampleCamper.last,
      }
    )
    setTemplatePreviewHtml(result.html)
    setPreviewOutdated(false)
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to generate preview')
  } finally {
    setLoadingTemplatePreview(false)
  }
}
```

### Auto-Preview Trigger
- Mark preview as "outdated" when content changes (don't auto-refresh)
- User clicks "Refresh Preview" button to update
- Optional: Debounced auto-refresh (500ms delay) for better UX

---

## Dialog Structure (New)

```tsx
<Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
  <DialogContent className="max-w-6xl max-h-[90vh]">
    <DialogHeader>
      <DialogTitle>{isCreatingTemplate ? 'Create Template' : 'Edit Template'}</DialogTitle>
    </DialogHeader>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-4">
      {/* LEFT: Editor Panel */}
      <div className="space-y-4">
        {/* Name, Subject, HTML Content inputs */}
        {/* Variable reference */}
        {/* Active toggle */}
      </div>

      {/* RIGHT: Preview Panel */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm text-gray-700">Live Preview</h3>
          <div className="flex items-center gap-2">
            {/* Sample data dropdowns */}
            <Button variant="outline" size="sm" onClick={handlePreviewTemplate}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Preview iframe */}
        <div className="relative">
          {previewOutdated && (
            <div className="absolute top-2 right-2 z-10">
              <Badge variant="outline" className="bg-amber-50 text-amber-700">
                Preview outdated
              </Badge>
            </div>
          )}
          {templatePreviewHtml ? (
            <iframe
              srcDoc={templatePreviewHtml}
              className="w-full h-[500px] border rounded-lg bg-white"
              title="Template Preview"
            />
          ) : (
            <div className="h-[500px] border rounded-lg bg-gray-50 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <Eye className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Click "Refresh Preview" to see how your template will look</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

    <DialogFooter>
      <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
        Cancel
      </Button>
      <Button onClick={handleSaveTemplate} disabled={savingTemplate}>
        {isCreatingTemplate ? 'Create' : 'Save Template'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## Variable Quick Reference Component

```tsx
<div className="bg-blue-50 rounded-lg p-3 text-xs">
  <p className="font-medium text-blue-800 mb-2">Available Variables:</p>
  <div className="flex flex-wrap gap-1.5">
    {[
      '{{firstName}}',
      '{{lastName}}',
      '{{camperName}}',
      '{{camperFirstName}}',
      '{{camperLastName}}',
      '{{campYear}}',
      '{{appUrl}}',
      '{{completionPercentage}}',
      '{{paymentUrl}}',
    ].map((v) => (
      <code
        key={v}
        className="bg-white px-1.5 py-0.5 rounded border border-blue-200 text-blue-700 cursor-pointer hover:bg-blue-100"
        onClick={() => insertVariable(v)}
        title="Click to copy"
      >
        {v}
      </code>
    ))}
  </div>
</div>
```

---

## Sample Data Dropdown Component

```tsx
<div className="flex items-center gap-2 text-xs">
  <span className="text-gray-500">Sample:</span>
  <Select value={previewSampleRecipient} onValueChange={setPreviewSampleRecipient}>
    <SelectTrigger className="w-24 h-7 text-xs">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="John">John</SelectItem>
      <SelectItem value="Jane">Jane</SelectItem>
      <SelectItem value="Alex">Alex</SelectItem>
    </SelectContent>
  </Select>
  <span className="text-gray-400">/</span>
  <Select
    value={`${previewSampleCamper.first} ${previewSampleCamper.last}`}
    onValueChange={(v) => {
      const [first, last] = v.split(' ')
      setPreviewSampleCamper({ first, last })
    }}
  >
    <SelectTrigger className="w-32 h-7 text-xs">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="Sarah Smith">Sarah Smith</SelectItem>
      <SelectItem value="Michael Brown">Michael Brown</SelectItem>
      <SelectItem value="Emma Wilson">Emma Wilson</SelectItem>
    </SelectContent>
  </Select>
</div>
```

---

## Implementation Steps

### Step 1: Expand Dialog & Add State (15 min)
- Change dialog from `max-w-4xl` to `max-w-6xl`
- Add preview state variables
- Add sample data state

### Step 2: Create Two-Column Layout (20 min)
- Move existing form fields to left column
- Create right column for preview panel
- Add responsive grid classes

### Step 3: Implement Preview Handler (15 min)
- Create `handlePreviewTemplate` function
- Wire up to existing `previewEmail` API
- Handle loading/error states

### Step 4: Build Preview Panel UI (30 min)
- Add preview iframe with placeholder
- Add sample data dropdowns
- Add "Preview outdated" badge
- Add refresh button

### Step 5: Add Variable Reference (10 min)
- Create clickable variable chips
- Optional: Insert at cursor functionality

### Step 6: Polish & Test (20 min)
- Test with different templates
- Verify variable substitution works
- Test responsive behavior
- Ensure preview updates correctly

---

## Edge Cases to Handle

| Scenario | Behavior |
|----------|----------|
| Empty HTML content | Show placeholder message in preview |
| Invalid HTML | Display error in preview panel, don't crash |
| API timeout | Show error message, allow retry |
| Very long email | Iframe scrolls internally |
| Special characters in variables | Should render correctly (API handles escaping) |

---

## Future Enhancements (Out of Scope)

- Syntax highlighting for HTML textarea (would need Monaco/CodeMirror)
- Real-time preview (debounced auto-refresh on typing)
- Mobile device preview (simulate narrow viewport)
- Dark mode preview
- Send test email button

---

## Summary

This implementation adds a professional live preview feature that:
1. Uses existing `previewEmail` API (no backend changes needed)
2. Follows the same pattern as Mass Email tab for consistency
3. Allows testing with different sample data
4. Provides quick variable reference
5. Fits naturally into the existing UI

**Total estimated time: 1.5-2 hours**
