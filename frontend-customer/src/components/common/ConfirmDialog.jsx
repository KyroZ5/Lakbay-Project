import React from 'react';
import { Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

/**
 * Controlled confirmation prompt for destructive or irreversible actions.
 * The dialog stays open while `loading` is true and is only closed by the caller
 * once the action succeeds, so failures keep the context visible.
 */
export const ConfirmDialog = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  loadingLabel,
  cancelLabel = 'Cancel',
  variant = 'destructive',
  loading = false,
  onConfirm,
  children,
}) => (
  <AlertDialog open={open} onOpenChange={(next) => !loading && onOpenChange(next)}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
      </AlertDialogHeader>
      {children}
      <AlertDialogFooter>
        <AlertDialogCancel disabled={loading}>{cancelLabel}</AlertDialogCancel>
        {/* A plain Button (not AlertDialogAction) so the dialog doesn't auto-close before the request resolves */}
        <Button variant={variant} onClick={onConfirm} disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {loading ? loadingLabel || `${confirmLabel}...` : confirmLabel}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
