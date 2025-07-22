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
    <div className={cn("flex flex-wrap gap-2 p-4 bg-card border-b border-border", className)}>
      {AVAILABLE_MODELS.map((model) => (
        <Button
          key={model.id}
          variant={selectedModel === model.id ? "default" : "outline"}
          onClick={() => onModelChange(model.id)}
          className={cn(
            "flex flex-col items-start gap-1 h-auto p-3 min-w-[200px]",
            selectedModel === model.id && "ring-2 ring-primary ring-offset-2"
          )}
        >
          <div className="flex items-center justify-between w-full">
            <span className="font-medium text-sm">{model.name}</span>
            <Badge 
              variant="outline" 
              className={cn("text-xs", getComplexityColor(model.complexity))}
            >
              {model.complexity}
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground text-left">
            {model.description}
          </span>
        </Button>
      ))}
    </div>
  );
}