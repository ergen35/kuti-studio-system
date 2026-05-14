import type { ReactNode } from 'react';
import { Field } from '~/components/ui';
import type { FieldError, Merge } from 'react-hook-form';

interface FormFieldProps {
  label: string;
  error?: FieldError | Merge<FieldError, (FieldError | undefined)[]>;
  children: ReactNode;
}

export function FormField({ label, error, children }: FormFieldProps) {
  return (
    <div>
      <Field label={label}>{children}</Field>
      {error && 'message' in error && (
        <span className="text-danger mt-1 block text-xs">{String(error.message)}</span>
      )}
    </div>
  );
}
