import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export interface ModelType {
  id: string;
  name: string;
  description: string;
  complexity: 'HIGH' | 'MEDIUM' | 'LOW';
}

export const AVAILABLE_MODELS: ModelType[] = [
  { id: 'volume-backlog', name: 'Volume & Backlog Hybrid', description: 'Full demand-driven operational planning', complexity: 'HIGH' },
  { id: 'cph', name: 'CPH Model', description: 'Contacts Per Hour approach (identical to Volume & Backlog)', complexity: 'HIGH' },
  { id: 'fix-fte', name: 'Fix FTE Model', description: 'Simplified FTE capacity planning', complexity: 'MEDIUM' },
  { id: 'fix-hc', name: 'Fix HC Model', description: 'Simplified HC capacity planning', complexity: 'MEDIUM' },
  { id: 'billable-hours', name: 'Billable Hours Model', description: 'Strategic long-term planning', complexity: 'LOW' },
];

interface ModelSelectorProps {
  selectedModelId: string;
  onModelChange: (modelId: string) => void;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ selectedModelId, onModelChange }) => {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="model-selector">Capacity Model</Label>
      <Select value={selectedModelId} onValueChange={onModelChange}>
        <SelectTrigger id="model-selector" className="w-full lg:w-[240px] text-sm h-9">
          <SelectValue placeholder="Select a model" />
        </SelectTrigger>
        <SelectContent>
          {AVAILABLE_MODELS.map((model) => (
            <SelectItem key={model.id} value={model.id}>
              {model.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default ModelSelector;
