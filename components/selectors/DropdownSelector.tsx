"use client";

import { ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface DropdownItem {
  id: string;
  label: string;
  description?: string;
}

interface DropdownSelectorProps {
  items: DropdownItem[];
  selected: string | null;
  onSelect: (id: string) => void;
  placeholder: string;
  loading?: boolean;
}

export function DropdownSelector({
  items,
  selected,
  onSelect,
  placeholder,
  loading,
}: DropdownSelectorProps) {
  const selectedItem = items.find((i) => i.id === selected);

  if (loading) {
    return <Skeleton className="h-8 w-48 rounded-md" />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="max-w-52 justify-between gap-1 text-sm rounded-md"
        >
          <span className="truncate">
            {selectedItem?.label ?? placeholder}
          </span>
          <ChevronDown className="size-3 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {items.length === 0 ? (
          <DropdownMenuItem disabled>No items available</DropdownMenuItem>
        ) : (
          items.map((item) => (
            <DropdownMenuItem
              key={item.id}
              onClick={() => onSelect(item.id)}
              className="flex items-start gap-2"
            >
              <Check
                className={cn(
                  "mt-0.5 size-3.5 shrink-0",
                  selected === item.id ? "opacity-100" : "opacity-0"
                )}
              />
              <div className="flex flex-col">
                <span className="text-sm font-medium">{item.label}</span>
              </div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
