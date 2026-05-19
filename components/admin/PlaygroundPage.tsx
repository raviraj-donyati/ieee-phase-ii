"use client";

import { useRef } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { PlaygroundWindow } from "@/components/admin/PlaygroundWindow";
import Link from "next/link";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export function PlaygroundPage() {
  // We use a ref-based callback so the clear button in the header
  // can trigger the clear inside PlaygroundWindow without lifting all state up.
  const clearRef = useRef<(() => void) | null>(null);

  const handleClear = () => clearRef.current?.();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <AdminPageHeader
        breadcrumbs={
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild><Link href="/admin">Admin</Link></BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem><BreadcrumbPage>Playground</BreadcrumbPage></BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            className="gap-1.5 text-xs h-7"
          >
            <Trash2 className="size-3" />
            Clear
          </Button>
        }
      />
      <PlaygroundWindow clearRef={clearRef} />
    </div>
  );
}
