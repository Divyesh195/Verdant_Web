1. For registration "supabase.auth.signUp" method is used, which takes a pair of email and password.

2. For signIn "supabase.auth.signInWithPassword" methos is used, which takes a pair of email and password.

3. Project uses "/api/auth/sync" API call to sync user's data from auth.users to public.users.

4. There is a feature "forgot-password", which sends email (if acc exists) with a password reset link. Currently email sending is handled by supabase which is limited to (2 mails per hour)..

```
await supabase.auth.resetPasswordForEmail()
await supabase.auth.updateUser({ password })
```