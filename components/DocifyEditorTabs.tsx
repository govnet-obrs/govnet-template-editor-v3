import type { ReactNode } from 'react'
import { Code, Settings, Variable, FileCode2, Braces } from 'lucide-react'
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
    downloadHtmlContent?: string
    globalCssContent: string
    globalCssAssetNames: string[]
    globalJsContent: string
    globalJsAssetNames: string[]
    variablesContent: string
    pageSettings: PageSettings
    previewMode: 'html' | 'pdf' | 'local'
    zoom: number
    apiUrl: string
    localPreviewUrl: string
    previewEndpoints: string[]
    selectedPreviewEndpoint: string
    templateName: string
    description: string
    sampleData: string
    onPushHtml: () => void
    onDownloadHtml?: () => void
    onSyncMetadata: () => void
    onPageSettingsChange: (settings: PageSettings) => void
    onEditorChange: (value: string) => void
    onHtmlChange: (value: string) => void
    onVariablesChange: (value: string) => void
    onPreviewModeChange: (mode: 'html' | 'pdf' | 'local') => void
    onPreviewEndpointChange: (endpoint: string) => void
    resolveInjectedHtml?: (html: string) => Promise<string>
    globalCssAssetsEditor?: ReactNode
    globalJsAssetsEditor?: ReactNode
}

export function DocifyEditorTabs({
    currentEditor,
    htmlContent,
    downloadHtmlContent,
    globalCssContent,
    globalCssAssetNames,
    globalJsContent,
    globalJsAssetNames,
    variablesContent,
    pageSettings,
    previewMode,
    zoom,
    apiUrl,
    localPreviewUrl,
    previewEndpoints,
    selectedPreviewEndpoint,
    templateName,
    description,
    sampleData,
    onPushHtml,
    onDownloadHtml,
    onSyncMetadata,
    onPageSettingsChange,
    onEditorChange,
    onHtmlChange,
    onVariablesChange,
    onPreviewModeChange,
    onPreviewEndpointChange,
    resolveInjectedHtml,
    globalCssAssetsEditor,
    globalJsAssetsEditor,
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
                {globalCssAssetsEditor && (
                    <TabsTrigger
                        value="global-assets-css"
                        title="Global CSS Assets"
                        className="w-full cursor-pointer hover:bg-accent"
                    >
                        <FileCode2 className="h-10 w-10" />
                    </TabsTrigger>
                )}
                {globalJsAssetsEditor && (
                    <TabsTrigger
                        value="global-assets-js"
                        title="Global JavaScript Assets"
                        className="w-full cursor-pointer hover:bg-accent"
                    >
                        <Braces className="h-10 w-10" />
                    </TabsTrigger>
                )}
            </TabsList>

            <ResizablePanelGroup orientation="horizontal" className="flex-1 w-full">
                <ResizablePanel defaultSize={50} minSize={30}>
                    <TabsContent value="code" className="flex-1 flex-col overflow-hidden flex h-full">
                        <HtmlEditor
                            htmlContent={htmlContent}
                            downloadHtmlContent={downloadHtmlContent}
                            onHtmlChange={onHtmlChange}
                            zoom={zoom}
                            onPushHtml={onPushHtml}
                            onDownloadHtml={onDownloadHtml}
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
                    {globalCssAssetsEditor && (
                        <TabsContent
                            value="global-assets-css"
                            className="flex-1 flex-col overflow-hidden flex h-full"
                        >
                            {globalCssAssetsEditor}
                        </TabsContent>
                    )}
                    {globalJsAssetsEditor && (
                        <TabsContent
                            value="global-assets-js"
                            className="flex-1 flex-col overflow-hidden flex h-full"
                        >
                            {globalJsAssetsEditor}
                        </TabsContent>
                    )}
                </ResizablePanel>

                <ResizableHandle />

                <ResizablePanel defaultSize={50} minSize={30}>
                    <DocifyPreviewPanel
                        htmlContent={htmlContent}
                        globalCssContent={globalCssContent}
                        globalCssAssetNames={globalCssAssetNames}
                        globalJsContent={globalJsContent}
                        globalJsAssetNames={globalJsAssetNames}
                        pageSettings={pageSettings}
                        previewMode={previewMode}
                        onPreviewModeChange={onPreviewModeChange}
                        apiUrl={apiUrl}
                        localPreviewUrl={localPreviewUrl}
                        previewEndpoints={previewEndpoints}
                        selectedPreviewEndpoint={selectedPreviewEndpoint}
                        onPreviewEndpointChange={onPreviewEndpointChange}
                        templateName={templateName}
                        description={description}
                        sampleData={sampleData}
                        resolveInjectedHtml={resolveInjectedHtml}
                    />
                </ResizablePanel>
            </ResizablePanelGroup>
        </Tabs>
    )
}
