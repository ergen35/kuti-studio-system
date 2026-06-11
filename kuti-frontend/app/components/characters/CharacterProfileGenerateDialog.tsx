import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Wand2 } from "lucide-react";
import { z } from "zod";
import { FormField } from "~/components/FormField";
import {
  Button,
} from "~/components/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Textarea } from "~/components/ui/textarea";
import { useTranslation } from "~/hooks/useTranslation";

const profileDraftSchema = z.object({
  descriptionMinimal: z.string().min(1).max(2000),
});

export type ProfileDraftFormInput = z.infer<typeof profileDraftSchema>;

interface CharacterProfileGenerateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (descriptionMinimal: string) => void;
  isGenerating: boolean;
  error?: string | null;
}

export function CharacterProfileGenerateDialog({
  open,
  onOpenChange,
  onGenerate,
  isGenerating,
  error,
}: CharacterProfileGenerateDialogProps) {
  const { t } = useTranslation("characters");
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ProfileDraftFormInput>({
    resolver: zodResolver(profileDraftSchema),
    defaultValues: { descriptionMinimal: "" },
  });

  useEffect(() => {
    if (open) {
      reset({ descriptionMinimal: "" });
    }
  }, [open, reset]);

  const handleFormSubmit = ({ descriptionMinimal }: ProfileDraftFormInput) => {
    onGenerate(descriptionMinimal.trim());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 size={16} className="text-primary" />
            {t("profileDraft.title")}
          </DialogTitle>
          <DialogDescription>{t("profileDraft.description")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="grid gap-4">
          <FormField label={t("profileDraft.fieldLabel")} error={errors.descriptionMinimal}>
            <Textarea
              {...register("descriptionMinimal")}
              rows={5}
              placeholder={t("profileDraft.placeholder")}
            />
          </FormField>

          {error && <p className="text-sm text-danger">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t("actions.cancel")}
            </Button>
            <Button variant="primary" disabled={isGenerating}>
              {isGenerating ? t("actions.creating") : t("profileDraft.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
