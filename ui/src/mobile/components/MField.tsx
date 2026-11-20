import React from 'react';

interface MFieldProps {
  label?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}

/** Label + control + error/hint wrapper shared by all form controls. */
export const MField: React.FC<MFieldProps> = ({ label, required, error, hint, htmlFor, children }) => (
  <div className="m-field">
    {label && (
      <label className="m-field__label" htmlFor={htmlFor}>
        {label}
        {required && <span className="m-field__required"> *</span>}
      </label>
    )}
    {children}
    {error ? (
      <span className="m-field__error" role="alert">{error}</span>
    ) : hint ? (
      <span className="m-field__hint">{hint}</span>
    ) : null}
  </div>
);

interface MInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const MInput: React.FC<MInputProps> = ({ label, error, hint, required, id, className = '', ...rest }) => {
  const autoId = React.useId();
  const inputId = id || autoId;
  return (
    <MField label={label} required={required} error={error} hint={hint} htmlFor={inputId}>
      <input
        id={inputId}
        className={['m-input', className].filter(Boolean).join(' ')}
        aria-invalid={error ? 'true' : undefined}
        required={required}
        {...rest}
      />
    </MField>
  );
};

interface MSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options?: Array<{ value: string; label: string }>;
}

export const MSelect: React.FC<MSelectProps> = ({ label, error, hint, required, id, className = '', options, children, ...rest }) => {
  const autoId = React.useId();
  const selectId = id || autoId;
  return (
    <MField label={label} required={required} error={error} hint={hint} htmlFor={selectId}>
      <select
        id={selectId}
        className={['m-select', className].filter(Boolean).join(' ')}
        aria-invalid={error ? 'true' : undefined}
        required={required}
        {...rest}
      >
        {options ? options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>) : children}
      </select>
    </MField>
  );
};

interface MTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const MTextarea: React.FC<MTextareaProps> = ({ label, error, hint, required, id, className = '', ...rest }) => {
  const autoId = React.useId();
  const areaId = id || autoId;
  return (
    <MField label={label} required={required} error={error} hint={hint} htmlFor={areaId}>
      <textarea
        id={areaId}
        className={['m-textarea', className].filter(Boolean).join(' ')}
        aria-invalid={error ? 'true' : undefined}
        required={required}
        {...rest}
      />
    </MField>
  );
};