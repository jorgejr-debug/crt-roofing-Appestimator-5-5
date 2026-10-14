# Owner task overview

Prepared October 2, 2026. User reported the production database migration succeeded. Frontend publication remains pending; live Owner-view verification has not been performed.

User requested viewing all tasks and task discussions only. The new All team tasks (read-only) scope is available to jorgejr@crtroofing.com while their profile role is CFO or admin. Server-side SELECT policies check the authenticated auth.users email and current profile role. They do not broaden can_access_company_task, participant updates, assignment writes, comment writes, storage access, direct messages or notifications. My Tasks keeps existing participant actions.

The owner view includes all task statuses by default, existing status/type/search filters, an assigned-employee filter and a Refresh button. Task descriptions, status, assignees and discussion comments are visible. Status actions, deletion, commenting and attachment controls are hidden in this scope. This does not provide employee impersonation or private direct-message access.

Deployment: apply only supabase/migrations/20261002160000_owner_task_read_view.sql to production, then publish the frontend through the existing website deployment process. No full historical migration replay. The database update alone does not add the UI control to the live site. Keep unrelated in-progress Retell files separate when committing or deploying.

Validation: 12 focused tests passed, including database RLS owner read access, denied status/deletion/comment/reassignment writes on another user's task, ordinary employee isolation, spoofed profile-email rejection, anonymous denial, participant regression and UI filters. ESLint passed for changed JS/JSX and tests; production build passed with the existing bundle-size warning. Production verification remains required after deployment.
