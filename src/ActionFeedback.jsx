import "./ActionFeedback.css";

export default function ActionFeedback({ message, tone = "success", title, onDismiss }) {
  if (!message) return null;

  const isError = tone === "error";
  return (
    <div
      className={`actionFeedbackToast ${isError ? "error" : "success"}`}
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      aria-atomic="true"
    >
      <span className="actionFeedbackIcon" aria-hidden="true">{isError ? "!" : "✓"}</span>
      <div className="actionFeedbackCopy">
        <strong>{title || (isError ? "Action not completed" : "Submitted successfully")}</strong>
        <p>{message}</p>
      </div>
      {onDismiss ? <button type="button" className="actionFeedbackClose" onClick={onDismiss} aria-label="Dismiss notification">×</button> : null}
    </div>
  );
}
