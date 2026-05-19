"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, CornerDownLeft, Send } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { ModeSelector } from "@/components/selectors/ModeSelector";
import { DropdownSelector } from "@/components/selectors/DropdownSelector";
import {
  fetchKAList,
  fetchGenieSpaces,
  fetchSupervisorEndpoints,
} from "@/lib/api";
import { ChatMode } from "@/types";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  modeAtom,
  selectedItemAtom,
  effectiveSelectedAtom,
  kaListAtom,
  genieListAtom,
  supervisorListAtom,
} from "@/lib/atoms";

interface ChatInputProps {
  onSend: (content: string, endpoint: string, mode: ChatMode) => void;
  isStreaming: boolean;
  prefillInput?: string;
  autoSubmit?: boolean;
  onPrefillConsumed?: () => void;
  fullWidth?: boolean;
}

export function ChatInput({
  onSend,
  isStreaming,
  prefillInput,
  autoSubmit,
  onPrefillConsumed,
  fullWidth = false,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [mode, setMode] = useAtom(modeAtom);
  const [selectedItem, setSelectedItem] = useAtom(selectedItemAtom);
  const effectiveSelectedItem = useAtomValue(effectiveSelectedAtom);

  const setKAList = useSetAtom(kaListAtom);
  const setGenieList = useSetAtom(genieListAtom);
  const setSupervisorList = useSetAtom(supervisorListAtom);

  const kaQuery = useQuery({ queryKey: ["ka-list"], queryFn: fetchKAList });
  const genieQuery = useQuery({ queryKey: ["genie-spaces"], queryFn: fetchGenieSpaces });
  const endpointsQuery = useQuery({ queryKey: ["supervisor-endpoints"], queryFn: fetchSupervisorEndpoints });

  const activeQuery = { ka: kaQuery, genie: genieQuery, supervisor: endpointsQuery }[mode];
  const loading = activeQuery.isLoading;

  useEffect(() => { if (kaQuery.data) setKAList(kaQuery.data); }, [kaQuery.data, setKAList]);
  useEffect(() => { if (genieQuery.data) setGenieList(genieQuery.data); }, [genieQuery.data, setGenieList]);
  useEffect(() => { if (endpointsQuery.data) setSupervisorList(endpointsQuery.data); }, [endpointsQuery.data, setSupervisorList]);
  useEffect(() => { setSelectedItem(null); }, [mode, setSelectedItem]);

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
    if (!effectiveSelectedItem || isStreaming || hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;
    onSend(prefillInput, effectiveSelectedItem, mode);
    startTransition(() => setInput(""));
    onPrefillConsumed?.();
  }, [prefillInput, autoSubmit, effectiveSelectedItem, isStreaming, onSend, mode, onPrefillConsumed]);

  const dropdownItems = {
    ka: (kaQuery.data ?? []).map((k) => ({
      id: k.endpoint_name,
      label: k.display_name,
      description: k.description,
    })),
    genie: (genieQuery.data ?? []).map((g) => ({
      id: g.space_id,
      label: g.title,
    })),
    supervisor: (endpointsQuery.data ?? []).map((e) => ({
      id: e.name,
      label: e.display_name,
      description: e.state?.ready
        ? e.state.ready === "READY" ? "Ready" : `Not ready: ${e.state.ready}`
        : undefined,
    })),
  };

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || !effectiveSelectedItem || isStreaming) return;
    onSend(trimmed, effectiveSelectedItem, mode);
    setInput("");
  }, [input, effectiveSelectedItem, isStreaming, onSend, mode]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = !!input.trim() && !!effectiveSelectedItem && !isStreaming;

  return (
    <div className="shrink-0 bg-background/95 backdrop-blur-sm border-t py-3 sm:py-4 px-3 sm:px-4">
      <div className={fullWidth ? "w-full flex flex-col gap-2.5 px-2 sm:px-4" : "mx-auto flex w-full max-w-5xl flex-col gap-2.5"}>

        {/* Mode + Dropdown row */}
        <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
          <ModeSelector selected={mode} onChange={setMode} />
          <DropdownSelector
            items={dropdownItems[mode]}
            selected={selectedItem ?? effectiveSelectedItem}
            onSelect={setSelectedItem}
            placeholder={`Select ${mode === "ka" ? "assistant" : mode === "genie" ? "space" : "endpoint"}`}
            loading={loading}
          />
        </div>

        {/* Input box */}
        <InputGroup className="bg-card shadow-sm border border-border rounded-xl overflow-hidden focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15 transition-all">
          <InputGroupTextarea
            ref={textareaRef}
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything… (Enter to send, Shift+Enter for new line)"
            className="field-sizing-content min-h-14 max-h-44 bg-transparent p-3.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/45"
          />

          <InputGroupAddon
            align="block-end"
            className="justify-end bg-transparent px-3 py-2.5"
          >
            <InputGroupButton
              size="icon-sm"
              variant="ghost"
              onClick={handleSend}
              disabled={!canSend}
              type="button"
              className={canSend
                ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm rounded-lg size-8"
                : "text-muted-foreground/30 rounded-lg size-8"
              }
            >
              {isStreaming
                ? <Loader2 className="size-4 animate-spin" />
                : <CornerDownLeft className="size-4" />
              }
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>

        <p className="text-center text-[11px] text-muted-foreground/60">
          AI responses may not always be accurate. Verify important information.
        </p>
      </div>
    </div>
  );
}
