import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, className = "", id, ...props }: InputProps) {
  return (
    <label className="block">
      {label && (
        <span
          className="mb-1 block text-xs font-medium text-text-secondary"
          id={`${id ?? "input"}-label`}
        >
          {label}
        </span>
      )}
      <input
        id={id}
        {...props}
        className={`w-full rounded-lg border border-border-base bg-bg-card2 px-3 py-2 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent-blue ${className}`}
      />
    </label>
  );
}
