import { useRef, useState } from "react";

interface BillUploadProps {
  loading: boolean;
  onAnalyze: (file: File) => void;
}

/**
 * Lets the user choose a bill photo from their files or take one with the
 * device camera (on mobile), shows a preview, and triggers analysis.
 */
export function BillUpload({ loading, onAnalyze }: BillUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  function handleSelect(selected: File | null) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(selected);
    setPreviewUrl(selected ? URL.createObjectURL(selected) : null);
  }

  return (
    <div className="upload card">
      <h2>1. Capture the bill</h2>

      <div className="upload-actions">
        <button
          type="button"
          disabled={loading}
          onClick={() => fileInputRef.current?.click()}
        >
          Choose photo
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => cameraInputRef.current?.click()}
        >
          Take photo
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => handleSelect(e.target.files?.[0] ?? null)}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => handleSelect(e.target.files?.[0] ?? null)}
        />
      </div>

      {previewUrl && (
        <div className="preview">
          <img src={previewUrl} alt="Selected bill preview" />
        </div>
      )}

      <button
        type="button"
        className="primary"
        disabled={!file || loading}
        onClick={() => file && onAnalyze(file)}
      >
        {loading ? "Analyzing…" : "Analyze bill"}
      </button>
    </div>
  );
}
