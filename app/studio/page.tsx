"use client";

import { Toolbar } from "@/components/studio/toolbar";
import { EffectChain } from "@/components/studio/effect-chain";
import { FamilyBrowser } from "@/components/studio/family-browser";
import { WaveformCanvas } from "@/components/studio/waveform-canvas";
import { TransformPanel } from "@/components/studio/transform-panel";
import { StatsPanel } from "@/components/studio/stats-panel";
import { PropertiesPanel } from "@/components/studio/properties-panel";
import { RegionEditor } from "@/components/studio/region-editor";
import { GeneratorPanel } from "@/components/studio/generator-panel";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

export default function StudioPage() {
  return (
    <div className="flex h-screen flex-col">
      <Toolbar />

      <ResizablePanelGroup orientation="vertical" className="flex-1">
        {/* Top section: sidebar + canvas + right panel */}
        <ResizablePanel defaultSize={72} minSize={40}>
          <ResizablePanelGroup orientation="horizontal">
            {/* Left sidebar */}
            <ResizablePanel defaultSize={18} minSize={12} maxSize={30}>
              <div className="flex h-full flex-col border-r border-border">
                <Tabs defaultValue="chain" className="flex h-full flex-col">
                  <TabsList className="h-7 w-full justify-start gap-0 border-b border-border bg-transparent px-1">
                    <TabsTrigger
                      value="chain"
                      className="h-5 px-2 text-[10px] data-[state=active]:bg-muted"
                    >
                      Chain
                    </TabsTrigger>
                    <TabsTrigger
                      value="browser"
                      className="h-5 px-2 text-[10px] data-[state=active]:bg-muted"
                    >
                      Browse
                    </TabsTrigger>
                    <TabsTrigger
                      value="regions"
                      className="h-5 px-2 text-[10px] data-[state=active]:bg-muted"
                    >
                      Regions
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="chain" className="mt-0 flex-1 overflow-hidden">
                    <EffectChain />
                  </TabsContent>
                  <TabsContent value="browser" className="mt-0 flex-1 overflow-hidden">
                    <FamilyBrowser />
                  </TabsContent>
                  <TabsContent value="regions" className="mt-0 flex-1 overflow-hidden">
                    <RegionEditor />
                  </TabsContent>
                </Tabs>
                <Separator />
                <div className="flex items-center px-2 py-1">
                  <GeneratorPanel />
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle />

            {/* Center: waveform canvas */}
            <ResizablePanel defaultSize={62} minSize={30}>
              <WaveformCanvas />
            </ResizablePanel>

            <ResizableHandle />

            {/* Right sidebar */}
            <ResizablePanel defaultSize={20} minSize={14} maxSize={30}>
              <div className="flex h-full flex-col border-l border-border">
                <Tabs defaultValue="stats" className="flex h-full flex-col">
                  <TabsList className="h-7 w-full justify-start gap-0 border-b border-border bg-transparent px-1">
                    <TabsTrigger
                      value="stats"
                      className="h-5 px-2 text-[10px] data-[state=active]:bg-muted"
                    >
                      Stats
                    </TabsTrigger>
                    <TabsTrigger
                      value="props"
                      className="h-5 px-2 text-[10px] data-[state=active]:bg-muted"
                    >
                      Props
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="stats" className="mt-0 flex-1 overflow-hidden">
                    <StatsPanel />
                  </TabsContent>
                  <TabsContent value="props" className="mt-0 flex-1 overflow-hidden">
                    <PropertiesPanel />
                  </TabsContent>
                </Tabs>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>

        <ResizableHandle />

        {/* Bottom: transform parameters */}
        <ResizablePanel defaultSize={28} minSize={15} maxSize={45}>
          <div className="h-full border-t border-border">
            <TransformPanel />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
