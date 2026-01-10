# Future Enhancements

This document tracks future enhancement ideas for the CAMP FASD Application Portal.

---

## How to Add New Enhancements

**For Claude:** When asked to add a new enhancement, copy the template below and fill it in.

**For Humans:** Copy the template and fill in the details, or just describe the idea and ask Claude to scope it.

### Template (Copy This)

```
---

## [NUMBER]. [TITLE]

**Status:** Idea | Scoped | In Progress | Complete
**Priority:** Low | Medium | High | Critical
**Effort:** ~X hours

### Overview
Brief description of the enhancement.

### Current State
What exists today and why it's insufficient.

### Proposed Enhancement
What the new behavior should be.

### Implementation Scope
- Backend changes needed
- Frontend changes needed
- Database changes needed

### Files to Modify
- List of files

### Considerations
- Edge cases, performance, etc.
```

---
---

# Enhancement List

---

## 1. Dynamic Incomplete Sections in Reminder Emails

**Status:** Scoped
**Priority:** Medium
**Effort:** ~4-6 hours

### Overview
Include a personalized list of incomplete sections in the "Incomplete Forms Reminder" email, so families know exactly what they need to complete.

### Current State
- Email shows `{{completionPercentage}}%` but not WHICH sections are incomplete
- Families must log in to see what's missing

### Proposed Enhancement
Email would include something like:
```
Sections still needing completion:
- Medical History (0%)
- Emergency Contacts (50%)
- Authorization & Consent (0%)
```

### Implementation Scope

#### Backend Changes (`backend/app/services/email_events.py`)

1. **Add helper function** to calculate incomplete sections per application:
   ```python
   def get_incomplete_sections(application_id: UUID, db: Session) -> List[dict]:
       # Query application_sections joined with responses
       # Return list of {section_name, completion_percentage}
       # where completion < 100%
   ```

2. **Update `fire_email_event()`** to include `incompleteSections` in context when event is `incomplete_reminder`

#### Email Template Changes

3. **Add new template variable** `{{incompleteSections}}` that renders as:
   - Markdown list of section names with their completion %
   - Or "All sections complete!" if none

4. **Update `incomplete_reminder` template** to include the dynamic list

#### Database Query (example)
```sql
SELECT
  s.title as section_name,
  COALESCE(
    ROUND(
      COUNT(CASE WHEN ar.response_value IS NOT NULL THEN 1 END)::numeric /
      NULLIF(COUNT(q.id), 0) * 100
    ), 0
  ) as completion_pct
FROM application_sections s
JOIN application_questions q ON q.section_id = s.id
LEFT JOIN application_responses ar ON ar.question_id = q.id
  AND ar.application_id = :app_id
WHERE s.is_active = true
  AND q.is_active = true
  AND q.is_required = true
GROUP BY s.id, s.title, s.order_index
HAVING COUNT(CASE WHEN ar.response_value IS NOT NULL THEN 1 END) < COUNT(q.id)
ORDER BY s.order_index;
```

### Files to Modify
- `backend/app/services/email_events.py` - Add section calculation logic
- `backend/app/services/email_service.py` - Handle new template variable
- Email template in database (`incomplete_reminder`)

### Considerations
- Performance: Query runs for each email sent (batch jobs should be efficient)
- Section visibility rules (required_status) must be respected
- Consider caching section completion if sending many emails

---

## 2. [Next Enhancement Goes Here]

_Use the template above to add new enhancements_
