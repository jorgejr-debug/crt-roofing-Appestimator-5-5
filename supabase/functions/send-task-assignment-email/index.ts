import { createClient } from "npm:@supabase/supabase-js@2";

type TaskNotification = {
  id: string;
  task_id: string;
  user_id: string;
  assigned_by: string;
  notification_type: "assignment" | "comment";
  source_comment_id: string | null;
  email_status: "pending" | "sent" | "failed" | "skipped";
};

type WebhookPayload = {
  type?: string;
  table?: string;
  record?: TaskNotification;
};

const jsonHeaders = { "Content-Type": "application/json" };

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDueDate(value: string | null) {
  if (!value) return "No due date";
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(parsed);
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: jsonHeaders });
  }

  const expectedSecret = Deno.env.get("TASK_NOTIFICATION_WEBHOOK_SECRET");
  const suppliedSecret = request.headers.get("x-task-webhook-secret");
  if (!expectedSecret || suppliedSecret !== expectedSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("TASK_NOTIFICATION_FROM_EMAIL");
  const appUrl = Deno.env.get("TASK_NOTIFICATION_APP_URL") || "https://crt-roofing-estimator.vercel.app/";

  if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !fromEmail) {
    return new Response(JSON.stringify({ error: "Required email secrets are not configured" }), { status: 500, headers: jsonHeaders });
  }

  const payload = await request.json() as WebhookPayload;
  const notificationId = payload.record?.id;
  if (payload.type !== "INSERT" || payload.table !== "company_task_notifications" || !notificationId) {
    return new Response(JSON.stringify({ ok: true, skipped: "Not a task-notification insert" }), { headers: jsonHeaders });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: notification, error: notificationError } = await admin
    .from("company_task_notifications")
    .select("id, task_id, user_id, assigned_by, notification_type, source_comment_id, email_status")
    .eq("id", notificationId)
    .single<TaskNotification>();

  if (notificationError || !notification) {
    return new Response(JSON.stringify({ error: notificationError?.message || "Notification not found" }), { status: 404, headers: jsonHeaders });
  }
  if (notification.email_status === "sent" || notification.email_status === "skipped") {
    return new Response(JSON.stringify({ ok: true, skipped: notification.email_status }), { headers: jsonHeaders });
  }

  const [taskResult, recipientResult, actorResult, commentResult] = await Promise.all([
    admin.from("company_tasks").select("title, description, priority, due_date").eq("id", notification.task_id).single(),
    admin.from("user_profiles").select("full_name, email").eq("id", notification.user_id).single(),
    admin.from("user_profiles").select("full_name, email").eq("id", notification.assigned_by).single(),
    notification.notification_type === "comment" && notification.source_comment_id
      ? admin.from("company_task_comments").select("body").eq("id", notification.source_comment_id).single()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const lookupError = taskResult.error || recipientResult.error || actorResult.error || commentResult.error;
  const recipientEmail = String(recipientResult.data?.email || "").trim();
  if (lookupError || !taskResult.data || !recipientEmail) {
    const message = lookupError?.message || "Task recipient does not have an email address";
    await admin.from("company_task_notifications").update({ email_status: "failed", email_error: message }).eq("id", notification.id);
    return new Response(JSON.stringify({ error: message }), { status: 422, headers: jsonHeaders });
  }

  const task = taskResult.data;
  const recipientName = recipientResult.data?.full_name || recipientEmail.split("@")[0] || "there";
  const actorName = actorResult.data?.full_name || actorResult.data?.email || "A CRT Roofing team member";
  const safeAppUrl = escapeHtml(appUrl);
  const isComment = notification.notification_type === "comment";
  const subject = isComment ? `New comment on task: ${task.title}` : `New task: ${task.title}`;
  const html = isComment ? `
    <div style="font-family:Arial,sans-serif;color:#102536;line-height:1.5;max-width:640px;margin:auto">
      <h1 style="font-size:24px">New task discussion comment</h1>
      <p>Hi ${escapeHtml(recipientName)},</p>
      <p><strong>${escapeHtml(actorName)}</strong> commented on <strong>${escapeHtml(task.title)}</strong>:</p>
      <div style="border:1px solid #b9dcf5;border-radius:12px;padding:18px;background:#f6fbff">
        <p style="margin:0;white-space:pre-wrap">${escapeHtml(commentResult.data?.body || "A new comment was added.")}</p>
      </div>
      <p style="margin-top:22px"><a href="${safeAppUrl}" style="display:inline-block;background:#087ec4;color:white;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:bold">Open Task Discussion</a></p>
    </div>` : `
    <div style="font-family:Arial,sans-serif;color:#102536;line-height:1.5;max-width:640px;margin:auto">
      <h1 style="font-size:24px">You have a new CRT Roofing task</h1>
      <p>Hi ${escapeHtml(recipientName)},</p>
      <p><strong>${escapeHtml(actorName)}</strong> assigned you a task:</p>
      <div style="border:1px solid #b9dcf5;border-radius:12px;padding:18px;background:#f6fbff">
        <h2 style="font-size:20px;margin:0 0 8px">${escapeHtml(task.title)}</h2>
        <p style="margin:0 0 12px">${escapeHtml(task.description || "No additional instructions were provided.")}</p>
        <p style="margin:0"><strong>Priority:</strong> ${escapeHtml(task.priority || "normal")}<br><strong>Due:</strong> ${escapeHtml(formatDueDate(task.due_date))}</p>
      </div>
      <p style="margin-top:22px"><a href="${safeAppUrl}" style="display:inline-block;background:#087ec4;color:white;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:bold">Open Tasks &amp; Messages</a></p>
    </div>`;

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: fromEmail,
      to: [recipientEmail],
      subject,
      html,
    }),
  });

  if (!resendResponse.ok) {
    const responseText = (await resendResponse.text()).slice(0, 1000);
    await admin.from("company_task_notifications").update({ email_status: "failed", email_error: responseText }).eq("id", notification.id);
    return new Response(JSON.stringify({ error: "Email provider rejected the message" }), { status: 502, headers: jsonHeaders });
  }

  await admin.from("company_task_notifications").update({
    email_status: "sent",
    email_sent_at: new Date().toISOString(),
    email_error: "",
  }).eq("id", notification.id);

  return new Response(JSON.stringify({ ok: true }), { headers: jsonHeaders });
});
