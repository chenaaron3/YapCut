# Unclaimed Projects and landing trial

A **Project** may exist with no User so a visitor can drop one video on the landing page, run create, and watch the result without signing in. We rejected a shadow User (Claim would be a merge) and a private access cookie (knowing the id is enough until Claim). The editor and project list stay login-gated; unclaimed UI lives only on landing. **Claim** attaches a User and is required to open the editor or Export.
