import React from 'react';

/**
 * Field-level validation message. Give it an `id` and reference it from the input via
 * `aria-describedby` (and set `aria-invalid`) so screen readers announce the error.
 */
export const FieldError = ({ id, children }) => {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="text-xs font-medium text-red-600">
      {children}
    </p>
  );
};
