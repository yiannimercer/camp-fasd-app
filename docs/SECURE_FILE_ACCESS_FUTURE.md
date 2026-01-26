# Secure File Access - Future Enhancement

## Current State (As of January 2026)

Application files (medical records, IEPs, etc.) are stored in a **private** Supabase Storage bucket. Access is granted via **signed URLs** with a **15-minute expiration**.

### How It Works Now

1. User/Admin requests a file through our API
2. Backend verifies authentication (JWT token)
3. Backend generates a signed URL from Supabase
4. Signed URL is returned to the frontend
5. Frontend uses the URL to display/download the file

### Security Concern

Signed URLs are **shareable** - anyone with the URL can access the file until it expires. While the 15-minute window is short, it still allows:
- Accidental sharing (copy-paste URL)
- URL interception (though mitigated by HTTPS)
- Browser history exposure

---

## Proposed Enhancement: Backend File Proxy

### Overview

Instead of exposing signed URLs to the frontend, create an authenticated API endpoint that **streams files directly** through the backend. The frontend never sees a shareable URL.

### Architecture

```
Current:
  Frontend → API (get signed URL) → Frontend uses URL → Supabase Storage
                                    ↑
                                    Anyone with URL can access

Proposed:
  Frontend → API (stream file) → Supabase Storage
             ↓
             File bytes streamed to authenticated user only
```

### Implementation Plan

#### 1. New API Endpoint

```python
# backend/app/api/files.py

from fastapi.responses import StreamingResponse

@router.get("/{file_id}/stream")
async def stream_file(
    file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Stream a file directly to the authenticated user.
    No signed URL is exposed - file bytes are proxied through the backend.
    """
    # Get file record
    file_record = db.query(FileModel).filter(FileModel.id == file_id).first()
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    # Authorization check
    if file_record.application_id:
        application = db.query(Application).filter(
            Application.id == file_record.application_id
        ).first()

        # User can only access their own files, admins can access all
        if application.user_id != current_user.id and current_user.role not in ["admin", "super_admin"]:
            raise HTTPException(status_code=403, detail="Access denied")

    # Download file from storage (server-side only)
    file_bytes = storage_service.download_file(file_record.storage_path)

    # Stream to client
    return StreamingResponse(
        io.BytesIO(file_bytes),
        media_type=file_record.file_type,
        headers={
            "Content-Disposition": f'inline; filename="{file_record.file_name}"',
            "Cache-Control": "private, no-store, max-age=0"
        }
    )
```

#### 2. Frontend Changes

Update file viewing to use the streaming endpoint:

```typescript
// Instead of using signed URL directly:
// <img src={signedUrl} />

// Use authenticated fetch:
const response = await fetch(`${API_URL}/api/files/${fileId}/stream`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const blob = await response.blob();
const objectUrl = URL.createObjectURL(blob);
// Use objectUrl for display, revoke when done
```

#### 3. Benefits

| Aspect | Signed URLs | Backend Proxy |
|--------|-------------|---------------|
| Shareable? | Yes (during expiration window) | No |
| Requires auth for every access? | No (URL is self-authenticating) | Yes |
| Backend load | Low (just generates URL) | Higher (streams all files) |
| Latency | Lower (direct to storage) | Slightly higher (extra hop) |
| Audit trail | Limited | Full (every access logged) |

#### 4. Considerations

- **Performance**: Backend becomes a bottleneck for file serving. Consider:
  - Caching frequently accessed files
  - Using chunked streaming for large files
  - Rate limiting to prevent abuse

- **Memory**: Large files could consume significant memory. Use streaming (chunked reads) rather than loading entire file into memory.

- **Timeout**: Vercel has a 60-second function timeout. Large files may need special handling or a dedicated file server.

- **CDN**: Cannot use CDN caching since every request needs authentication.

---

## Recommended Approach

### Phase 1 (Current)
- 15-minute signed URL expiration ✅
- Acceptable for most use cases
- Low complexity

### Phase 2 (If Needed)
- Implement backend proxy for **sensitive files only** (medical records, IEPs)
- Keep signed URLs for **non-sensitive files** (profile photos, general documents)
- Add comprehensive audit logging

### Phase 3 (Optional)
- Full backend proxy for all files
- Zero shareable URLs
- Complete access control

---

## When to Implement

Consider implementing the backend proxy if:
1. Compliance requirements demand it (HIPAA, etc.)
2. There's evidence of URL sharing/leakage
3. Audit requirements need per-access logging
4. Users report security concerns

---

## Related Files

- `backend/app/api/files.py` - Current file endpoints
- `backend/app/services/storage_service.py` - Storage operations
- `frontend/lib/api-files.ts` - Frontend file API client
