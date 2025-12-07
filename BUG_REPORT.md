# Bug Report - Walt IPFS Drive

This document lists all identified bugs and issues in the codebase.

## 🔴 Critical Bugs

### 1. **Null/Undefined Access in File Upload** 
**File:** `backend/server.js:408-409`  
**Severity:** High  
**Issue:** `storageStats` could be null/undefined if user doesn't exist in database

```javascript
const storageStats = db.prepare('SELECT storage_used, storage_limit FROM users WHERE id = ?').get(user.id);
if (storageStats.storage_used + req.file.size > storageStats.storage_limit) {
```

**Problem:** If `storageStats` is `null` or `undefined`, accessing `storageStats.storage_used` will throw a TypeError.

**Fix:**
```javascript
const storageStats = db.prepare('SELECT storage_used, storage_limit FROM users WHERE id = ?').get(user.id);
if (!storageStats) {
  return res.status(500).json({ error: 'User storage information not found' });
}
if (storageStats.storage_used + req.file.size > storageStats.storage_limit) {
```

---

### 2. **Response.json() Called Before Checking response.ok**
**File:** `components/PaymentModal.tsx:221`  
**Severity:** High  
**Issue:** Attempts to parse JSON from error responses, which may not be valid JSON

```typescript
const data = await response.json();

if (!response.ok) {
  throw new Error(data.error || 'Failed to create payment order');
}
```

**Problem:** If the response is not OK and doesn't contain valid JSON (e.g., HTML error page, empty body), `response.json()` will throw an error.

**Fix:**
```typescript
if (!response.ok) {
  const errorData = await response.json().catch(() => ({ error: 'Failed to create payment order' }));
  throw new Error(errorData.error || 'Failed to create payment order');
}

const data = await response.json();
```

**Also affects:**
- `pages/api/ipfs/upload.ts:87` - Same pattern
- `pages/api/ipfs/list.ts:42` - Same pattern

---

### 3. **Early Return Without Cleaning Up Loading State**
**File:** `components/PaymentModal.tsx:207-209`  
**Severity:** Medium  
**Issue:** Early return leaves loading state as `true`

```typescript
if (!user) {
  setError('Please log in to continue');
  return; // ❌ Loading state remains true!
}
```

**Problem:** The `setLoading(true)` was called earlier, but if user is null, we return early without setting it back to false, leaving the UI in a loading state.

**Fix:**
```typescript
if (!user) {
  setError('Please log in to continue');
  setLoading(false); // ✅ Clean up loading state
  return;
}
```

---

## 🟡 Medium Priority Bugs

### 4. **Missing Null Check in Billing Status**
**File:** `backend/server.js:1205`  
**Severity:** Medium  
**Issue:** Potential null access when calculating billing

```javascript
const pinnedFiles = db.prepare(`...`).get(user.id);
const pinnedSizeBytes = pinnedFiles?.total_pinned_size || 0;
```

**Status:** ✅ Actually safe - uses optional chaining, but could be more explicit.

---

### 5. **Unhandled Promise Rejection in Payment Polling**
**File:** `components/PaymentModal.tsx:248-270`  
**Severity:** Medium  
**Issue:** `pollPaymentStatus` doesn't handle errors properly

```typescript
const pollPaymentStatus = async (orderId: string) => {
  // ... polling logic
  // ❌ No try-catch around the entire function
}
```

**Problem:** If any error occurs during polling, it will be an unhandled promise rejection.

**Fix:** Wrap the entire polling logic in try-catch.

---

### 6. **Race Condition in File Upload**
**File:** `backend/server.js:459-460`  
**Severity:** Medium  
**Issue:** Storage update happens after file insert, could cause inconsistency

```javascript
db.prepare(`INSERT INTO files ...`).run(...);
db.prepare("UPDATE users SET storage_used = storage_used + ? ...").run(size, user.id);
```

**Problem:** If the second query fails, the file is inserted but storage isn't updated. Should use a transaction.

**Fix:** Use database transaction to ensure atomicity.

---

## 🟢 Low Priority / Code Quality Issues

### 7. **Inconsistent Error Handling**
**File:** Multiple files  
**Severity:** Low  
**Issue:** Some places use `.catch()` for JSON parsing, others don't

**Examples:**
- ✅ Good: `lib/backendClient.ts:54` - Uses `.catch()`
- ❌ Bad: `components/PaymentModal.tsx:221` - No `.catch()`

**Recommendation:** Standardize error handling pattern across all fetch calls.

---

### 8. **Missing Input Validation**
**File:** `backend/server.js:445`  
**Severity:** Low  
**Issue:** `folderId` from request body not validated

```javascript
const folderId = req.body.folderId || null;
```

**Problem:** No validation that `folderId` is a valid UUID or exists in database. Could lead to orphaned file references.

**Fix:** Validate `folderId` exists and belongs to user before using.

---

### 9. **Potential Memory Leak in File Upload**
**File:** `backend/server.js:439`  
**Severity:** Low  
**Issue:** Temporary file not cleaned up on error

```javascript
const fileBuffer = await readFile(req.file.path);
// If error occurs after this, /tmp file is not deleted
```

**Problem:** Temporary files in `/tmp` may accumulate if errors occur.

**Fix:** Use try-finally to ensure cleanup:
```javascript
try {
  const fileBuffer = await readFile(req.file.path);
  // ... rest of logic
} finally {
  // Clean up temp file
  if (req.file?.path) {
    unlink(req.file.path).catch(console.error);
  }
}
```

---

### 10. **Missing Type Safety**
**File:** `components/PaymentModal.tsx:241`  
**Severity:** Low  
**Issue:** Using `any` type for error

```typescript
} catch (err: any) {
  setError(err.message || 'Failed to create payment order');
}
```

**Fix:** Use proper error type:
```typescript
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : 'Failed to create payment order';
  setError(message);
}
```

---

## 📋 Summary

| Severity | Count | Files Affected |
|----------|-------|----------------|
| 🔴 Critical | 3 | `backend/server.js`, `components/PaymentModal.tsx`, `pages/api/ipfs/*.ts` |
| 🟡 Medium | 3 | `backend/server.js`, `components/PaymentModal.tsx` |
| 🟢 Low | 4 | Multiple files |

---

## 🔧 Recommended Fix Priority

1. **Fix #1** (Null access) - Can cause server crashes
2. **Fix #2** (Response.json order) - Can cause runtime errors
3. **Fix #3** (Loading state) - Affects UX
4. **Fix #5** (Promise rejection) - Can cause console errors
5. **Fix #6** (Race condition) - Data consistency issue
6. **Fix #7-10** (Code quality) - Improve robustness

---

## 🧪 Testing Recommendations

After fixing these bugs, test:

1. **File upload with non-existent user** (Fix #1)
2. **Payment flow with network errors** (Fix #2, #3)
3. **Concurrent file uploads** (Fix #6)
4. **Payment polling with errors** (Fix #5)
5. **Large file uploads** (Fix #9)

---

## 📝 Notes

- Most SQL queries use parameterized queries (✅ safe from SQL injection)
- Error handling is generally good, but inconsistent
- TypeScript types could be stricter in some places
- Consider adding input validation middleware

---

**Generated:** $(Get-Date)  
**Reviewed Files:** Backend server, Frontend components, API routes

