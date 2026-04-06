"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, ButtonProps } from "@/components/ui/button";
import { toast } from "sonner";

interface CopyButtonProps extends ButtonProps {
  value: string;
}

export function CopyButton({ value, className, variant = "ghost", size = "icon", ...props }: CopyButtonProps) {
  const [hasCopied, setHasCopied] = React.useState(false);

  React.useEffect(() => {
    if (hasCopied) {
      const timeout = setTimeout(() => {
        setHasCopied(false);
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [hasCopied]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(value);
    setHasCopied(true);
    toast.success("Copiado para a área de transferência!");
  };

  return (
    <Button
      size={size}
      variant={variant}
      className={cn("h-6 w-6 relative", className)}
      onClick={copyToClipboard}
      title="Copiar"
      {...props}
    >
      <span className="sr-only">Copiar</span>
      {hasCopied ? (
        <Check className="h-3 w-3 text-emerald-500" />
      ) : (
        <Copy className="h-3 w-3 text-slate-400" />
      )}
    </Button>
  );
}