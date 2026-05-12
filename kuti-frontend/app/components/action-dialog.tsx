import type { ReactNode } from "react";
import { Content, Dialog, DialogContainer, Heading, Text, TextField } from "@adobe/react-spectrum";
import { Button } from "./ui";

interface ActionDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  isPending?: boolean;
  confirmDisabled?: boolean;
  onDismiss: () => void;
  onConfirm: () => void;
  children: ReactNode;
}

export function ActionDialog({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  isPending,
  confirmDisabled,
  onDismiss,
  onConfirm,
  children,
}: ActionDialogProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <DialogContainer type="modal" isDismissable onDismiss={onDismiss}>
      <Dialog size="S" onDismiss={onDismiss}>
        <Heading>{title}</Heading>
        <Content>
          <Text UNSAFE_className="text-sm leading-6 text-[rgb(var(--muted-foreground))]">{description}</Text>
          <div className="mt-4 space-y-3">{children}</div>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={onDismiss}>
              {cancelLabel}
            </Button>
            <Button onClick={onConfirm} isDisabled={isPending || confirmDisabled}>
              {isPending ? `${confirmLabel}...` : confirmLabel}
            </Button>
          </div>
        </Content>
      </Dialog>
    </DialogContainer>
  );
}

interface LabeledFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function LabeledField({ label, value, onChange, placeholder, autoFocus }: LabeledFieldProps) {
  return <TextField autoFocus={autoFocus} label={label} value={value} placeholder={placeholder} onChange={onChange} />;
}
