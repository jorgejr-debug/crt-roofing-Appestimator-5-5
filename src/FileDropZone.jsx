import { useRef, useState } from "react";
import "./FileDropZone.css";

export default function FileDropZone({ accept, disabled = false, label = "Choose files", help, multiple = true, onFiles }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const deliver = (items) => {
    const files = Array.from(items || []).filter((item) => item instanceof File);
    if (files.length) onFiles(multiple ? files : files.slice(0, 1));
  };

  return <div
    className={`fileDropZone${dragging ? " isDragging" : ""}${disabled ? " isDisabled" : ""}`}
    tabIndex={disabled ? -1 : 0}
    onDragEnter={(event) => { event.preventDefault(); if (!disabled) setDragging(true); }}
    onDragOver={(event) => event.preventDefault()}
    onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
    onDrop={(event) => { event.preventDefault(); setDragging(false); if (!disabled) deliver(event.dataTransfer.files); }}
    onPaste={(event) => { if (!disabled) deliver(event.clipboardData.files); }}
    aria-label={`${label}. Drag and drop files here, paste from the clipboard, or browse.`}
  >
    <strong>Drag &amp; drop or paste files here</strong>
    {help ? <span>{help}</span> : null}
    <button type="button" className="secondaryButton" disabled={disabled} onClick={() => inputRef.current?.click()}>{label}</button>
    <input ref={inputRef} className="visuallyHiddenFileInput" type="file" accept={accept} multiple={multiple} disabled={disabled} onChange={(event) => { deliver(event.target.files); event.target.value = ""; }} />
  </div>;
}
