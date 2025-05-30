
"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { suggestLoBGroupings, type SuggestLoBGroupingsOutput } from "@/ai/flows/suggest-lob-groupings";

const aiGroupingDialogFormSchema = z.object({
  historicalCapacityData: z.string().min(1, "Historical data (CSV format) is required."),
  currentBusinessUnits: z.string().min(1, "Current business units (comma-separated) are required."),
});
type AiGroupingDialogFormData = z.infer<typeof aiGroupingDialogFormSchema>;

interface AiGroupingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AiGroupingDialog({ open, onOpenChange }: AiGroupingDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestLoBGroupingsOutput | null>(null);

  const form = useForm<AiGroupingDialogFormData>({
    resolver: zodResolver(aiGroupingDialogFormSchema),
    defaultValues: {
      historicalCapacityData: "LoB,Date,CapacityUsed,RequiredCapacity\nSales,2023-01-01,100,120\nSupport,2023-01-01,80,90",
      currentBusinessUnits: "BU Alpha, BU Beta",
    },
  });

  const onSubmit = async (data: AiGroupingDialogFormData) => {
    setIsLoading(true);
    setSuggestions(null);
    try {
      const businessUnitsArray = data.currentBusinessUnits.split(",").map(bu => bu.trim()).filter(bu => bu.length > 0);
      const result = await suggestLoBGroupings({
        historicalCapacityData: data.historicalCapacityData,
        currentBusinessUnits: businessUnitsArray,
      });
      setSuggestions(result);
      toast({
        title: "Suggestions Generated",
        description: "AI has provided LoB grouping suggestions.",
      });
    } catch (error) {
      console.error("Error generating LoB groupings:", error);
      toast({
        title: "Error",
        description: "Failed to generate LoB grouping suggestions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-card text-card-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            Assumptions Assister
          </DialogTitle>
          <DialogDescription>
            Provide historical data and current business units to get AI-driven suggestions for optimal LoB groupings.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="historicalCapacityData">Historical Capacity Data (CSV Format)</Label>
            <Textarea
              id="historicalCapacityData"
              placeholder="LoB,Date,CapacityUsed,RequiredCapacity..."
              {...form.register("historicalCapacityData")}
              className="mt-1 min-h-[120px]"
            />
            {form.formState.errors.historicalCapacityData && (
              <p className="text-sm text-destructive mt-1">{form.formState.errors.historicalCapacityData.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="currentBusinessUnits">Current Business Units (comma-separated)</Label>
            <Input
              id="currentBusinessUnits"
              placeholder="e.g., Sales Division, Product Team, Regional Office"
              {...form.register("currentBusinessUnits")}
              className="mt-1"
            />
            {form.formState.errors.currentBusinessUnits && (
              <p className="text-sm text-destructive mt-1">{form.formState.errors.currentBusinessUnits.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
              Get Suggestions
            </Button>
          </DialogFooter>
        </form>

        {suggestions && (
          <div className="mt-6 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Suggested Groupings</CardTitle>
              </CardHeader>
              <CardContent>
                {suggestions.suggestedGroupings.length > 0 ? (
                  <ul className="list-disc pl-5 space-y-1">
                    {suggestions.suggestedGroupings.map((group, index) => (
                      <li key={index} className="text-sm">
                        <strong>Group {index + 1}:</strong> {group.join(", ")}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No specific groupings suggested based on the data.</p>
                )}
              </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Reasoning</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{suggestions.reasoning}</p>
                </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

    