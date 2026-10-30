# Everly Security Specification & Rules Architecture

## 1. Data Invariants
- Access to Everly is strictly restricted to verified Google accounts: `benilin76@gmail.com` (Owner) and `shanalove917@gmail.com` (Member).
- All standard write operations mandate verified email tokens (`request.auth.token.email_verified == true`).
- Any attempt by an unauthorized email (e.g. `benilin40@gmail.com` or third parties) must be rejected with PERMISSION_DENIED.
- Roles are server-authoritative: Users cannot elevate their own role to 'Owner' upon profile creation or update.
- Document IDs must satisfy `isValidId(id)` (`id is string && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$')`).
- String fields enforce strict `.size() <= MAX` bounds to prevent denial-of-wallet resource attacks.
- Timestamps must validate against `request.time`.

## 2. The "Dirty Dozen" Payloads (Must be rejected with PERMISSION_DENIED)
1. **Unauthenticated Write**: Writing to `/memoryNotes/{noteId}` without `request.auth`.
2. **Unauthorized Email**: Writing from `benilin40@gmail.com` or any email outside the whitelist.
3. **Unverified Email**: Writing with `email_verified == false`.
4. **Privilege Escalation**: Member `shanalove917@gmail.com` attempting to set role to `Owner`.
5. **Shadow Field Injection**: Inserting `{ isSuperAdmin: true }` into `/users/{userId}`.
6. **Giant ID Attack**: Attempting to use a 10KB string as a note or user document ID.
7. **Identity Spoofing**: Setting `authorEmail` to `benilin76@gmail.com` when authenticated as another user.
8. **Negative / NaN File Size**: Attempting to store `size: -500` or invalid types in `/mediaFiles/{fileId}`.
9. **Blanket Read Snooping**: Querying notes or messages without filtering to authorized participants.
10. **Oversized Text Bomb**: Submitting a `content` field exceeding 4000 characters in `/memoryNotes/{noteId}`.
11. **Client Timestamp Spoofing**: Passing a historical client timestamp to bypass chronological ordering.
12. **Tampering with Note Author**: Modifying `authorEmail` on an existing note during an update.

## 3. Security Helper Primitives
- `isSignedIn()`: Auth token exists and is valid.
- `isVerifiedEmail()`: User email is verified (`request.auth.token.email_verified == true`).
- `isAuthorizedAccount()`: Lowercase email matches either `benilin76@gmail.com` or `shanalove917@gmail.com`.
- `isOwner()`: Lowercase email matches `benilin76@gmail.com`.
- `isValidId(id)`: Regex and length enforcement on all path IDs.
