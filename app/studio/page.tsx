"use client";

import { Toolbar } from "@/components/studio/toolbar";
import { EffectChain } from "@/components/studio/effect-chain";
import { FamilyBrowser } from "@/components/studio/family-browser";
import { WaveformCanvas } from "@/components/studio/waveform-canvas";
import { TransformPanel } from "@/components/studio/transform-panel";
import { StatsPanel } from "@/components/studio/stats-panel";
import { PropertiesPanel } from "@/components/studio/properties-panel";
import { SpectrumPanel } from "@/components/studio/spectrum-panel";
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
    <div className="flex h-screen min-h-0 min-w-0 flex-col overflow-hidden">
      <Toolbar />

      <ResizablePanelGroup
        orientation="vertical"
        className="flex-1 min-h-0 min-w-0"
      >
        {/* Top section: sidebar + canvas + right panel */}
        <ResizablePanel defaultSize="75%" minSize="35%">
          <ResizablePanelGroup
            orientation="horizontal"
            className="min-h-0 min-w-0"
          >
            {/* Left sidebar */}
            <ResizablePanel defaultSize="20%" minSize="15%" maxSize="35%">
              <div className="flex h-full min-h-0 min-w-0 flex-col border-r border-border bg-card">
                <Tabs
                  defaultValue="chain"
                  className="flex h-full min-h-0 min-w-0 flex-col"
                >
                  <TabsList className="h-8 w-full shrink-0 justify-start gap-0 border-b border-border bg-transparent px-1">
                    <TabsTrigger
                      value="chain"
                      className="h-6 px-2.5 text-[10px] data-[state=active]:bg-muted"
                    >
                      Chain
                    </TabsTrigger>
                    <TabsTrigger
                      value="browser"
                      className="h-6 px-2.5 text-[10px] data-[state=active]:bg-muted"
                    >
                      Browse
                    </TabsTrigger>
                    <TabsTrigger
                      value="regions"
                      className="h-6 px-2.5 text-[10px] data-[state=active]:bg-muted"
                    >
                      Regions
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent
                    value="chain"
                    className="mt-0 flex-1 overflow-hidden"
                  >
                    <EffectChain />
                  </TabsContent>
                  <TabsContent
                    value="browser"
                    className="mt-0 flex-1 overflow-hidden"
                  >
                    <FamilyBrowser />
                  </TabsContent>
                  <TabsContent
                    value="regions"
                    className="mt-0 flex-1 overflow-hidden"
                  >
                    <RegionEditor />
                  </TabsContent>
                </Tabs>
                <Separator />
                <div className="flex shrink-0 items-center px-2 py-1.5">
                  <GeneratorPanel />
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Center: waveform canvas */}
            <ResizablePanel defaultSize="58%" minSize="25%">
              <WaveformCanvas />
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Right sidebar */}
            <ResizablePanel defaultSize="22%" minSize="15%" maxSize="35%">
              <div className="flex h-full min-h-0 min-w-0 flex-col border-l border-border bg-card">
                <Tabs
                  defaultValue="stats"
                  className="flex h-full min-h-0 min-w-0 flex-col"
                >
                  <TabsList className="h-8 w-full shrink-0 justify-start gap-0 border-b border-border bg-transparent px-1">
                    <TabsTrigger
                      value="stats"
                      className="h-6 px-2.5 text-[10px] data-[state=active]:bg-muted"
                    >
                      Stats
                    </TabsTrigger>
                    <TabsTrigger
                      value="spectrum"
                      className="h-6 px-2.5 text-[10px] data-[state=active]:bg-muted"
                    >
                      FFT
                    </TabsTrigger>
                    <TabsTrigger
                      value="props"
                      className="h-6 px-2.5 text-[10px] data-[state=active]:bg-muted"
                    >
                      Props
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent
                    value="stats"
                    className="mt-0 flex-1 overflow-hidden"
                  >
                    <StatsPanel />
                  </TabsContent>
                  <TabsContent
                    value="spectrum"
                    className="mt-0 flex-1 overflow-hidden"
                  >
                    <SpectrumPanel />
                  </TabsContent>
                  <TabsContent
                    value="props"
                    className="mt-0 flex-1 overflow-hidden"
                  >
                    <PropertiesPanel />
                  </TabsContent>
                </Tabs>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Bottom: transform parameters */}
        <ResizablePanel defaultSize="25%" minSize="10%" maxSize="50%">
          <div className="h-full min-h-0 min-w-0 border-t border-border bg-card">
            <TransformPanel />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
