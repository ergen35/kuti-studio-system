import type {
  HTMLAttributes,
  ReactNode,
} from "react";
import { forwardRef } from "react";
import {
  Button as SpectrumButton,
  Divider,
  Heading,
  StatusLight,
  Text,
  TextArea as SpectrumTextArea,
  TextField as SpectrumTextField,
  SearchField as SpectrumSearchField,
  type SpectrumButtonProps,
  type SpectrumTextAreaProps,
  type SpectrumTextFieldProps,
  type SpectrumSearchFieldProps,
  type TextFieldRef,
  View,
  Well,
} from "@adobe/react-spectrum";
import { cn } from "../lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "bare";

interface ButtonProps extends Omit<SpectrumButtonProps<"button">, "variant" | "style" | "isQuiet" | "onPress" | "children"> {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
  children: ReactNode;
}

export function Button({ UNSAFE_className, variant = "primary", size = "md", type = "button", isDisabled, onClick, children, ...props }: ButtonProps) {
  const variantProps: Record<ButtonVariant, { variant: "accent" | "primary" | "secondary" | "negative"; spectrumStyle?: "fill" | "outline"; isQuiet?: boolean }> = {
    primary: { variant: "accent", spectrumStyle: "fill" },
    secondary: { variant: "secondary", spectrumStyle: "outline" },
    ghost: { variant: "secondary", spectrumStyle: "outline", isQuiet: true },
    danger: { variant: "negative", spectrumStyle: "fill" },
    bare: { variant: "secondary", spectrumStyle: "outline", isQuiet: true },
  };

  const sizeClasses = {
    sm: "h-9 rounded-lg px-3 text-xs",
    md: "h-10 rounded-xl px-4 text-sm",
    lg: "h-11 rounded-xl px-5 text-sm",
  };

  return (
    <SpectrumButton
      type={type}
      variant={variantProps[variant].variant}
      style={variantProps[variant].spectrumStyle}
      isQuiet={variantProps[variant].isQuiet}
      isDisabled={isDisabled}
      onPress={onClick}
      UNSAFE_className={cn("inline-flex items-center justify-center gap-2 font-medium", sizeClasses[size], UNSAFE_className)}
      {...props}
    >
      {children}
    </SpectrumButton>
  );
}

interface InputProps extends Omit<SpectrumTextFieldProps, "label" | "onChange"> {
  className?: string;
  label?: ReactNode;
  onChange?: (value: string) => void;
}

export const Input = forwardRef<TextFieldRef<HTMLInputElement>, InputProps>(function Input({ className, label, onChange, ...props }, ref) {
  return (
    <SpectrumTextField
      ref={ref}
      label={label}
      onChange={onChange}
      UNSAFE_className={cn("w-full", className)}
      {...props}
    />
  );
});

interface TextareaProps extends Omit<SpectrumTextAreaProps, "label" | "onChange"> {
  className?: string;
  label?: ReactNode;
  onChange?: (value: string) => void;
}

export const Textarea = forwardRef<TextFieldRef<HTMLTextAreaElement>, TextareaProps>(function Textarea({ className, label, onChange, ...props }, ref) {
  return (
    <SpectrumTextArea
      ref={ref}
      label={label}
      onChange={onChange}
      UNSAFE_className={cn("min-h-32 w-full", className)}
      {...props}
    />
  );
});

interface SearchFieldProps extends Omit<SpectrumSearchFieldProps, "label" | "onChange"> {
  className?: string;
  label?: ReactNode;
  onChange?: (value: string) => void;
}

export const SearchField = forwardRef<TextFieldRef<HTMLInputElement>, SearchFieldProps>(function SearchField({ className, label, onChange, ...props }, ref) {
  return <SpectrumSearchField ref={ref} label={label} onChange={onChange} UNSAFE_className={cn("w-full", className)} {...props} />;
});

interface BadgeProps {
  tone?: "default" | "muted" | "primary" | "success" | "warning" | "danger" | "draft" | "active" | "archived" | "open" | "resolved" | "running" | "done" | "failed";
  children: ReactNode;
  className?: string;
}

export function Badge({ className, tone = "default", children }: BadgeProps) {
  const toneVariants: Record<NonNullable<BadgeProps["tone"]>, "positive" | "negative" | "notice" | "info" | "neutral" | "indigo" | "seafoam" | "yellow"> = {
    default: "neutral",
    muted: "neutral",
    primary: "info",
    success: "positive",
    warning: "notice",
    danger: "negative",
    draft: "indigo",
    active: "seafoam",
    archived: "neutral",
    open: "notice",
    resolved: "positive",
    running: "indigo",
    done: "positive",
    failed: "negative",
  };

  return (
    <StatusLight
      variant={toneVariants[tone]}
      UNSAFE_className={cn("inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.18em]", className)}
    >
      {children}
    </StatusLight>
  );
}

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "none" | "sm" | "md" | "lg";
}

export function Card({ className, padding = "md", ...props }: CardProps) {
  const paddingClasses = {
    none: "p-0",
    sm: "p-3",
    md: "p-4",
    lg: "p-6",
  };

  return <View UNSAFE_className={cn("kuti-panel rounded-2xl", paddingClasses[padding], className)} {...props} />;
}

interface SeparatorProps extends HTMLAttributes<HTMLDivElement> {}

export function Separator({ className, ...props }: SeparatorProps) {
  return <Divider UNSAFE_className={cn("kuti-divider", className)} {...props} />;
}

export function StatTile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <View UNSAFE_className="kuti-panel rounded-2xl p-4">
      <Text UNSAFE_className="text-[11px] uppercase tracking-[0.22em] text-[rgb(var(--muted-foreground))]">{label}</Text>
      <Heading level={3} UNSAFE_className="mt-2 text-2xl font-semibold tracking-tight text-[rgb(var(--foreground))]">
        {value}
      </Heading>
      {hint ? <Text UNSAFE_className="mt-1 text-sm text-[rgb(var(--muted-foreground))]">{hint}</Text> : null}
    </View>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Well UNSAFE_className="flex min-h-44 flex-col items-start justify-center gap-3 text-left">
      <div>
        <Heading level={3} UNSAFE_className="text-lg font-semibold text-[rgb(var(--foreground))]">
          {title}
        </Heading>
        <Text UNSAFE_className="mt-1 max-w-xl text-sm leading-6 text-[rgb(var(--muted-foreground))]">{description}</Text>
      </div>
      {action}
    </Well>
  );
}

export function LoadingBlock({ label = "Loading" }: { label?: string }) {
  return (
    <Card className="animate-pulse space-y-3">
      <div className="h-4 w-24 rounded bg-[rgb(var(--muted))]" />
      <div className="h-8 w-2/3 rounded bg-[rgb(var(--muted))]" />
      <div className="h-20 rounded-2xl bg-[rgb(var(--muted))]" />
      <div className="text-sm text-[rgb(var(--muted-foreground))]">{label}…</div>
    </Card>
  );
}
