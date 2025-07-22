"use client";

import React, { memo, useRef, useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  // TableHeader, // No longer used here, moved to HeaderSection
  // TableHead, // No longer used here
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronDown, Edit3, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
    CapacityDataRow,
    TeamPeriodicMetrics,
    AggregatedPeriodicMetrics,
    MetricDefinition,
    TeamMetricDefinitions,
    AggregatedMetricDefinitions,
    TeamName,
    TimeInterval,
    TEAM_METRIC_ROW_DEFINITIONS,
    AGGREGATED_METRIC_ROW_DEFINITIONS,
} from "./types";
import { STANDARD_MONTHLY_WORK_MINUTES, STANDARD_WEEKLY_WORK_MINUTES } from "./types";
import type { ModelType } from "@/models/shared/interfaces";


interface MetricCellContentProps {
  item: CapacityDataRow;
  metricData: TeamPeriodicMetrics | AggregatedPeriodicMetrics | undefined;
  metricDef: MetricDefinition;
  periodName: string;
  onTeamMetricChange: (lobId: string, teamName: TeamName, periodHeader: string, metricKey: keyof TeamPeriodicMetrics, newValue: string) => void;
  onLobMetricChange: (lobId: string, periodHeader: string, metricKey: 'lobVolumeForecast' | 'lobAverageAHT' | 'lobTotalBaseRequiredMinutes', newValue: string) => void;
  isEditing: boolean;
  onSetEditingCell: (id: string | null, period: string | null, metricKey: string | null) => void;
  selectedTimeInterval: TimeInterval;
  selectedModel: ModelType;
}

const MetricCellContent: React.FC<MetricCellContentProps> = memo(({
  item,
  metricData,
  metricDef,
  periodName,
  onTeamMetricChange,
  onLobMetricChange,
  isEditing,
  onSetEditingCell,
  selectedTimeInterval,
  selectedModel,
}) => {
  const [tempValue, setTempValue] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const rawValue = metricData ? (metricData as any)[metricDef.key] : null;

  let canEditCell = false;
  if (item.itemType === 'Team' && metricDef.isEditableForTeam && !metricDef.isDisplayOnly) {
    canEditCell = true;
  } else if (item.itemType === 'LOB' && metricDef.isEditableForLob && !metricDef.isDisplayOnly) {
     canEditCell = true;
  }


  useEffect(() => {
    if (isEditing) {
      setTempValue(rawValue === null || rawValue === undefined ? "" : String(rawValue));
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    } else {
      setTempValue(null); // Clear tempValue when not editing
    }
  }, [isEditing, rawValue]);

  const handleEditClick = () => {
    if (!canEditCell) return;

    let editId: string | null = null;
    // For teams, the ID used for editing needs to be unique across LOBs
    if (item.itemType === 'Team' && item.lobId) {
      editId = `${item.lobId}_${item.name.replace(/\s+/g, '-')}`; // e.g. wfs_us-chat_Inhouse
    } else if (item.itemType === 'LOB') {
      editId = item.id; // LOB ID is already unique
    }
    
    if (editId) {
        onSetEditingCell(editId, periodName, metricDef.key as string);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTempValue(e.target.value);
  };

  const handleSave = () => {
    if (tempValue === null) { // Should not happen if called from onKeyDown Enter
      onSetEditingCell(null, null, null);
      return;
    }
    
    // Validate numeric input before saving
    const isNumericField = metricDef.isHC || metricDef.isTime || metricDef.isPercentage || metricDef.isCount || metricDef.step;
    if (isNumericField) {
        const parsedNum = parseFloat(tempValue);
        if (isNaN(parsedNum) && tempValue.trim() !== "" && tempValue.trim() !== "-") { // Allow empty or minus for null intent
            // console.warn(`Invalid numeric input: ${tempValue} for ${metricDef.key}`);
            // Potentially show a toast or validation message here
            onSetEditingCell(null, null, null); // Cancel edit on invalid input
            return;
        }
    }


    if (item.itemType === 'Team' && metricDef.isEditableForTeam && !metricDef.isDisplayOnly && item.lobId) {
      onTeamMetricChange(item.lobId, item.name as TeamName, periodName, metricDef.key as keyof TeamPeriodicMetrics, tempValue);
    } else if (item.itemType === 'LOB' && metricDef.isEditableForLob && !metricDef.isDisplayOnly) {
      // Handle model-specific LOB metric changes
      let lobMetricKey = metricDef.key as string;
      if (selectedModel === 'cph' && metricDef.key === 'averageCPH') {
        lobMetricKey = 'lobAverageAHT'; // Map CPH back to AHT for storage
      } else if (selectedModel === 'billable-hours' && metricDef.key === 'billableHoursRequire') {
        lobMetricKey = 'lobTotalBaseRequiredMinutes'; // Map billable hours to base minutes
      }
      onLobMetricChange(item.id, periodName, lobMetricKey as 'lobVolumeForecast' | 'lobAverageAHT' | 'lobTotalBaseRequiredMinutes', tempValue);
    }
    setTempValue(null); // Clear tempValue after save
    onSetEditingCell(null, null, null);
  };

  const handleCancel = () => {
    setTempValue(null);
    onSetEditingCell(null, null, null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const handleBlur = () => {
    // Only save on blur if tempValue is not null (meaning there was an interaction)
    // This prevents saving an empty string just by blurring an empty cell
    if (tempValue !== null && isEditing) {
        const isNumericField = metricDef.isHC || metricDef.isTime || metricDef.isPercentage || metricDef.isCount || metricDef.step;
        if (isNumericField) {
            const parsedNum = parseFloat(tempValue);
            // If it's not a valid number AND not an empty string (which means user wants to clear it/set to null)
            if (isNaN(parsedNum) && tempValue.trim() !== "" && tempValue.trim() !== "-") {
                // console.warn(`Invalid input on blur: ${tempValue} for ${metricDef.key}. Reverting or ignoring.`);
                onSetEditingCell(null, null, null); // Cancel edit
                return;
            }
        }
      handleSave();
    } else if (!isEditing) { // If blurred without any interaction and not editing, just clear edit state
        onSetEditingCell(null, null, null);
    }
  };


  if (isEditing) {
    return (
      <Input
        type="number"
        value={tempValue === null ? "" : tempValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="h-7 w-full max-w-[100px] text-right tabular-nums px-1 py-0.5 text-xs bg-background border-input focus:border-primary focus:ring-1 focus:ring-primary group-hover:border-primary"
        step={metricDef.step || "any"}
        autoFocus
        ref={inputRef}
      />
    );
  }
  
  let shouldDisplayMetric = false;
  if (item.itemType === 'Team') {
    shouldDisplayMetric = true;
  } else if ((item.itemType === 'BU' || item.itemType === 'LOB')) {
    // BU should not display LOB-specific editable metrics
    if (item.itemType === 'BU' && (metricDef.key === 'lobTotalBaseRequiredMinutes' || metricDef.key === 'lobVolumeForecast' || metricDef.key === 'lobAverageAHT')) {
       shouldDisplayMetric = false;
    } else {
       shouldDisplayMetric = true;
    }
  }

  if (!shouldDisplayMetric && !canEditCell) return null;


  if (rawValue === null || rawValue === undefined) {
    const isEditableEmptyCell = canEditCell;
    return (
      <div
        onClick={isEditableEmptyCell ? handleEditClick : undefined}
        className={`relative w-full h-full flex items-center justify-end pr-1 ${isEditableEmptyCell ? 'cursor-pointer group' : ''}`}
      >
        <Minus className="h-4 w-4 text-muted-foreground mx-auto" />
        {isEditableEmptyCell && !isEditing && <Edit3 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity absolute right-1 top-1/2 -translate-y-1/2" />}
      </div>
    );
  }

  let displayValue: React.ReactNode = "";
  let textColor = "text-foreground";
  let icon: React.ReactNode = null;
  let formulaText = "";

  const numValue = Number(rawValue);
  const teamMetrics = metricData as TeamPeriodicMetrics;
  const aggMetrics = metricData as AggregatedPeriodicMetrics;
  const standardWorkMinutesForPeriod = selectedTimeInterval === "Week" ? STANDARD_WEEKLY_WORK_MINUTES : STANDARD_MONTHLY_WORK_MINUTES;

  if (metricDef.isPercentage) {
    displayValue = `${numValue.toFixed(1)}%`;
  } else if (metricDef.isTime && (metricDef.key === 'aht' || metricDef.key === 'lobAverageAHT')) {
    displayValue = `${numValue.toFixed(1)} min`;
  } else if (metricDef.key === 'cph' || metricDef.key === 'averageCPH') {
    displayValue = `${numValue.toFixed(1)} CPH`;
  } else if (metricDef.isTime && (metricDef.key === '_calculatedRequiredAgentMinutes' || metricDef.key === '_calculatedActualProductiveAgentMinutes' || metricDef.key === 'lobTotalBaseRequiredMinutes')) {
    displayValue = `${numValue.toFixed(0)} min`;
  } else if (metricDef.key === 'billableHoursRequire') {
    displayValue = `${numValue.toFixed(0)} hrs`;
  } else if (metricDef.key === 'handlingCapacity') {
    displayValue = `${numValue.toFixed(0)}`;
  } else if (metricDef.isHC || ['moveIn', 'moveOut', 'newHireBatch', 'newHireProduction', 'attritionLossHC', 'endingHC', 'hcAfterAttrition'].includes(metricDef.key as string)) {
    if (selectedModel === 'fix-fte' && metricDef.key === 'requiredFTE') {
      displayValue = isNaN(numValue) ? '-' : numValue.toFixed(2);
    } else {
      displayValue = isNaN(numValue) ? '-' : Math.round(numValue).toString();
    }
  } else if (metricDef.isCount) {
     displayValue = isNaN(numValue) ? '-' : numValue.toFixed(0);
  } else if (typeof numValue === 'number' && !isNaN(numValue)) {
    displayValue = numValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  } else {
    displayValue = String(rawValue);
  }

  let baseTooltipText = `${item.name} - ${periodName}\n${metricDef.label}: ${displayValue}`;
  if (metricDef.description) { // Generic description from metricDef
    baseTooltipText += `\n\n${metricDef.description}`;
  }


  if (item.itemType === 'Team') {
    switch (metricDef.key) {
      case 'requiredHC':
      case 'requiredFTE':
        if (teamMetrics?._calculatedRequiredAgentMinutes !== null && typeof teamMetrics._calculatedRequiredAgentMinutes === 'number' &&
            (teamMetrics?.shrinkagePercentage !== null && typeof teamMetrics.shrinkagePercentage === 'number' || selectedModel === 'fix-fte' || selectedModel === 'fix-hc') &&
            (teamMetrics?.occupancyPercentage !== null && typeof teamMetrics.occupancyPercentage === 'number' && teamMetrics.occupancyPercentage > 0 || selectedModel === 'fix-fte' || selectedModel === 'fix-hc') &&
            standardWorkMinutesForPeriod > 0) {
          let effMinsPerHC;
          if (selectedModel === 'fix-fte' || selectedModel === 'fix-hc') {
            // Simplified calculation for Fix models
            effMinsPerHC = standardWorkMinutesForPeriod * 0.75; // Simplified factor
          } else {
            effMinsPerHC = standardWorkMinutesForPeriod * (1 - (teamMetrics.shrinkagePercentage / 100)) * (teamMetrics.occupancyPercentage / 100);
          }
          if (effMinsPerHC > 0) {
            const metricLabel = metricDef.key === 'requiredFTE' ? 'FTE' : 'HC';
            if (selectedModel === 'fix-fte' || selectedModel === 'fix-hc') {
              formulaText = `Formula: Team Eff. Req. Agent Mins / (Std Work Mins * Simplified Factor)\n` +
                            `Calc: ${teamMetrics._calculatedRequiredAgentMinutes.toFixed(0)} min / (${standardWorkMinutesForPeriod.toFixed(0)} * 0.75) = ${numValue.toFixed(2)} ${metricLabel}\n` +
                            `(Simplified methodology for ${selectedModel.toUpperCase()} model)`;
            } else {
              formulaText = `Formula: Team Eff. Req. Agent Mins / (Std Work Mins * (1-Shrink%) * Occupancy%)\n` +
                            `Calc: ${teamMetrics._calculatedRequiredAgentMinutes.toFixed(0)} min / (${standardWorkMinutesForPeriod.toFixed(0)} * (1 - ${(teamMetrics.shrinkagePercentage / 100).toFixed(2)}) * ${(teamMetrics.occupancyPercentage / 100).toFixed(2)}) = ${numValue.toFixed(2)} ${metricLabel}\n`;
            }
                          `(Effective Productive Mins per HC: ${effMinsPerHC.toFixed(0)})`;
          } else {
            const metricLabel = metricDef.key === 'requiredFTE' ? 'FTE' : 'HC';
            formulaText = `Formula: Team Eff. Req. Agent Mins / (Std Work Mins * ...)\n(Cannot calculate due to zero denominator component)`;
          }
        } else if (teamMetrics?._calculatedRequiredAgentMinutes === 0) {
          const metricLabel = metricDef.key === 'requiredFTE' ? 'FTE' : 'HC';
          formulaText = `Formula: Team Eff. Req. Agent Mins / (Std Work Mins * ...)\nCalculation: 0 / (...) = 0 ${metricLabel}`;
        }
        break;
      case '_calculatedRequiredAgentMinutes':
        if (teamMetrics && typeof teamMetrics.volumeMixPercentage === 'number' &&
            typeof teamMetrics.backlogPercentage === 'number' &&
            typeof item.lobId === 'string' &&
            metricData && '_lobTotalBaseRequiredMinutes_intermediate' in metricData // Check if intermediate LOB mins available
        ) {
            const lobBaseMins = (metricData as any)._lobTotalBaseRequiredMinutes_intermediate; // Access it
            const teamBaseMins = (lobBaseMins ?? 0) * (teamMetrics.volumeMixPercentage / 100);
            formulaText = `Formula: (LOB Total Base Req Mins * Vol Mix %) * (1 + Backlog %)\n` +
                          `Calc: ((${lobBaseMins?.toFixed(0) ?? 'N/A'} * ${(teamMetrics.volumeMixPercentage / 100).toFixed(2)}) * (1 + ${(teamMetrics.backlogPercentage / 100).toFixed(2)})) = ${numValue.toFixed(0)} min`;
        }
        break;
      case '_calculatedActualProductiveAgentMinutes':
        if (teamMetrics?.actualHC !== null && typeof teamMetrics.actualHC === 'number' &&
            teamMetrics?.shrinkagePercentage !== null && typeof teamMetrics.shrinkagePercentage === 'number' &&
            teamMetrics?.occupancyPercentage !== null && typeof teamMetrics.occupancyPercentage === 'number' &&
            standardWorkMinutesForPeriod > 0) {
          const prodMins = teamMetrics.actualHC * standardWorkMinutesForPeriod * (1 - (teamMetrics.shrinkagePercentage / 100)) * (teamMetrics.occupancyPercentage / 100);
          formulaText = `Formula: Actual HC * Std Work Mins * (1-Shrink%) * Occupancy%\n` +
                          `Calc: ${Math.round(teamMetrics.actualHC)} HC * ${standardWorkMinutesForPeriod.toFixed(0)} min * (1 - ${(teamMetrics.shrinkagePercentage / 100).toFixed(2)}) * ${(teamMetrics.occupancyPercentage / 100).toFixed(2)}) = ${prodMins.toFixed(0)} min`;
        }
        break;
      case 'overUnderHC':
        const isOverUnderFTE = selectedModel === 'fix-fte' && metricDef.label?.includes('FTE');
        if (teamMetrics?.actualHC !== null && typeof teamMetrics.actualHC === 'number' &&
            ((teamMetrics?.requiredHC !== null && typeof teamMetrics.requiredHC === 'number') || 
             (teamMetrics?.requiredFTE !== null && typeof teamMetrics.requiredFTE === 'number'))) {
          const requiredValue = isOverUnderFTE ? teamMetrics.requiredFTE : teamMetrics.requiredHC;
          const metricLabel = isOverUnderFTE ? 'FTE' : 'HC';
          formulaText = `Formula: Actual HC - Required ${metricLabel}\nCalc: ${Math.round(teamMetrics.actualHC)} HC - ${requiredValue?.toFixed(2)} ${metricLabel} = ${numValue.toFixed(2)} ${metricLabel}`;
        }
        break;
      case 'attritionLossHC':
        if (teamMetrics?.actualHC !== null && typeof teamMetrics.actualHC === 'number' &&
            teamMetrics?.attritionPercentage !== null && typeof teamMetrics.attritionPercentage === 'number') {
          formulaText = `Formula: Actual HC * Attrition %\nCalc: ${Math.round(teamMetrics.actualHC)} HC * ${(teamMetrics.attritionPercentage / 100).toFixed(3)} = ${numValue.toFixed(2)} HC`;
        }
        break;
      case 'hcAfterAttrition':
        if (teamMetrics?.actualHC !== null && typeof teamMetrics.actualHC === 'number' &&
            teamMetrics?.attritionLossHC !== null && typeof teamMetrics.attritionLossHC === 'number') {
          formulaText = `Formula: Actual HC - Attrition Loss HC\nCalc: ${Math.round(teamMetrics.actualHC)} HC - ${teamMetrics.attritionLossHC.toFixed(2)} HC = ${numValue.toFixed(2)} HC`;
        }
        break;
      case 'endingHC':
        if (teamMetrics?.hcAfterAttrition !== null && typeof teamMetrics.hcAfterAttrition === 'number' &&
            teamMetrics?.newHireProduction !== null && typeof teamMetrics.newHireProduction === 'number' &&
            teamMetrics?.moveIn !== null && typeof teamMetrics.moveIn === 'number' &&
            teamMetrics?.moveOut !== null && typeof teamMetrics.moveOut === 'number') {
          formulaText = `Formula: HC After Attrition + New Hire Prod. + Move In - Move Out\n` +
                          `Calc: ${teamMetrics.hcAfterAttrition.toFixed(2)} HC + ${Math.round(teamMetrics.newHireProduction)} HC + ${Math.round(teamMetrics.moveIn)} HC - ${Math.round(teamMetrics.moveOut)} HC = ${numValue.toFixed(2)} HC`;
        }
        break;
    }
  } else if (item.itemType === 'LOB' || item.itemType === 'BU') { // Aggregated metrics
    switch (metricDef.key) {
      case 'overUnderHC':
        const isAggOverUnderFTE = selectedModel === 'fix-fte' && metricDef.label?.includes('FTE');
        if (aggMetrics?.actualHC !== null && typeof aggMetrics.actualHC === 'number' &&
            ((aggMetrics?.requiredHC !== null && typeof aggMetrics.requiredHC === 'number') ||
             (aggMetrics?.requiredFTE !== null && typeof aggMetrics.requiredFTE === 'number'))) {
          const requiredValue = isAggOverUnderFTE ? aggMetrics.requiredFTE : aggMetrics.requiredHC;
          const metricLabel = isAggOverUnderFTE ? 'FTE' : 'HC';
          formulaText = `Formula: Agg. Actual HC - Agg. Required ${metricLabel}\nCalc: ${Math.round(aggMetrics.actualHC)} HC - ${requiredValue ? Math.round(requiredValue) : 'N/A'} ${metricLabel} = ${Math.round(numValue)} ${metricLabel}`;
        }
        break;
      case 'requiredHC':
      case 'requiredFTE':
      case 'actualHC':
        const childType = item.itemType === 'BU' ? 'LOBs' : 'Teams';
        const childNames = item.children?.map(child => child.name).join(', ') || 'N/A';
        if (childNames !== 'N/A' && item.children && item.children.length > 0) {
            const breakdown = item.children.map(child => {
                const childMetric = child.periodicData[periodName] as (TeamPeriodicMetrics | AggregatedPeriodicMetrics);
                const childValue = childMetric ? (childMetric as any)[metricDef.key] : null;
                return `${child.name}: ${childValue !== null ? Math.round(Number(childValue)) : 'N/A'}`;
            }).join(', ');
            formulaText = `Formula: SUM(${metricDef.label} from child ${childType})\nContributing: ${breakdown}`;
        } else {
            formulaText = `Formula: SUM(${metricDef.label} from child ${childType})`;
        }
        break;
      case 'lobTotalBaseRequiredMinutes':
        if (item.itemType === 'LOB' && aggMetrics && 'lobVolumeForecast' in aggMetrics && 'lobAverageAHT' in aggMetrics) {
            if (selectedModel === 'cph' && 'averageCPH' in aggMetrics) {
              // CPH model calculation
              const volume = aggMetrics.lobVolumeForecast;
              const cph = (aggMetrics as any).averageCPH;
              let calculatedMinsText = "N/A";
              if (typeof volume === 'number' && typeof cph === 'number' && cph > 0) {
                  calculatedMinsText = ((volume / cph) * 60).toFixed(0);
              } else if (typeof numValue === 'number') {
                  calculatedMinsText = numValue.toFixed(0);
              }
              formulaText = `Formula: (LOB Volume Forecast / LOB Avg CPH) * 60\n` +
                           `Calc: (${typeof volume === 'number' ? volume.toFixed(0) : 'N/A'} / ${typeof cph === 'number' ? cph.toFixed(1) : 'N/A'}) * 60 = ${calculatedMinsText} min\n` +
                           `(Value may be direct input or calculated from LOB Volume Forecast and LOB Average CPH)`;
            } else {
              // Standard AHT calculation
            const volume = aggMetrics.lobVolumeForecast;
            const aht = aggMetrics.lobAverageAHT;
            let calculatedMinsText = "N/A";
            if (typeof volume === 'number' && typeof aht === 'number') {
                calculatedMinsText = (volume * aht).toFixed(0);
            } else if (typeof numValue === 'number') {
                calculatedMinsText = numValue.toFixed(0); // Use the displayed value if direct input
            }

             formulaText = `Formula: LOB Volume Forecast * LOB Avg AHT\n` +
                           `Calc: ${typeof volume === 'number' ? volume.toFixed(0) : 'N/A'} * ${typeof aht === 'number' ? aht.toFixed(1) : 'N/A'} = ${calculatedMinsText} min\n` +
                           `(Value may be direct input or calculated from LOB Volume Forecast and LOB Average AHT)`;
            }
        }
        break;
    }
  }

  const finalTooltipText = formulaText ? `${baseTooltipText}\n\n${formulaText}` : baseTooltipText;

  if (metricDef.key === "overUnderHC") {
    const val = Math.round(numValue); // Rounded for comparison
    const reqHC = metricData ? Math.round(Number((metricData as any).requiredHC)) : null;
    const actHC = metricData ? Math.round(Number((metricData as any).actualHC)) : null;

    if (val >= 0) {
      textColor = "text-green-500";
      icon = <ArrowUp className="h-3 w-3 inline-block ml-1" />;
    } else { // val < 0
      if (val === -1 && reqHC === 10 && actHC === 9) {
        textColor = "text-red-500"; // Specific Red
      } else if (val === -1 && reqHC === 100 && actHC === 99) {
        textColor = "text-amber-500"; // Specific Amber
      } else {
        textColor = "text-red-500"; // General Red for other negatives
      }
      icon = <ArrowDown className="h-3 w-3 inline-block ml-1" />;
    }
  }

  const cellDivContent = (
    <>
      {displayValue} {icon}
      {canEditCell && !isEditing && <Edit3 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity absolute right-1 top-1/2 -translate-y-1/2" />}
    </>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          onClick={canEditCell && !isEditing ? handleEditClick : undefined}
          className={cn(
            `relative flex items-center justify-end gap-1 ${textColor} w-full h-full pr-1`,
            canEditCell ? 'cursor-pointer group' : ''
          )}
        >
          {cellDivContent}
        </div>
      </TooltipTrigger>
      <TooltipContent className="whitespace-pre-wrap text-xs max-w-xs">
        <p>{finalTooltipText}</p>
      </TooltipContent>
    </Tooltip>
  );
});
MetricCellContent.displayName = 'MetricCellContent';


interface MetricRowProps {
  item: CapacityDataRow;
  metricDef: MetricDefinition;
  level: number;
  periodHeaders: string[];
  onTeamMetricChange: (lobId: string, teamName: TeamName, periodHeader: string, metricKey: keyof TeamPeriodicMetrics, newValue: string) => void;
  onLobMetricChange: (lobId: string, periodHeader: string, metricKey: 'lobVolumeForecast' | 'lobAverageAHT' | 'lobTotalBaseRequiredMinutes', newValue: string) => void;
  editingCell: { id: string; period: string; metricKey: string } | null;
  onSetEditingCell: (id: string | null, period: string | null, metricKey: string | null) => void;
  selectedTimeInterval: TimeInterval;
  selectedModel: ModelType;
}

const MetricRow: React.FC<MetricRowProps> = memo(({ item, metricDef, level, periodHeaders, onTeamMetricChange, onLobMetricChange, editingCell, onSetEditingCell, selectedTimeInterval, selectedModel }) => {
  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell
        className="sticky left-0 z-20 bg-card font-normal text-foreground whitespace-nowrap py-2 border-r border-border/50"
        style={{ paddingLeft: `${level * 1.5 + 0.5}rem`, paddingRight: '1rem' }}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2">
              <span>{metricDef.label}</span>
              {((item.itemType === 'Team' && metricDef.isEditableForTeam && !metricDef.isDisplayOnly) || 
               (item.itemType === 'LOB' && metricDef.isEditableForLob && !metricDef.isDisplayOnly))&& 
               <Edit3 className="h-3 w-3 text-muted-foreground opacity-50" />}
            </div>
          </TooltipTrigger>
           <TooltipContent className="whitespace-pre-wrap text-xs max-w-xs">
            <p>{metricDef.label}</p>
            {/* Description for assumption rows is now shown in MetricCellContent's tooltip for data values */}
          </TooltipContent>
        </Tooltip>
      </TableCell>
      {periodHeaders.map((periodHeader) => {
        const metricForPeriod = item.periodicData[periodHeader];
        const isCurrentlyEditing =
          editingCell?.id === (item.itemType === 'Team' && item.lobId ? `${item.lobId}_${item.name.replace(/\s+/g, '-')}` : item.id) &&
          editingCell?.period === periodHeader &&
          editingCell?.metricKey === metricDef.key;

        return (
          <TableCell
            key={`${item.id}-${metricDef.key}-${periodHeader}`}
            className={`text-right tabular-nums py-2 px-2 min-w-[100px] border-l border-border/50`}
          >
            <MetricCellContent
                item={item}
                metricData={metricForPeriod}
                metricDef={metricDef}
                periodName={periodHeader}
                onTeamMetricChange={onTeamMetricChange}
                onLobMetricChange={onLobMetricChange}
                isEditing={isCurrentlyEditing}
                onSetEditingCell={onSetEditingCell}
                selectedTimeInterval={selectedTimeInterval}
                selectedModel={selectedModel}
            />
          </TableCell>
        );
      })}
    </TableRow>
  );
});
MetricRow.displayName = 'MetricRow';


interface CapacityTableProps {
  data: CapacityDataRow[];
  periodHeaders: string[];
  expandedItems: Record<string, boolean>;
  toggleExpand: (id: string) => void;
  teamMetricDefinitions: TeamMetricDefinitions;
  aggregatedMetricDefinitions: AggregatedMetricDefinitions;
  onTeamMetricChange: (lobId: string, teamName: TeamName, periodHeader: string, metricKey: keyof TeamPeriodicMetrics, newValue: string) => void;
  onLobMetricChange: (lobId: string, periodHeader: string, metricKey: 'lobVolumeForecast' | 'lobAverageAHT' | 'lobTotalBaseRequiredMinutes', newValue: string) => void;
  editingCell: { id: string; period: string; metricKey: string } | null;
  onSetEditingCell: (id: string | null, period: string | null, metricKey: string | null) => void;
  selectedTimeInterval: TimeInterval;
  onActiveHierarchyChange: (hierarchy: string | null) => void;
  tableBodyScrollRef: React.RefObject<HTMLDivElement>;
  selectedModel: ModelType;
}


export const CapacityTable: React.FC<CapacityTableProps> = memo(({
  data,
  periodHeaders,
  expandedItems,
  toggleExpand,
  teamMetricDefinitions,
  aggregatedMetricDefinitions,
  onLobMetricChange,
  onTeamMetricChange,
  editingCell,
  onSetEditingCell,
  selectedTimeInterval,
  onActiveHierarchyChange,
  tableBodyScrollRef,
  selectedModel,
}) => {

  const itemNameRowRefs = useRef<Map<string, HTMLTableRowElement | null>>(new Map());
  const scrollContainerRef = tableBodyScrollRef; // Use the passed ref

  useEffect(() => {
    if (!scrollContainerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let topMostIntersectingItem: { id: string; name: string; type: string; top: number } | null = null;
        const stickyHeaderHeight = document.querySelector('header.sticky[top-0]')?.clientHeight || 0; // Main page header
        
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const itemTop = entry.boundingClientRect.top;
                const itemId = (entry.target as HTMLElement).dataset.itemId || '';
                const itemName = (entry.target as HTMLElement).dataset.itemName || '';
                const itemType = (entry.target as HTMLElement).dataset.itemType || '';

                if (itemTop >= stickyHeaderHeight - 5 && itemTop < stickyHeaderHeight + 150) { // Consider items just below the sticky header
                    if (!topMostIntersectingItem || itemTop < topMostIntersectingItem.top) {
                        topMostIntersectingItem = { id: itemId, name: itemName, type: itemType, top: itemTop };
                    }
                }
            }
        });

        if (topMostIntersectingItem) {
          onActiveHierarchyChange(`${topMostIntersectingItem.type}: ${topMostIntersectingItem.name}`);
        } else {
          // If table body is scrolled to the very top, clear context
          if (scrollContainerRef.current && scrollContainerRef.current.scrollTop < 50) { 
             onActiveHierarchyChange(null); 
          }
        }
      },
      {
        root: null, // Observe intersections with the viewport
        rootMargin: `5px 0px -90% 0px`, // Small top margin, large negative bottom to focus on top visible area
        threshold: [0, 0.1, 0.5, 0.9, 1.0] // Multiple thresholds for better detection
      }
    );

    const currentRefs = Array.from(itemNameRowRefs.current.values());
    currentRefs.forEach(rowElement => {
      if (rowElement) observer.observe(rowElement);
    });

    return () => {
      currentRefs.forEach(rowElement => {
        if (rowElement) observer.unobserve(rowElement);
      });
      observer.disconnect();
    };
  }, [data, periodHeaders, expandedItems, onActiveHierarchyChange, scrollContainerRef]);


  const renderSubSection = (
    parentId: string,
    subSectionTitle: string,
    metrics: MetricDefinition[],
    item: CapacityDataRow, // This is the Team item
    level: number
  ) => {
    const subSectionId = `${item.id}_${subSectionTitle.replace(/\s+/g, '')}`;
    const isSubSectionExpanded = expandedItems[subSectionId] || false;
    const rows: React.ReactNode[] = [];

    rows.push(
      <TableRow key={subSectionId + "_header"} className="hover:bg-muted/30 bg-muted/20">
        <TableCell
          className="sticky left-0 z-20 bg-muted/20 font-medium text-foreground whitespace-nowrap py-2 border-r border-border/50"
          style={{ paddingLeft: `${level * 1.5 + 0.5}rem`, paddingRight: '1rem' }} // Indent sub-section header
        >
          <button
            onClick={() => toggleExpand(subSectionId)}
            className="w-full text-left flex items-center gap-2 text-sm"
          >
            <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isSubSectionExpanded ? "rotate-180" : ""}`} />
            {subSectionTitle}
          </button>
        </TableCell>
        {/* Placeholder cells for period headers */}
        {periodHeaders.map(ph => <TableCell key={`${subSectionId}_${ph}_placeholder`} className="py-2 px-2 min-w-[100px] border-l border-border/50"></TableCell>)}
      </TableRow>
    );

    if (isSubSectionExpanded) {
      metrics.forEach(metricDef => {
        rows.push(
          <MetricRow
            key={`${item.id}-${metricDef.key}`} // Ensure item.id is used for the team context
            item={item}
            metricDef={metricDef}
            level={level + 1} // Metrics under sub-section are further indented
            periodHeaders={periodHeaders}
            onTeamMetricChange={onTeamMetricChange}
            onLobMetricChange={onLobMetricChange}
            editingCell={editingCell}
            onSetEditingCell={onSetEditingCell}
            selectedTimeInterval={selectedTimeInterval}
            selectedModel={selectedModel}
          />
        );
      });
    }
    return rows;
  };

  const renderCapacityItemContent = (item: CapacityDataRow): React.ReactNode[] => {
    const rows: React.ReactNode[] = [];

    if (item.itemType === 'Team') {
      // Render Primary HC metrics directly
      const primaryHcMetrics = teamMetricDefinitions.filter(def => def.category === 'PrimaryHC');
      primaryHcMetrics.forEach(metricDef => {
        rows.push(
          <MetricRow
            key={`${item.id}-${metricDef.key}`}
            item={item}
            metricDef={metricDef}
            level={item.level + 1} // Metrics are one level deeper than team name
            periodHeaders={periodHeaders}
            onTeamMetricChange={onTeamMetricChange}
            onLobMetricChange={onLobMetricChange} // Pass down for consistency, though not used by team assumptions
            editingCell={editingCell}
            onSetEditingCell={onSetEditingCell}
            selectedTimeInterval={selectedTimeInterval}
            selectedModel={selectedModel}
          />
        );
      });

      // Render "Assumptions" sub-section
      const assumptionMetrics = teamMetricDefinitions.filter(def => def.category === 'Assumption');
      rows.push(...renderSubSection(item.id, "Assumptions", assumptionMetrics, item, item.level + 1));

      // Render "HC Adjustments" sub-section
      const adjustmentMetrics = teamMetricDefinitions.filter(def => def.category === 'HCAdjustment');
      rows.push(...renderSubSection(item.id, "HC Adjustments", adjustmentMetrics, item, item.level + 1));

    } else { // BU or LOB
      // Separate LOB input metrics from HC summary metrics for better organization
      const lobInputMetrics = aggregatedMetricDefinitions.filter(def =>
        def.key === 'lobVolumeForecast' || def.key === 'lobAverageAHT' || def.key === 'lobTotalBaseRequiredMinutes'
      );
      const hcSummaryMetrics = aggregatedMetricDefinitions.filter(def =>
        def.key === 'requiredHC' || def.key === 'actualHC' || def.key === 'overUnderHC'
      );

      // For LOB items, show input metrics first, then HC summary
      if (item.itemType === 'LOB') {
        // LOB Input Metrics section
        if (lobInputMetrics.length > 0) {
          rows.push(
            <TableRow key={`${item.id}_inputs_header`} className="hover:bg-muted/30 bg-muted/10">
              <TableCell
                className="sticky left-0 z-20 bg-muted/10 font-medium text-foreground whitespace-nowrap py-2 border-r border-border/50"
                style={{ paddingLeft: `${(item.level + 1) * 1.5 + 0.5}rem`, paddingRight: '1rem' }}
              >
                <span className="text-sm font-semibold text-primary">LOB Configuration</span>
              </TableCell>
              {periodHeaders.map(ph => <TableCell key={`${item.id}_inputs_${ph}_placeholder`} className="py-2 px-2 min-w-[100px] border-l border-border/50 bg-muted/10"></TableCell>)}
            </TableRow>
          );

          lobInputMetrics.forEach(metricDef => {
            rows.push(
              <MetricRow
                key={`${item.id}-${metricDef.key}`}
                item={item}
                metricDef={metricDef}
                level={item.level + 2}
                periodHeaders={periodHeaders}
                onTeamMetricChange={onTeamMetricChange}
                onLobMetricChange={onLobMetricChange}
                editingCell={editingCell}
                onSetEditingCell={onSetEditingCell}
                selectedTimeInterval={selectedTimeInterval}
                selectedModel={selectedModel}
              />
            );
          });
        }

        // HC Summary section
        if (hcSummaryMetrics.length > 0) {
          rows.push(
            <TableRow key={`${item.id}_hc_header`} className="hover:bg-muted/30 bg-muted/10">
              <TableCell
                className="sticky left-0 z-20 bg-muted/10 font-medium text-foreground whitespace-nowrap py-2 border-r border-border/50"
                style={{ paddingLeft: `${(item.level + 1) * 1.5 + 0.5}rem`, paddingRight: '1rem' }}
              >
                <span className="text-sm font-semibold text-blue-600">HC Summary</span>
              </TableCell>
              {periodHeaders.map(ph => <TableCell key={`${item.id}_hc_${ph}_placeholder`} className="py-2 px-2 min-w-[100px] border-l border-border/50 bg-muted/10"></TableCell>)}
            </TableRow>
          );
        }
      }

      // Render HC summary metrics for both LOB and BU
      hcSummaryMetrics.forEach(metricDef => {
        rows.push(
          <MetricRow
            key={`${item.id}-${metricDef.key}`}
            item={item}
            metricDef={metricDef}
            level={item.itemType === 'LOB' ? item.level + 2 : item.level + 1}
            periodHeaders={periodHeaders}
            onTeamMetricChange={onTeamMetricChange}
            onLobMetricChange={onLobMetricChange}
            editingCell={editingCell}
            onSetEditingCell={onSetEditingCell}
            selectedTimeInterval={selectedTimeInterval}
            selectedModel={selectedModel}
          />
        );
      });
    }
    return rows;
  };

  const renderTableItem = (item: CapacityDataRow): React.ReactNode[] => {
    const rows: React.ReactNode[] = [];
    const isExpanded = expandedItems[item.id] || false;

    let isExpandable = (item.children && item.children.length > 0) || item.itemType === 'Team'; // Teams are now expandable for their metrics

    let rowSpecificBgClass = 'bg-card';
    let buttonTextClass = 'text-foreground';
    let itemZIndex = 20; // Default z-index for general item rows

    if (item.itemType === 'BU') {
      rowSpecificBgClass = 'bg-secondary';
      buttonTextClass = 'text-secondary-foreground';
      itemZIndex = 35; // BUs highest in first col hierarchy
    } else if (item.itemType === 'LOB') {
      rowSpecificBgClass = 'bg-muted';
      buttonTextClass = 'text-muted-foreground';
      itemZIndex = 30; // LOBs next
    } else if (item.itemType === 'Team') {
      rowSpecificBgClass = 'bg-muted/50'; // Teams slightly different
      buttonTextClass = 'text-foreground';
      itemZIndex = 25; // Teams below LOBs
    }
    
    const hoverClass = item.itemType === 'BU' ? 'hover:bg-secondary/90' 
                      : item.itemType === 'LOB' ? 'hover:bg-muted/80' 
                      : 'hover:bg-muted/60';


    rows.push(
      <TableRow
        key={`${item.id}-name`}
        className={cn(rowSpecificBgClass, hoverClass)}
        ref={el => { if (el) itemNameRowRefs.current.set(item.id, el); else itemNameRowRefs.current.delete(item.id); }}
        data-item-id={item.id}
        data-item-name={item.name}
        data-item-type={item.itemType}
      >
        <TableCell
          className={cn("sticky left-0 whitespace-nowrap border-r border-border/50", rowSpecificBgClass)}
          style={{ zIndex: itemZIndex, paddingLeft: `${item.level * 1.5 + 0.5}rem` }}
        >
          <button
            onClick={isExpandable ? () => toggleExpand(item.id) : undefined}
            disabled={!isExpandable}
            className={cn(
              "py-3 px-2 font-semibold hover:no-underline w-full text-left flex items-center gap-2",
              buttonTextClass,
              (!isExpandable) ? 'cursor-default' : ''
            )}
            aria-expanded={isExpandable ? isExpanded : undefined}
          >
            {isExpandable && (
              <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
            )}
            {item.name}
          </button>
        </TableCell>
        {/* Placeholder cells for period headers in the name row */}
        {periodHeaders.map((ph) => (
          <TableCell
            key={`${item.id}-${ph}-nameplaceholder`}
            className={cn(rowSpecificBgClass, 'py-3 px-2 min-w-[100px] border-l border-border/50')}
          ></TableCell>
        ))}
      </TableRow>
    );

    if (isExpanded) {
        if (item.itemType === 'Team') {
            const itemContentRows = renderCapacityItemContent(item);
            rows.push(...itemContentRows);
        } else if (item.children && item.children.length > 0) { // BUs/LOBs expand to show child items
            item.children.forEach(child => {
                rows.push(...renderTableItem(child));
            });
        }
    }
    return rows;
  };


  return (
    <TooltipProvider delayDuration={300}>
      <div ref={tableBodyScrollRef} className="overflow-x-auto relative">
        <Table className="min-w-full">
          {/* TableHeader is now part of HeaderSection (merged into main page header) */}
          <TableBody>
            {data.length > 0 ? (
              data.flatMap(item => renderTableItem(item))
            ) : (
              <TableRow>
                <TableCell colSpan={periodHeaders.length + 1} className="text-center text-muted-foreground h-24">
                  No data available for the current selection.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
});
CapacityTable.displayName = 'CapacityTable';
