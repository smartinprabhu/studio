"use client";

import React from "react";
import { useRouter, usePathname } from "next/navigation";
import { ModelTabs } from "@/components/model-tabs";
import type { ModelType } from "@/models/shared/interfaces";

export default function ModelsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  // Determine current model from pathname
  const getCurrentModel = (): ModelType => {
    if (pathname.includes('/cph')) return 'cph';
    if (pathname.includes('/fix-fte')) return 'fix-fte';
    if (pathname.includes('/fix-hc')) return 'fix-hc';
    if (pathname.includes('/billable-hours')) return 'billable-hours';
    return 'volume-backlog'; // Default fallback
  };

  const handleModelChange = (model: ModelType) => {
    if (model === 'volume-backlog') {
      router.push('/');
    } else {
      router.push(`/models/${model}`);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <ModelTabs 
        selectedModel={getCurrentModel()}
        onModelChange={handleModelChange}
      />
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}