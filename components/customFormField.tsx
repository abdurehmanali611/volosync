"use client";

import * as React from "react";
import { ImageIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Image from "next/image";
import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { Controller } from "react-hook-form";
import { toast } from "sonner";

import { PhoneInput } from "@/components/phone-input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { DatePicker, DateTimePicker, parsePickerDate } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { uploadImageToCloudinary } from "@/lib/cloudinary";
import { cn } from "@/lib/utils";

export enum formFieldTypes {
  INPUT = "input",
  CALENDAR = "calendar",
  DATETIME = "datetime",
  RADIO_BUTTON = "radioButton",
  SELECT = "select",
  TAG_INPUT = "tagInput",
  TEXTAREA = "textarea",
  IMAGE_UPLOADER = "imageUploader",
  SKELETON = "skeleton",
  ALERTDIALOG = "alertDialog",
  SWITCH = "switch",
  PHONE_INPUT = "phoneInput",
}

type SelectOption = {
  label: string;
  value: string;
  description?: string;
};

type BaseProps<T extends FieldValues> = {
  control?: Control<T>;
  name?: FieldPath<T>;
  fieldType: formFieldTypes;
  label?: string;
  placeholder?: string;
  description?: string;
  type?: string;
  disabled?: boolean;
  options?: SelectOption[];
  className?: string; // Prop enabled for custom styling
  accept?: string;
  addPlaceholder?: string;
  renderSkeleton?: (field: {
    value: unknown;
    onChange: (value: unknown) => void;
  }) => React.ReactNode;
  dialogTitle?: string;
  dialogDescription?: string;
  dialogTriggerLabel?: string;
  dialogActionLabel?: string;
  dialogCancelLabel?: string;
  onAlertAction?: () => void;
};

type ControlledProps<T extends FieldValues> = BaseProps<T> & {
  control: Control<T>;
  name: FieldPath<T>;
};

type AlertDialogProps<T extends FieldValues> = BaseProps<T> & {
  fieldType: formFieldTypes.ALERTDIALOG;
  dialogTitle: string;
  dialogDescription: string;
};

type CustomFormFieldProps<T extends FieldValues> =
  | ControlledProps<T>
  | AlertDialogProps<T>;

const CloudinaryImageUploader = ({
  id,
  value,
  placeholder,
  accept,
  disabled,
  onChange,
}: {
  id: string;
  value: unknown;
  placeholder?: string;
  accept?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) => {
  const [previewUrl, setPreviewUrl] = React.useState<string>(
    typeof value === "string" ? value : "",
  );
  const [uploading, setUploading] = React.useState(false);

  React.useEffect(() => {
    (() => {
      setPreviewUrl(typeof value === "string" ? value : "");
    })();
  }, [value]);

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    setUploading(true);

    try {
      const uploadedUrl = await uploadImageToCloudinary(file);
      onChange(uploadedUrl);
      setPreviewUrl(uploadedUrl);
      toast.success("Image uploaded successfully");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Image upload failed";
      toast.error(message);
      setPreviewUrl(typeof value === "string" ? value : "");
    } finally {
      URL.revokeObjectURL(localPreview);
      setUploading(false);
      event.target.value = "";
    }
  };

  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-4">
      <label
        htmlFor={id}
        className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-border/80 bg-background px-4 py-8 text-center transition-colors hover:bg-muted/50"
      >
        {previewUrl ? (
          <div className="relative h-40 w-full overflow-hidden rounded-2xl border border-border">
            <Image
              src={previewUrl}
              alt="Uploaded preview"
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-foreground/50 text-background opacity-0 transition-opacity hover:opacity-100">
              {uploading ? "Uploading..." : "Change image"}
            </div>
          </div>
        ) : (
          <>
            <HugeiconsIcon
              icon={ImageIcon}
              strokeWidth={2}
              className="size-8 text-muted-foreground"
            />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                {uploading
                  ? "Uploading image..."
                  : (placeholder ?? "Upload an image")}
              </p>
              <p className="text-xs text-muted-foreground">
                PNG, JPG, or WebP supported
              </p>
            </div>
          </>
        )}
      </label>
      <Input
        id={id}
        type="file"
        accept={accept ?? "image/*"}
        className="hidden"
        disabled={disabled || uploading}
        onChange={handleImageUpload}
      />
    </div>
  );
};

const CustomFormField = <T extends FieldValues>(
  props: CustomFormFieldProps<T>,
) => {
  if (props.fieldType === formFieldTypes.ALERTDIALOG) {
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="outline">
            {props.dialogTriggerLabel ?? "Open Dialog"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{props.dialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {props.dialogDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {props.dialogCancelLabel ?? "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction onClick={props.onAlertAction}>
              {props.dialogActionLabel ?? "Continue"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  const {
    control,
    name,
    fieldType,
    label,
    placeholder,
    description,
    type = "text",
    disabled,
    options = [],
    className,
    accept,
    addPlaceholder,
    renderSkeleton,
  } = props as ControlledProps<T>;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const hasError = Boolean(fieldState.error);
        const dateValue = parsePickerDate(field.value);

        return (
          <Field className="min-w-0 flex-col gap-1.5" data-invalid={hasError || undefined}>
            {label ? (
              <FieldLabel className="text-sm font-medium text-foreground" htmlFor={String(name)}>
                {label}
              </FieldLabel>
            ) : null}
            <FieldContent className="w-full">
              {fieldType === formFieldTypes.INPUT ? (
                <Input
                  id={String(name)}
                  type={type}
                  placeholder={placeholder}
                  disabled={disabled}
                  aria-invalid={hasError}
                  value={(field.value as string | number | undefined | null) ?? ""}
                  onBlur={field.onBlur}
                  onChange={(event) => {
                    if (type === "number") {
                      const raw = event.target.value;
                      field.onChange(raw === "" ? undefined : Number(raw));
                      return;
                    }
                    field.onChange(event);
                  }}
                  name={field.name}
                  className={className}
                />
              ) : null}

              {fieldType === formFieldTypes.TAG_INPUT ? (
                <TagInput
                  id={String(name)}
                  disabled={disabled}
                  placeholder={placeholder}
                  addPlaceholder={addPlaceholder}
                  value={Array.isArray(field.value) ? field.value : []}
                  onBlur={field.onBlur}
                  onChange={field.onChange}
                  className={className}
                />
              ) : null}

              {fieldType === formFieldTypes.TEXTAREA ? (
                <Textarea
                  id={String(name)}
                  placeholder={placeholder}
                  disabled={disabled}
                  aria-invalid={hasError}
                  value={(field.value as string) ?? ""}
                  onBlur={field.onBlur}
                  onChange={field.onChange}
                  name={field.name}
                  className={className}
                />
              ) : null}

              {fieldType === formFieldTypes.SELECT ? (
                <Select
                  value={(field.value as string) ?? ""}
                  onValueChange={field.onChange}
                  disabled={disabled}
                >
                  <SelectTrigger
                    id={String(name)}
                    className={cn("w-full", className)}
                    aria-invalid={hasError}
                  >
                    <SelectValue placeholder={placeholder} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <span className="flex flex-col items-start gap-0.5">
                            <span>{option.label}</span>
                            {option.description ? (
                              <span className="text-xs font-normal text-muted-foreground">
                                {option.description}
                              </span>
                            ) : null}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              ) : null}

              {fieldType === formFieldTypes.PHONE_INPUT ? (
                <PhoneInput
                  id={String(name)}
                  placeholder={placeholder}
                  disabled={disabled}
                  aria-invalid={hasError}
                  defaultCountry="ET"
                  international
                  value={(field.value as string) ?? ""}
                  onBlur={field.onBlur}
                  onChange={field.onChange}
                  name={field.name}
                  className={className}
                />
              ) : null}

              {fieldType === formFieldTypes.CALENDAR ? (
                <DatePicker
                  value={dateValue}
                  onChange={(date) => field.onChange(date ?? null)}
                  placeholder={placeholder ?? "Pick a date"}
                  disabled={disabled}
                  className={className}
                />
              ) : null}

              {fieldType === formFieldTypes.DATETIME ? (
                <DateTimePicker
                  value={dateValue}
                  onChange={(date) => field.onChange(date ?? null)}
                  placeholder={placeholder ?? "Pick date and time"}
                  disabled={disabled}
                  className={className}
                  fromDate={new Date()}
                />
              ) : null}

              {fieldType === formFieldTypes.RADIO_BUTTON ? (
                <RadioGroup
                  value={(field.value as string) ?? ""}
                  onValueChange={field.onChange}
                  className={cn(
                    "grid w-full gap-2",
                    className || "grid-cols-1",
                  )}
                >
                  {options.map((option) => (
                    <Field
                      key={option.value}
                      orientation="horizontal"
                      className="min-w-0 rounded-xl border border-border bg-muted/30 px-3 py-2"
                    >
                      <RadioGroupItem
                        id={`${String(name)}-${option.value}`}
                        value={option.value}
                      />
                      <FieldContent className="gap-0.5">
                        <FieldLabel
                          htmlFor={`${String(name)}-${option.value}`}
                          className="cursor-pointer font-normal text-foreground"
                        >
                          {option.label}
                        </FieldLabel>
                        {option.description ? (
                          <FieldDescription>
                            {option.description}
                          </FieldDescription>
                        ) : null}
                      </FieldContent>
                    </Field>
                  ))}
                </RadioGroup>
              ) : null}

              {fieldType === formFieldTypes.SWITCH ? (
                <Field
                  orientation="horizontal"
                  className="justify-between rounded-2xl border border-border bg-muted/30 p-4"
                >
                  <FieldContent className="gap-1">
                    <FieldLabel
                      htmlFor={String(name)}
                      className="font-normal text-foreground"
                    >
                      {label}
                    </FieldLabel>
                    {description ? (
                      <FieldDescription>{description}</FieldDescription>
                    ) : null}
                  </FieldContent>
                  <Switch
                    id={String(name)}
                    checked={Boolean(field.value)}
                    onCheckedChange={field.onChange}
                    disabled={disabled}
                  />
                </Field>
              ) : null}

              {fieldType === formFieldTypes.IMAGE_UPLOADER ? (
                <CloudinaryImageUploader
                  id={String(name)}
                  value={field.value}
                  placeholder={placeholder}
                  accept={accept}
                  disabled={disabled}
                  onChange={(uploadedUrl) => field.onChange(uploadedUrl)}
                />
              ) : null}

              {fieldType === formFieldTypes.SKELETON && renderSkeleton ? (
                <div>
                  {renderSkeleton({
                    value: field.value,
                    onChange: field.onChange,
                  })}
                </div>
              ) : null}

              {description && fieldType !== formFieldTypes.SWITCH ? (
                <FieldDescription>{description}</FieldDescription>
              ) : null}
              <FieldError
                errors={fieldState.error ? [fieldState.error] : undefined}
              />
            </FieldContent>
          </Field>
        );
      }}
    />
  );
};

const TagInput = ({
  id,
  value,
  placeholder,
  addPlaceholder,
  disabled,
  onChange,
  onBlur,
  className,
}: {
  id: string;
  value: string[];
  placeholder?: string;
  addPlaceholder?: string;
  disabled?: boolean;
  onChange: (value: string[]) => void;
  onBlur: () => void;
  className?: string;
}) => {
  const [draft, setDraft] = React.useState("");

  const addTag = () => {
    const nextValue = draft.trim();

    if (!nextValue) {
      return;
    }

    if (value.includes(nextValue)) {
      setDraft("");
      return;
    }

    onChange([...value, nextValue]);
    setDraft("");
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((item) => item !== tag));
  };

  return (
    <div className={cn("w-full space-y-3", className)}>
      {value.length ? (
        <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-muted/40 p-3">
          {value.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => removeTag(tag)}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-sm text-foreground transition hover:bg-muted"
            >
              <span>{tag}</span>
              <span className="text-(--apex-orange)/80">x</span>
            </button>
          ))}
        </div>
      ) : null}
      <Input
        id={id}
        type="text"
        disabled={disabled}
        value={draft}
        placeholder={
          value.length
            ? (addPlaceholder ?? "Add another ingredient")
            : placeholder
        }
        onBlur={onBlur}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            addTag();
          }

          if (event.key === "Backspace" && !draft && value.length) {
            event.preventDefault();
            onChange(value.slice(0, -1));
          }
        }}
        className="w-full"
      />
    </div>
  );
};

export default CustomFormField;
