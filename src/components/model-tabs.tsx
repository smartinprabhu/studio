"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ModelType } from "@/models/shared/interfaces";
import { AVAILABLE_MODELS } from "@/models/shared/constants";

interface ModelTabsProps {
  selectedModel: ModelType;
  onModelChange: (model: ModelType) => void;
  className?: string;
}

export function ModelTabs({ selectedModel, onModelChange, className }: ModelTabsProps) {
  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'HIGH': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'LOW': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <div className={cn("bg-card border-b border-border", className)}>
      <div className="px-4 py-3 border-b border-border/50">
        <h2 className="text-lg font-semibold text-foreground">Capacity Planning Models</h2>
        <p className="text-sm text-muted-foreground mt-1">Select a model to configure your capacity planning approach</p>
      </div>
      <div className="flex flex-wrap gap-3 p-4">
        {AVAILABLE_MODELS.map((model) => (
          <Button
            key={model.id}
            variant={selectedModel === model.id ? "default" : "outline"}
            onClick={() => onModelChange(model.id)}
            className={cn(
              "flex flex-col items-start gap-2 h-auto p-4 min-w-[240px] max-w-[280px] transition-all duration-200 hover:scale-[1.02]",
              selectedModel === model.id && "ring-2 ring-primary ring-offset-2 shadow-lg",
              "group relative overflow-hidden"
            )}
          >
            <div className="flex items-center justify-between w-full">
              <span className="font-semibold text-sm">{model.name}</span>
              <Badge
                variant={selectedModel === model.id ? "secondary" : "outline"}
                className={cn(
                  "text-xs font-medium transition-colors",
                  selectedModel === model.id ? "bg-primary-foreground text-primary" : getComplexityColor(model.complexity)
                )}
              >
                {model.complexity}
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground text-left leading-relaxed">
              {model.description}
            </span>
            {selectedModel === model.id && (
              <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
            )}
          </Button>
        ))}
      </div>
    </div>
  );
}
