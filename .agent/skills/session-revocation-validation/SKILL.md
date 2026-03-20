---
name: session-revocation-validation
description: Pattern for implementing session revocation and validation in SPAs. Covers backend token validation with session status checks, frontend always-validate-on-mount pattern, and auth store cleanup. Use when implementing session management, logout-from-other-devices, or fixing persisted auth state bugs.
---

# Session Revocation & Validation Pattern

## Problem

When implementing session management with the ability to revoke sessions (e.g., "logout from other devices"), a common bug occurs:

**Scenario:**
1. User logs in on Browser A and Browser B
2. From Browser A, user revokes session for Browser B
3. Browser B **refreshes the page** - but the user is still logged in!

**Why it happens:**
- Frontend uses persisted state (zustand, Redux, localStorage)
- On page reload, `isAuthenticated: true` is restored from persistence
- Auth check is skipped because the app thinks user is already authenticated
- The revoked session's token continues working until an API call fails

## Solution

### 1. Backend: Validate Session in Token Validation

The backend must check session status when validating tokens:

```typescript
// auth-service/handlers/auth.ts - ValidateToken handler
export async function ValidateToken(call: any, callback: any) {
  const { token } = call.request;
  const payload = verifyAccessToken(token);

  // CRITICAL: Check if session is still active
  if (payload.sessionId) {
    const session = await Session.findById(payload.sessionId);
    if (!session || !session.isActive) {
      return callback(null, {
        valid: false,
        message: 'Session has been revoked',
      });
    }

    // Update last activity
    session.lastActivityAt = new Date();
    await session.save();
  }

  // Continue with user validation...
}
```

### 2. Frontend: Always Validate on Mount

The `ProtectedRoute` component must **always** call the backend to validate the session on mount, regardless of persisted state:

```tsx
// components/auth/ProtectedRoute.tsx
import { useEffect, useState, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export function ProtectedRoute({ children, allowedRoles }) {
  const location = useLocation();
  const { isAuthenticated, user, checkAuth } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    const verify = async () => {
      // ALWAYS validate session on mount (page load/reload)
      // This ensures revoked sessions are detected
      if (!hasCheckedRef.current) {
        hasCheckedRef.current = true;
        await checkAuth(); // Calls /api/auth/me which validates token
      }
      setIsChecking(false);
    };
    verify();
  }, [checkAuth]);

  // Show loading spinner while validating
  if (isChecking) {
    return <LoadingSpinner />;
  }

  // Not authenticated - redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
```

### 3. Auth Store: Clear State on Invalid Token

```typescript
// store/authStore.ts
checkAuth: async () => {
  const accessToken = localStorage.getItem('access_token');
  if (!accessToken) {
    set({ isAuthenticated: false, user: null });
    return false;
  }

  try {
    const response = await authService.getMe(); // Validates token via backend
    if (response.success && response.data) {
      set({
        user: response.data,
        isAuthenticated: true,
      });
      return true;
    }
  } catch {
    // Token invalid or session revoked - clear everything
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    set({
      isAuthenticated: false,
      user: null,
      accessToken: null,
      refreshToken: null
    });
  }
  return false;
}
```

## Key Points

1. **Never trust persisted auth state alone** - Always validate with backend on page load
2. **Backend must check session status** - JWT signature validation is not enough
3. **Use `useRef` to prevent double-checking** - React StrictMode can cause double mounts
4. **Show loading state** - User should see a spinner while validating, not flash of content
5. **Clear all auth state on failure** - localStorage, zustand/Redux, and memory state

## Common Mistakes

❌ **Wrong:** Only call `checkAuth()` when `!isAuthenticated`
```tsx
// BAD - skips validation when state is persisted
if (!isAuthenticated) {
  await checkAuth();
}
```

✅ **Correct:** Always call `checkAuth()` on mount
```tsx
// GOOD - always validates with backend
if (!hasCheckedRef.current) {
  hasCheckedRef.current = true;
  await checkAuth();
}
```

## Testing

To test session revocation:
1. Login on two browsers (A and B)
2. From A, go to Settings > Sessions > Revoke session B
3. On B, refresh the page
4. B should be redirected to login page

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER B (Revoked)                     │
├─────────────────────────────────────────────────────────────────┤
│  1. Page Reload                                                  │
│       ↓                                                          │
│  2. ProtectedRoute mounts                                        │
│       ↓                                                          │
│  3. checkAuth() calls GET /api/auth/me                          │
│       ↓                                                          │
│  4. Gateway validates token via gRPC → Auth Service              │
│       ↓                                                          │
│  5. Auth Service checks Session.isActive === false               │
│       ↓                                                          │
│  6. Returns { valid: false, message: "Session revoked" }         │
│       ↓                                                          │
│  7. Frontend clears state & redirects to /login                  │
└─────────────────────────────────────────────────────────────────┘
```

## Frameworks & Libraries

This pattern applies to:
- **React** with zustand, Redux, Jotai, or any state manager
- **Vue** with Pinia or Vuex
- **Angular** with NgRx or services
- **Next.js** App Router (use middleware + client validation)
- **Any SPA** with persisted authentication state

## Performance Consideration

Calling the backend on every page load adds latency. Mitigations:
- Use fast endpoints (just validate token, don't load full user profile)
- Consider caching with short TTL (e.g., 30 seconds)
- For critical apps, accept the latency as security cost
