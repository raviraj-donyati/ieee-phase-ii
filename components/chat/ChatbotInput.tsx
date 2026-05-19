"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { Loader2, CornerDownLeft } from "lucide-react";
import {
  InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea,
} from "@/components/ui/input-group";
import { ChatMode } from "@/types";

interface ChatbotInputProps {
  onSend: (content: string, endpoint: string, mode: ChatMode) => void;
  isStreaming: boolean;
  agentType: ChatMode;
  agentId: string;
  prefillInput?: string;
  autoSubmit?: boolean;
  onPrefillConsumed?: () => void;
}

export function ChatbotInput({
  onSend, isStreaming, agentType, agentId, prefillInput, autoSubmit, onPrefillConsumed,
}: ChatbotInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasSubmittedRef = useRef(false);

  useEffect(() => {
    if (!prefillInput) return;
    hasSubmittedRef.current = false;
    startTransition(() => setInput(prefillInput));
    if (!autoSubmit) {
      onPrefillConsumed?.();
      textareaRef.current?.focus();
      return;
    }
    if (isStreaming || hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;
    onSend(prefillInput, agentId, agentType);
    startTransition(() => setInput(""));
    onPrefillConsumed?.();
  }, [prefillInput, autoSubmit, isStreaming, onSend, agentType, agentId, onPrefillConsumed]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed, agentId, agentType);
    setInput("");
  }, [input, isStreaming, onSend, agentId, agentType]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = !!input.trim() && !isStreaming;

  return (
    <div className="shrink-0 bg-background py-3 sm:py-4 overflow-hidden px-3 sm:px-4">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
        <InputGroup className="bg-background shadow-sm border border-border rounded-md overflow-hidden focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
          <InputGroupTextarea
            ref={textareaRef}
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything…"
            className="field-sizing-content min-h-13 max-h-40 bg-transparent p-3 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/50"
          />
          <InputGroupAddon align="block-end" className="justify-end bg-transparent px-2.5 py-2">
            <InputGroupButton
              size="icon-sm"
              variant="ghost"
              onClick={handleSend}
              disabled={!canSend}
              type="button"
              className={canSend
                ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm rounded-md"
                : "text-muted-foreground/30 rounded-md"
              }
            >
              {isStreaming
                ? <Loader2 className="size-4 animate-spin" />
                : <CornerDownLeft className="size-4" />
              }
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <p className="text-center text-xs text-muted-foreground/70">
          Responses are AI-generated and may not always be accurate.
        </p>
      </div>
    </div>
  );
}
