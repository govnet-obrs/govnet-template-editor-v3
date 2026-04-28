import { Code, Settings, Variable } from 'lucide-react'
import { HtmlEditor } from '@/components/HtmlEditor'
import { VariableEditor } from '@/components/VariableEditor'
import { SettingsEditor, type PageSettings } from '@/components/SettingsEditor'
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs'
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from '@/components/ui/resizable'
import { DocifyPreviewPanel } from '@/components/DocifyPreviewPanel'

interface DocifyEditorTabsProps {
    currentEditor: string
    htmlContent: string
    variablesContent: string
    pageSettings: PageSettings
    previewMode: 'html' | 'pdf' | 'local'
    zoom: number
    apiUrl: string
    localPreviewUrl: string
    sampleData: string
    onPushHtml: () => void
    onSyncMetadata: () => void
    onPageSettingsChange: (settings: PageSettings) => void
    onEditorChange: (value: string) => void
    onHtmlChange: (value: string) => void
    onVariablesChange: (value: string) => void
    onPreviewModeChange: (mode: 'html' | 'pdf' | 'local') => void
}

export function DocifyEditorTabs({
    currentEditor,
    htmlContent,
    variablesContent,
    pageSettings,
    previewMode,
    zoom,
    apiUrl,
    localPreviewUrl,
    sampleData,
    onPushHtml,
    onSyncMetadata,
    onPageSettingsChange,
    onEditorChange,
    onHtmlChange,
    onVariablesChange,
    onPreviewModeChange,
}: DocifyEditorTabsProps) {
    return (
        <Tabs
            value={currentEditor}
            onValueChange={onEditorChange}
            orientation="vertical"
            className="w-full bg-muted border-r border-border"
        >
            <TabsList
                variant="default"
                className="flex-col items-center h-full w-12 p-2 gap-4 bg-muted border-0 rounded-none"
            >
                <TabsTrigger
                    value="code"
                    title="Code View"
                    className="w-full cursor-pointer hover:bg-accent"
                >
                    <Code className="h-10 w-10" />
                </TabsTrigger>
                <TabsTrigger
                    value="variables"
                    title="Variables"
                    className="w-full cursor-pointer hover:bg-accent"
                >
                    <Variable className="h-10 w-10" />
                </TabsTrigger>
                <TabsTrigger
                    value="settings"
                    title="Settings"
                    className="w-full cursor-pointer hover:bg-accent"
                >
                    <Settings className="h-10 w-10" />
                </TabsTrigger>
            </TabsList>

            <ResizablePanelGroup orientation="horizontal" className="flex-1 w-full">
                <ResizablePanel defaultSize={50} minSize={30}>
                    <TabsContent value="code" className="flex-1 flex-col overflow-hidden flex h-full">
                        <HtmlEditor
                            htmlContent={htmlContent}
                            onHtmlChange={onHtmlChange}
                            zoom={zoom}
                            onPushHtml={onPushHtml}
                        />
                    </TabsContent>
                    <TabsContent
                        value="variables"
                        className="flex-1 flex-col overflow-hidden flex h-full"
                    >
                        <VariableEditor
                            variablesContent={variablesContent}
                            onVariablesChange={onVariablesChange}
                            zoom={zoom}
                            onSyncMetadata={onSyncMetadata}
                        />
                    </TabsContent>
                    <TabsContent
                        value="settings"
                        className="flex-1 flex-col overflow-hidden flex h-full"
                    >
                        <SettingsEditor
                            pageSettings={pageSettings}
                            onPageSettingsChange={onPageSettingsChange}
                            onSyncMetadata={onSyncMetadata}
                        />
                    </TabsContent>
                </ResizablePanel>

                <ResizableHandle />

                <ResizablePanel defaultSize={50} minSize={30}>
                    <DocifyPreviewPanel
                        htmlContent={htmlContent}
                        pageSettings={pageSettings}
                        previewMode={previewMode}
                        onPreviewModeChange={onPreviewModeChange}
                        apiUrl={apiUrl}
                        localPreviewUrl={localPreviewUrl}
                        sampleData={sampleData}
                    />
                </ResizablePanel>
            </ResizablePanelGroup>
        </Tabs>
    )
}
