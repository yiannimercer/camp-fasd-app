# Performance Optimizations - CAMP FASD Application

> **Last Updated:** January 5, 2026
> **Status:** Planning Document
> **Primary Developer:** Claude Code

---

## Summary

This document outlines potential performance optimizations for the CAMP FASD application, specifically focused on improving load times for:
- `/admin/applications/{id}` - Admin application review page
- `/dashboard/application/{id}` - User application form page

---

## ✅ Completed Optimizations

These optimizations have already been implemented:

| Optimization | Impact | Files Modified |
|-------------|--------|----------------|
| **N+1 Query Fix: Sections Endpoint** | Reduced 14 queries → 1 | `backend/app/api/applications.py` |
| **N+1 Query Fix: Progress Endpoint** | Reduced 14 queries → 1 | `backend/app/api/applications.py` |
| **N+1 Query Fix: Completion Calculation** | Reduced 14 queries → 1 | `backend/app/api/applications.py` |
| **N+1 Query Fix: Autosave (User)** | Reduced 2N queries → 2 | `backend/app/api/applications.py` |
| **N+1 Query Fix: Autosave (Admin)** | Reduced 2N queries → 2 | `backend/app/api/admin.py` |
| **Batch File Loading (Admin Page)** | Reduced N HTTP requests → 1 | `frontend/app/admin/applications/[id]/page.tsx` |

**Estimated Total Improvement:** ~70% reduction in database queries per page load

---

## 🟢 Quick Wins

Low effort optimizations with good impact. Can be implemented quickly.

### 1. Browser Cache for Sections & Questions

**Effort:** 30-45 minutes
**Impact:** High - Near-instant subsequent page loads for static data

**Problem:**
Sections and questions are fetched on every application page load, but this data rarely changes (only when super admin edits the form builder).

**Solution:**
Cache sections/questions data in the browser using localStorage or a caching library (SWR, React Query, or custom cache).

**Implementation:**
```typescript
// Pseudo-code for caching approach
const CACHE_KEY = 'app_sections_v1'
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function getCachedSections() {
  const cached = localStorage.getItem(CACHE_KEY)
  if (cached) {
    const { data, timestamp } = JSON.parse(cached)
    if (Date.now() - timestamp < CACHE_TTL) {
      return data
    }
  }
  return null
}
```

**Files to Modify:**
- `frontend/lib/api-applications.ts` - Add caching layer
- `frontend/app/dashboard/application/[id]/page.tsx` - Use cached data
- `frontend/app/admin/applications/[id]/page.tsx` - Use cached data

---

### 2. Database Index Verification

**Effort:** 15-30 minutes
**Impact:** Medium - Faster query execution

**Problem:**
Queries on `application_responses` and `application_questions` may be slow without proper indexes.

**Solution:**
Verify and add missing indexes:

```sql
-- Check existing indexes
SELECT indexname, tablename, indexdef
FROM pg_indexes
WHERE tablename IN ('application_responses', 'application_questions', 'applications');

-- Add if missing
CREATE INDEX IF NOT EXISTS idx_app_responses_app_id
  ON application_responses(application_id);

CREATE INDEX IF NOT EXISTS idx_app_responses_question_id
  ON application_responses(question_id);

CREATE INDEX IF NOT EXISTS idx_app_responses_composite
  ON application_responses(application_id, question_id);

CREATE INDEX IF NOT EXISTS idx_questions_section_id
  ON application_questions(section_id);

CREATE INDEX IF NOT EXISTS idx_questions_active
  ON application_questions(is_active) WHERE is_active = true;
```

**Files to Modify:**
- `supabase/migrations/025_performance_indexes.sql` (new file)

---

### 3. Reduce API Response Payload Size

**Effort:** 30-45 minutes
**Impact:** Medium - Faster network transfer

**Problem:**
API responses may include unnecessary fields (e.g., full user objects, all timestamps, internal metadata).

**Solution:**
Audit and trim response payloads to only include fields the frontend actually uses.

**Potential Savings:**
- Remove nested user objects (just return user_id)
- Remove internal timestamps if not displayed
- Remove soft-delete fields

**Files to Modify:**
- `backend/app/schemas/application.py` - Create lighter response schemas
- `backend/app/api/applications.py` - Use trimmed schemas

---

## 🟡 Medium Effort

Moderate effort with high impact. Worth doing if performance is still a concern.

### 4. Lazy Load Sections

**Effort:** 2-3 hours
**Impact:** High - Significantly faster initial page load

**Problem:**
Currently loads ALL responses for all 13 sections upfront, even though user only views one section at a time.

**Solution:**
Only load responses for the currently visible section. Prefetch next section in background.

**Implementation Approach:**
1. Initial load: Fetch application metadata + current section responses only
2. On section change: Fetch that section's responses (or use prefetched data)
3. Background: Prefetch adjacent sections

**API Changes:**
```python
# New endpoint or query parameter
GET /api/applications/{id}/responses?section_id={section_id}
```

**Files to Modify:**
- `backend/app/api/applications.py` - Add section-filtered response endpoint
- `frontend/app/dashboard/application/[id]/page.tsx` - Implement lazy loading
- `frontend/app/admin/applications/[id]/page.tsx` - Implement lazy loading

---

### 5. Server-Side Caching for Sections/Questions

**Effort:** 1-2 hours
**Impact:** Medium-High - Faster API responses

**Problem:**
Sections and questions are queried from database on every request, but they rarely change.

**Solution:**
Add in-memory caching on the backend using `functools.lru_cache` or a caching library.

**Implementation:**
```python
from functools import lru_cache
from datetime import datetime, timedelta

_sections_cache = None
_sections_cache_time = None
CACHE_TTL = timedelta(minutes=5)

def get_cached_sections(db):
    global _sections_cache, _sections_cache_time

    if _sections_cache and _sections_cache_time:
        if datetime.now() - _sections_cache_time < CACHE_TTL:
            return _sections_cache

    # Fetch from DB
    sections = db.query(ApplicationSection)...
    _sections_cache = sections
    _sections_cache_time = datetime.now()
    return sections
```

**Files to Modify:**
- `backend/app/api/applications.py` - Add caching layer
- `backend/app/core/cache.py` (new file) - Centralized cache utilities

---

### 6. Skeleton Loading UI

**Effort:** 1-2 hours
**Impact:** Medium - Better perceived performance (not actual speed)

**Problem:**
Users see a blank page or spinner while data loads, which feels slow.

**Solution:**
Show skeleton placeholders that match the page layout while data loads.

**Implementation:**
- Create skeleton components for sections, questions, and cards
- Display immediately on mount
- Replace with real data when loaded

**Files to Modify:**
- `frontend/components/skeletons/` (new directory)
- `frontend/app/dashboard/application/[id]/page.tsx`
- `frontend/app/admin/applications/[id]/page.tsx`

---

## 🔴 Higher Effort

More complex optimizations for future consideration.

### 7. Combined Full-Application Endpoint

**Effort:** 3-4 hours
**Impact:** Medium - Reduces HTTP round trips

**Problem:**
Frontend makes 3-4 separate API calls to load a full application:
1. `GET /applications/{id}` - Application data
2. `GET /applications/{id}/sections` - Sections with questions
3. `GET /applications/{id}/progress` - Progress data
4. `GET /files/batch` - File metadata

**Solution:**
Create a single endpoint that returns everything:
```python
GET /api/applications/{id}/full
# Returns: application + sections + questions + responses + progress + files
```

**Trade-offs:**
- ✅ Single HTTP request
- ✅ Server can optimize the query
- ❌ Larger single response
- ❌ Can't cache parts separately

**Files to Modify:**
- `backend/app/api/applications.py` - New combined endpoint
- `frontend/lib/api-applications.ts` - New API function
- Both application pages - Use new endpoint

---

### 8. GraphQL or Sparse Fieldsets

**Effort:** 1-2 days
**Impact:** High - Flexible, efficient data fetching

**Problem:**
REST endpoints return fixed payloads. Frontend may only need subset of data.

**Solution:**
Implement GraphQL or add sparse fieldset support to REST API.

**Example (Sparse Fieldsets):**
```
GET /api/applications/{id}?fields=id,status,responses.question_id,responses.response_value
```

**Trade-offs:**
- ✅ Frontend requests only what it needs
- ✅ Reduces payload size significantly
- ❌ More complex API implementation
- ❌ Harder to cache on server

---

### 9. Redis Caching Layer

**Effort:** 4-6 hours
**Impact:** High - Millisecond response times for cached data

**Problem:**
Database queries have latency even when optimized.

**Solution:**
Add Redis for caching frequently accessed data:
- Sections and questions (rarely change)
- Application metadata (moderate change frequency)
- User session data

**Requirements:**
- Redis instance (Supabase doesn't include Redis, would need external service)
- Cache invalidation strategy
- Environment configuration

---

## Priority Recommendation

Based on effort vs. impact, here's the recommended order:

| Priority | Optimization | Effort | Impact |
|----------|-------------|--------|--------|
| 1 | Browser Cache for Sections | 30-45 min | High |
| 2 | Database Index Verification | 15-30 min | Medium |
| 3 | Reduce API Payload Size | 30-45 min | Medium |
| 4 | Skeleton Loading UI | 1-2 hours | Medium |
| 5 | Lazy Load Sections | 2-3 hours | High |
| 6 | Server-Side Caching | 1-2 hours | Medium-High |
| 7 | Combined Endpoint | 3-4 hours | Medium |

**Total estimated time for priorities 1-4:** ~3-4 hours
**Total estimated time for all:** ~12-16 hours

---

## Measuring Performance

Before and after implementing optimizations, measure:

### Backend Metrics
```python
# Add timing logs
import time
start = time.time()
# ... query ...
print(f"Query took {time.time() - start:.3f}s")
```

### Frontend Metrics
```typescript
// Measure page load time
const start = performance.now()
// ... after data loaded ...
console.log(`Page loaded in ${performance.now() - start}ms`)
```

### Browser DevTools
- Network tab: Total requests, transfer size, timing
- Performance tab: Time to interactive, largest contentful paint

---

## Notes

- All time estimates assume Claude Code as primary developer
- Estimates include testing but not extensive QA
- Some optimizations may have diminishing returns if others are already implemented
- Consider A/B testing major changes to measure real-world impact
