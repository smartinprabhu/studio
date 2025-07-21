"use client";
import React, { useState } from "react";
import { CheckIcon, Moon, Sun, Monitor } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useToast } from "@/components/ui/use-toast";
import { useTheme, ThemeMode, ColorTheme, FontFamily } from "../components/ThemeContext"; // Import useTheme and types from context

const ThemeSelector = () => {
  const { themeMode, colorTheme, fontFamily, setThemeMode, setColorTheme, setFontFamily } = useTheme(); // Use context
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  // Handle theme mode change
  const handleModeChange = (value: ThemeMode) => {
    setThemeMode(value); // Use context function
    toast({
      title: "Theme Mode Updated",
      description: `Theme changed to ${value === "system" ? "system preference" : value} mode`,
      duration: 2000,
    });
  };

  // Handle color theme change
  const handleColorThemeChange = (value: ColorTheme) => {
    setColorTheme(value); // setColorTheme from context will trigger useEffect in ThemeContext to apply theme
    toast({
      title: "Color Theme Updated",
      description: `Color theme changed to ${value}`,
      duration: 2000,
    });
  };

  // Display name for the current mode
  const currentModeName =
    themeMode === "light" ? "Light" :
    themeMode === "dark" ? "Dark" : "System";

  return (
    <Popover open={open} onOpenChange={setOpen}>
<PopoverTrigger asChild>
    <Button
  variant="ghost"
  size="sm"
  className="w-full justify-start px-3"
  style={{
    backgroundColor: themeMode === "dark" ? "transparent" : "transparent"
  }}
>
  {themeMode === "light" ? (
    <Sun className=" text-foreground flex items-center  hover:bg-accent hover:text-accent-foreground rounded-lg transition-colors duration-200" />
  ) : themeMode === "dark" ? (
    <Moon  className=" text-foreground flex items-center  hover:bg-accent hover:text-accent-foreground rounded-lg transition-colors duration-200" />
  ) : (
    <Monitor className=" text-foreground flex items-center  hover:bg-accent hover:text-accent-foreground rounded-lg transition-colors duration-200" />
  )}
  <span className=" text-foreground text-sm font-medium group-data-[collapsible=icon]:hidden">Themes</span> {/* Added text here */}
</Button>

</PopoverTrigger>


      <PopoverContent 
        className="w-80 p-4 bg-popover text-popover-foreground border-border"
        onMouseLeave={() => setOpen(false)}
      >
        <div className="space-y-4">
          {/* Theme Mode Selector - Matching reference image */}
          <div>
            <div className="mb-2 font-medium">Appearance</div>
            <div className="w-full overflow-hidden rounded-full bg-muted p-1 flex">
              <ToggleGroup
                type="single"
                value={themeMode}
                onValueChange={(value) => value && handleModeChange(value as ThemeMode)}
                className="flex justify-between rounded-full w-full"
              >
                <ToggleGroupItem
                  value="light"
                  className={cn(
                    "flex-1 items-center gap-2 rounded-full data-[state=on]:bg-primary data-[state=on]:text-white px-4 py-2",
                    themeMode === "light" && "bg-primary text-white"
                  )}
                >
                  <Sun className="h-4 w-4 mr-1" /> Light
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="dark"
                  className={cn(
                    "flex-1 items-center gap-2 rounded-full data-[state=on]:bg-primary data-[state=on]:text-white px-4 py-2",
                    themeMode === "dark" && "bg-primary text-white"
                  )}
                >
                  <Moon className="h-4 w-4 mr-1" /> Dark
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="system"
                  className={cn(
                    "flex-1 items-center gap-2 rounded-full data-[state=on]:bg-primary data-[state=on]:text-white px-4 py-2",
                    themeMode === "system" && "bg-primary text-white"
                  )}
                >
                  <Monitor className="h-4 w-4 mr-[-0.5px]" /> Device
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          {/* Color Theme Selector - Grid of color options like reference image */}
          <div>
            <div className="mb-2 font-medium">Theme Colors</div>
            <RadioGroup
              value={colorTheme}
              onValueChange={(value: ColorTheme) => handleColorThemeChange(value)}
              className="grid grid-cols-4 gap-3"
            >
              {/* First theme - Blue */}
              <div className="flex flex-col items-center gap-1">
                <Label
                  htmlFor="blue-theme"
                  className="cursor-pointer relative rounded-lg overflow-hidden w-16 h-16 flex items-center justify-center bg-muted"
                >
                  <div className="w-full h-full p-1 relative">
                    <div className={cn(
                      "w-full h-full rounded-full overflow-hidden flex flex-wrap"
                    )}>
                      {/* Upper left - light color */}
                      <div className={cn(
                        "w-1/2 h-1/2",
                        themeMode === 'dark' ? "bg-blue-900" : "bg-blue-50"
                      )}></div>
                      {/* Upper right - lighter color */}
                      <div className={cn(
                        "w-1/2 h-1/2",
                        themeMode === 'dark' ? "bg-blue-800" : "bg-blue-100"
                      )}></div>
                      {/* Lower left - dark color */}
                      <div className={cn(
                        "w-1/2 h-1/2",
                        themeMode === 'dark' ? "bg-blue-200" : "bg-blue-600"
                      )}></div>
                      {/* Lower right - darker color */}
                      <div className={cn(
                        "w-1/2 h-1/2",
                        themeMode === 'dark' ? "bg-blue-100" : "bg-blue-200"
                      )}></div>
                    </div>
                    {colorTheme === "blue" && (
                      <div className="absolute top-1 left-1 bg-blue-600 rounded-full p-1">
                        <CheckIcon className="h-4 w-4 text-white" />
                      </div>
                    )}
                  </div>
                </Label>
                <RadioGroupItem
                  id="blue-theme"
                  value="blue"
                  className="sr-only"
                />
              </div>

              {/* Second theme - Teal */}
              <div className="flex flex-col items-center gap-1">
                <Label
                  htmlFor="teal-theme"
                  className="cursor-pointer relative rounded-lg overflow-hidden w-16 h-16 flex items-center justify-center bg-muted"
                >
                  <div className="w-full h-full p-1">
                    <div className={cn(
                      "w-full h-full rounded-full overflow-hidden flex flex-wrap"
                    )}>
                      {/* Upper left - light teal */}
                      <div className={cn(
                        "w-1/2 h-1/2",
                        themeMode === 'dark' ? "bg-teal-900" : "bg-teal-50"
                      )}></div>
                      {/* Upper right - lighter teal */}
                      <div className={cn(
                        "w-1/2 h-1/2",
                        themeMode === 'dark' ? "bg-teal-800" : "bg-teal-100"
                      )}></div>
                      {/* Lower left - dark teal */}
                      <div className={cn(
                        "w-1/2 h-1/2",
                        themeMode === 'dark' ? "bg-teal-200" : "bg-teal-600"
                      )}></div>
                      {/* Lower right - darker teal */}
                      <div className={cn(
                        "w-1/2 h-1/2",
                        themeMode === 'dark' ? "bg-teal-100" : "bg-teal-200"
                      )}></div>
                    </div>
                    {colorTheme === "teal" && (
                      <div className="absolute top-1 left-1 bg-teal-600 rounded-full p-1">
                        <CheckIcon className="h-4 w-4 text-white" />
                      </div>
                    )}
                  </div>
                </Label>
                <RadioGroupItem
                  id="teal-theme"
                  value="teal"
                  className="sr-only"
                />
              </div>

              {/* Third theme - Green */}
              <div className="flex flex-col items-center gap-1">
                <Label
                  htmlFor="green-theme"
                  className="cursor-pointer relative rounded-lg overflow-hidden w-16 h-16 flex items-center justify-center bg-muted"
                >
                  <div className="w-full h-full p-1">
                    <div className={cn(
                      "w-full h-full rounded-full overflow-hidden flex flex-wrap"
                    )}>
                      {/* Upper left - light green */}
                      <div className={cn(
                        "w-1/2 h-1/2",
                        themeMode === 'dark' ? "bg-green-900" : "bg-green-50"
                      )}></div>
                      {/* Upper right - lighter green */}
                      <div className={cn(
                        "w-1/2 h-1/2",
                        themeMode === 'dark' ? "bg-green-800" : "bg-green-100"
                      )}></div>
                      {/* Lower left - dark green */}
                      <div className={cn(
                        "w-1/2 h-1/2",
                        themeMode === 'dark' ? "bg-green-200" : "bg-green-600"
                      )}></div>
                      {/* Lower right - darker green */}
                      <div className={cn(
                        "w-1/2 h-1/2",
                        themeMode === 'dark' ? "bg-green-100" : "bg-green-200"
                      )}></div>
                    </div>
                    {colorTheme === "green" && (
                      <div className="absolute top-1 left-1 bg-green-600 rounded-full p-1">
                        <CheckIcon className="h-4 w-4 text-white" />
                      </div>
                    )}
                  </div>
                </Label>
                <RadioGroupItem
                  id="green-theme"
                  value="green"
                  className="sr-only"
                />
              </div>

              {/* Fourth theme - Purple */}
              <div className="flex flex-col items-center gap-1">
                <Label
                  htmlFor="purple-theme"
                  className="cursor-pointer relative rounded-lg overflow-hidden w-16 h-16 flex items-center justify-center bg-muted"
                >
                  <div className="w-full h-full p-1">
                    <div className={cn(
                      "w-full h-full rounded-full overflow-hidden flex flex-wrap"
                    )}>
                      {/* Upper left - light purple */}
                      <div className={cn(
                        "w-1/2 h-1/2",
                        themeMode === 'dark' ? "bg-purple-900" : "bg-purple-50"
                      )}></div>
                      {/* Upper right - lighter purple */}
                      <div className={cn(
                        "w-1/2 h-1/2",
                        themeMode === 'dark' ? "bg-purple-800" : "bg-purple-100"
                      )}></div>
                      {/* Lower left - dark purple */}
                      <div className={cn(
                        "w-1/2 h-1/2",
                        themeMode === 'dark' ? "bg-purple-200" : "bg-purple-600"
                      )}></div>
                      {/* Lower right - darker purple */}
                      <div className={cn(
                        "w-1/2 h-1/2",
                        themeMode === 'dark' ? "bg-purple-100" : "bg-purple-200"
                      )}></div>
                    </div>
                    {colorTheme === "purple" && (
                      <div className="absolute top-1 left-1 bg-purple-600 rounded-full p-1">
                        <CheckIcon className="h-4 w-4 text-white" />
                      </div>
                    )}
                  </div>
                </Label>
                <RadioGroupItem
                  id="purple-theme"
                  value="purple"
                  className="sr-only"
                />
              </div>

              {/* Fifth theme - Orange */}
              <div className="flex flex-col items-center gap-1">
                <Label
                  htmlFor="orange-theme"
                  className="cursor-pointer relative rounded-lg overflow-hidden w-16 h-16 flex items-center justify-center bg-muted"
                >
                  <div className="w-full h-full p-1">
                    <div className={cn(
                      "w-full h-full rounded-full overflow-hidden flex flex-wrap"
                    )}>
                      {/* Upper left - light orange */}
                      <div className={cn(
                        "w-1/2 h-1/2",
                        themeMode === 'dark' ? "bg-orange-900" : "bg-orange-50"
                      )}></div>
                      {/* Upper right - lighter orange */}
                      <div className={cn(
                        "w-1/2 h-1/2",
                        themeMode === 'dark' ? "bg-orange-800" : "bg-orange-100"
                      )}></div>
                      {/* Lower left - dark orange */}
                      <div className={cn(
                        "w-1/2 h-1/2",
                        themeMode === 'dark' ? "bg-orange-200" : "bg-orange-600"
                      )}></div>
                      {/* Lower right - darker orange */}
                      <div className={cn(
                        "w-1/2 h-1/2",
                        themeMode === 'dark' ? "bg-orange-100" : "bg-orange-200"
                      )}></div>
                    </div>
                    {colorTheme === "orange" && (
                      <div className="absolute top-1 left-1 bg-orange-600 rounded-full p-1">
                        <CheckIcon className="h-4 w-4 text-white" />
                      </div>
                    )}
                  </div>
                </Label>
                <RadioGroupItem
                  id="orange-theme"
                  value="orange"
                  className="sr-only"
                />
              </div>

              {/* Sixth theme - Gray */}
              <div className="flex flex-col items-center gap-1">
                <Label
                  htmlFor="gray-theme"
                  className="cursor-pointer relative rounded-lg overflow-hidden w-16 h-16 flex items-center justify-center bg-muted"
                >
                  <div className="w-full h-full p-1">
                    <div className={cn(
                      "w-full h-full rounded-full overflow-hidden flex flex-wrap"
                    )}>
                      {/* Upper left - light gray */}
                      <div className={cn(
                        "w-1/2 h-1/2",
                        themeMode === 'dark' ? "bg-gray-900" : "bg-gray-50"
                      )}></div>
                      {/* Upper right - lighter gray */}
                      <div className={cn(
                        "w-1/2 h-1/2",
                        themeMode === 'dark' ? "bg-gray-800" : "bg-gray-100"
                      )}></div>
                      {/* Lower left - dark gray */}
                      <div className={cn(
                        "w-1/2 h-1/2",
                        themeMode === 'dark' ? "bg-gray-200" : "bg-gray-600"
                      )}></div>
                      {/* Lower right - darker gray */}
                      <div className={cn(
                        "w-1/2 h-1/2",
                        themeMode === 'dark' ? "bg-gray-100" : "bg-gray-200"
                      )}></div>
                    </div>
                    {colorTheme === "gray" && (
                      <div className="absolute top-1 left-1 bg-gray-600 rounded-full p-1">
                        <CheckIcon className="h-4 w-4 text-white" />
                      </div>
                    )}
                  </div>
                </Label>
                <RadioGroupItem
                  id="gray-theme"
                  value="gray"
                  className="sr-only"
                />
              </div>
            </RadioGroup>
          </div>

          {/* Font Family Selector */}
          <div>
            <div className="mb-2 font-medium">Font Family</div>
            <RadioGroup
              value={fontFamily}
              onValueChange={(value: FontFamily) => setFontFamily(value)}
              className="grid grid-cols-2 gap-3"
            >
              <div className="flex flex-col items-center gap-1">
                <Label
                  htmlFor="gotham-book-font"
                  className="cursor-pointer relative rounded-lg overflow-hidden w-full h-12 flex items-center justify-center bg-muted"
                >
                  <div className="w-full h-full p-2">
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-sm font-gotham-book">Gotham Book</span>
                    </div>
                    {fontFamily === "gotham-book" && (
                      <div className="absolute top-1 left-1 bg-primary rounded-full p-1">
                        <CheckIcon className="h-4 w-4 text-white" />
                      </div>
                    )}
                  </div>
                </Label>
                <RadioGroupItem
                  id="gotham-book-font"
                  value="gotham-book"
                  className="sr-only"
                />
              </div>

              <div className="flex flex-col items-center gap-1">
                <Label
                  htmlFor="system-font"
                  className="cursor-pointer relative rounded-lg overflow-hidden w-full h-12 flex items-center justify-center bg-muted"
                >
                  <div className="w-full h-full p-2">
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-sm">System Font</span>
                    </div>
                    {fontFamily === "system" && (
                      <div className="absolute top-1 left-1 bg-primary rounded-full p-1">
                        <CheckIcon className="h-4 w-4 text-white" />
                      </div>
                    )}
                  </div>
                </Label>
                <RadioGroupItem
                  id="system-font"
                  value="system"
                  className="sr-only"
                />
              </div>

            </RadioGroup>
          </div>

          <div className="pt-2 text-center text-sm text-muted-foreground">
            Current theme: {currentModeName} {colorTheme.charAt(0).toUpperCase() + colorTheme.slice(1)} • {
              fontFamily === "system" ? "System Font" : "Gotham Book"
            }
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ThemeSelector;
