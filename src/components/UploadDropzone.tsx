"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface UploadDropzoneProps {
  file: File | null;
  onFile: (file: File) => void;
  /** Allow selecting many files at once (batch mode). */
  multiple?: boolean;
  onFiles?: (files: File[]) => void;
  /** Lock the dropzone (e.g. while a batch run is in flight). */
  disabled?: boolean;
}

const ACCEPT = "image/png,image/jpeg,image/webp";

/**
 * Large, obvious image drop target with a preview. One big click/drop
 * area — no hunting for buttons.
 */
export default function UploadDropzone({
  file,
  onFile,
  multiple = false,
  onFiles,
  disabled = false,
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const previewUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file],
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFiles = useCallback(
    (list: FileList | null) => {
      if (!list?.length) return;
      const images = Array.from(list).filter((f) => f.type.startsWith("image/"));
      if (!images.length) return;
      if (multiple && onFiles) {
        onFiles(images);
      } else {
        onFile(images[0]);
      }
    },
    [multiple, onFile, onFiles],
  );

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) handleFiles(e.dataTransfer.files);
      }}
      className={`w-full rounded-lg border-2 border-dashed p-6 text-center transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/30 ${
        disabled
          ? "border-rule bg-paper opacity-60 cursor-not-allowed"
          : dragging
            ? "border-accent bg-accent/5 cursor-pointer"
            : "border-rule bg-paper hover:border-accent/60 cursor-pointer"
      }`}
      aria-label={multiple ? "Add label images" : "Add a label image"}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple={multiple}
        hidden
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {previewUrl ? (
        <span className="flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
          <img
            src={previewUrl}
            alt="Selected label"
            className="max-h-72 rounded border border-rule shadow-sm"
          />
          <span className="text-sm text-ink-soft">
            {file?.name} — click to choose a different image
          </span>
        </span>
      ) : (
        <span className="flex flex-col items-center gap-2 py-8">
          <span aria-hidden className="text-4xl">
            🏷️
          </span>
          <span className="font-semibold text-lg">
            {multiple ? "Click to add label images" : "Click to add the label image"}
          </span>
          <span className="text-sm text-ink-soft">
            or drag and drop — PNG, JPEG, or WebP — large photos are resized automatically
          </span>
        </span>
      )}
    </button>
  );
}
