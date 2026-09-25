import "./ActionFeedback.css";

export default function ActionFeedback({ message, tone = "success", title, onDismiss }) {
  if (!message) return null;

  const isError = tone === "error";
  const isWarning = tone === "warning";
  const isInfo = tone === "info";
  const normalizedTone = isError ? "error" : isWarning ? "warning" : isInfo ? "info" : "success";
  const defaultTitle = isError
    ? "Action not completed"
    : isWarning
      ? "Attention needed"
      : isInfo
        ? "Working on it"
        : "Submitted successfully";
  return (
    <div
      className={`actionFeedbackToast ${normalizedTone}`}
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      aria-atomic="true"
    >
      <span className="actionFeedbackIcon" aria-hidden="true">{isError || isWarning ? "!" : isInfo ? "…" : "✓"}</span>
      <div className="actionFeedbackCopy">
        <strong>{title || defaultTitle}</strong>
        <p>{message}</p>
      </div>
      {onDismiss ? <button type="button" className="actionFeedbackClose" onClick={onDismiss} aria-label="Dismiss notification">×</button> : null}
    </div>
  );
}
