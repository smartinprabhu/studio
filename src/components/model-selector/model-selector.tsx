"use client";

import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Calculator } from "lucide-react";
import { cn } from "@/lib/utils";
import { AVAILABLE_MODELS } from "@/models/shared/constants";
import type { ModelType } from "@/models/shared/interfaces";

interface ModelSelectorProps {
  selectedModel: ModelType;
  onModelChange: (model: ModelType) => void;
  className?: string;
}

export function ModelSelector({ selectedModel, onModelChange, className }: ModelSelectorProps) {
  const currentModel = AVAILABLE_MODELS.find(m => m.id === selectedModel);

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'HIGH': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'LOW': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label className="text-xs text-muted-foreground">Planning Model</Label>
      <Select value={selectedModel} onValueChange={onModelChange}>
        <SelectTrigger className="w-full lg:w-[280px] text-sm h-9">
          <Calculator className="mr-2 h-4 w-4 opacity-70" />
          <SelectValue placeholder="Select Model" />
        </SelectTrigger>
        <SelectContent>
          {AVAILABLE_MODELS.map((model) => (
            <SelectItem key={model.id} value={model.id}>
              <div className="flex items-center justify-between w-full">
                <div className="flex flex-col">
                  <span className="font-medium">{model.name}</span>
                  <span className="text-xs text-muted-foreground">{model.description}</span>
                </div>
                <Badge 
                  variant="outline" 
                  className={cn("ml-2 text-xs", getComplexityColor(model.complexity))}
                >
                  {model.complexity}
                </Badge>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {currentModel && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge 
            variant="outline" 
            className={cn("text-xs", getComplexityColor(currentModel.complexity))}
          >
            {currentModel.complexity}
          </Badge>
          <span>{currentModel.description}</span>
        </div>
      )}
    </div>
  );
}