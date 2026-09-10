// 관리자 폼의 입력 요소 — 화면마다 같은 마크업을 반복하지 않기 위한 래퍼.
import type { ChangeEvent, ReactNode } from "react";

export const inputClass =
  "mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-ink";

export function Field({
  label,
  htmlFor,
  hint,
  required,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink" htmlFor={htmlFor}>
        {label}
        {required && <span className="ml-0.5 text-accent">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}

export function TextField(props: {
  name: string;
  label: string;
  defaultValue?: string | null;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  type?: "text" | "url" | "date" | "number";
}) {
  const { name, label, defaultValue, placeholder, hint, required, type = "text" } = props;
  return (
    <Field label={label} htmlFor={name} hint={hint} required={required}>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className={inputClass}
      />
    </Field>
  );
}

export function TextAreaField(props: {
  name: string;
  label: string;
  defaultValue?: string | null;
  rows?: number;
  hint?: string;
  mono?: boolean;
  placeholder?: string;
}) {
  const { name, label, defaultValue, rows = 8, hint, mono, placeholder } = props;
  return (
    <Field label={label} htmlFor={name} hint={hint}>
      <textarea
        id={name}
        name={name}
        rows={rows}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className={`${inputClass}${mono ? " font-mono text-xs leading-relaxed" : ""}`}
      />
    </Field>
  );
}

export function SelectField(props: {
  name: string;
  label: string;
  options: Array<{ value: string | number; label: string }>;
  defaultValue?: string | number;
  /** 제어 컴포넌트로 쓸 때 — value 와 onChange 를 함께 준다 */
  value?: string | number;
  onChange?: (value: string) => void;
  hint?: string;
  required?: boolean;
  placeholder?: string;
}) {
  const { name, label, options, defaultValue, value, onChange, hint, required, placeholder } = props;
  const controlled = value !== undefined ? { value, onChange: (e: ChangeEvent<HTMLSelectElement>) => onChange?.(e.target.value) } : { defaultValue: defaultValue ?? "" };
  return (
    <Field label={label} htmlFor={name} hint={hint} required={required}>
      <select id={name} name={name} required={required} {...controlled} className={inputClass}>
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function CheckboxField({
  name,
  label,
  defaultChecked,
  hint,
  value,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
  hint?: string;
  /** 같은 name 으로 여러 개를 둘 때의 값 (기본 "on") */
  value?: string;
}) {
  return (
    <div>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" name={name} defaultChecked={defaultChecked}  value={value ?? "on"} />
        {label}
      </label>
      {hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}

export function FormMessage({ error, saved }: { error?: string; saved?: boolean }) {
  if (error) {
    return (
      <p className="rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-sm text-accent-deep">{error}</p>
    );
  }
  if (saved) {
    return <p className="rounded-lg border border-sage/30 bg-sage-soft px-3 py-2 text-sm text-sage-deep">저장되었습니다.</p>;
  }
  return null;
}

export function SubmitButton({ pending, label = "저장", pendingLabel = "저장 중..." }: { pending: boolean; label?: string; pendingLabel?: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream hover:opacity-90 disabled:opacity-50"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

export function AdminPageHeader({ title, description, right }: { title: string; description?: string; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-extrabold text-ink">{title}</h1>
        {description && <p className="mt-1 text-xs text-ink-faint">{description}</p>}
      </div>
      {right}
    </div>
  );
}
