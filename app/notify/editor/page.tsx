'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { EmailEditor } from '@/components/EmailEditor'
import { SmsEditor } from '@/components/SmsEditor'
import { useTemplateSync } from '@/hooks/useTemplateSync'
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
import {
  ChevronLeft,
  Mail,
  MessageSquare,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Save,
  Monitor,
  Tablet,
  Smartphone,
  Home,
  Cloud,
  CloudOff,
  CloudCheck,
  Loader2,
} from 'lucide-react'

interface NotificationTemplate {
  id: string
  key?: string
  subject?: string
  sender?: string
  sms?: string
  email?: string
  bcc?: string[]
  cc?: string[]
  data?: unknown
  createdAt: string
  updatedAt?: string
  type?: 'SMS' | 'EMAIL' | 'PUSH' | string
  channel?: string
}

function getInitialTemplate(templateId: string | null): NotificationTemplate | null {
  if (!templateId || typeof window === 'undefined') {
    return null
  }

  const storedData = localStorage.getItem(`template-${templateId}`)
  if (!storedData) {
    return null
  }

  try {
    const { expiry, template } = JSON.parse(storedData)
    if (expiry && Date.now() > expiry) {
      return null
    }

    return template ?? null
  } catch (err) {
    console.error('Failed to parse stored template:', err)
    return null
  }
}

export default function NotifyEditorPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editorId = searchParams.get('editorId')
  const templateId = searchParams.get('templateId')
  const currentEditor = searchParams.get('editor') || 'email'

  const { syncStatus, triggerSync, autoSyncEnabled, setAutoSyncEnabled } = useTemplateSync(editorId || undefined)
  const statusText =
    syncStatus.status === 'idle'
      ? 'Idle'
      : syncStatus.status === 'syncing'
        ? 'Syncing...'
        : syncStatus.status === 'success'
          ? 'Synced'
          : 'Failed'
  const statusClass =
    syncStatus.status === 'idle'
      ? 'text-muted-foreground'
      : syncStatus.status === 'syncing'
        ? 'text-blue-500'
        : syncStatus.status === 'success'
          ? 'text-green-500'
          : 'text-red-500'

  const [template] = useState<NotificationTemplate | null>(() => getInitialTemplate(templateId))
  const [emailContent, setEmailContent] = useState(() => getInitialTemplate(templateId)?.email || '')
  const [smsContent, setSmsContent] = useState(() => getInitialTemplate(templateId)?.sms || '')
  const [zoom, setZoom] = useState(100)
  const [deviceView, setDeviceView] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')

  const handleBack = () => {
    if (templateId) {
      localStorage.removeItem(`template-${templateId}`)
    }
    router.push(`/notify?editorId=${editorId}`)
  }

  const getTemplateName = (): string => {
    if (!template) return 'Unknown Template'
    return template.subject || template.key || 'Untitled'
  }

  const handleEditorChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('editor', value)
    router.push(`?${params.toString()}`, { scroll: false })
  }

  const handleEmailChange = useCallback((value: string) => {
    setEmailContent(value)
  }, [])

  const handleSmsChange = useCallback((value: string) => {
    setSmsContent(value)
  }, [])

  // Debounced localStorage persistence avoids write churn during typing.
  useEffect(() => {
    if (!template || !templateId) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      const storedData = localStorage.getItem(`template-${templateId}`)
      if (!storedData) {
        return
      }

      try {
        const { expiry, template: storedTemplate, ...rest } = JSON.parse(storedData)
        if (!storedTemplate) {
          return
        }

        if (storedTemplate.email === emailContent && storedTemplate.sms === smsContent) {
          return
        }

        const updatedData = {
          ...rest,
          expiry,
          template: {
            ...storedTemplate,
            email: emailContent,
            sms: smsContent,
          },
        }
        localStorage.setItem(`template-${templateId}`, JSON.stringify(updatedData))
      } catch (err) {
        console.error('Failed to sync notification template to localStorage:', err)
      }
    }, 250)

    return () => window.clearTimeout(timeoutId)
  }, [emailContent, smsContent, templateId, template])

  if (!template) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <p className="text-destructive">Template not found. Please select a template from the list.</p>
          <Button onClick={handleBack} className="mt-4">
            Back to Templates
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b border-border px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Home className="h-4 w-4" />
              </Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold">{getTemplateName()}</h1>
              {template.key && <p className="text-xs text-muted-foreground">{template.key}</p>}
            </div>
          </div>

          {/* Sync Status Indicator */}
          <div className="flex items-center gap-2">
            {syncStatus.status === 'idle' && (
              <Cloud className="h-4 w-4 text-muted-foreground" />
            )}
            {syncStatus.status === 'syncing' && (
              <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
            )}
            {syncStatus.status === 'success' && (
              <CloudCheck className="h-4 w-4 text-green-500" />
            )}
            {syncStatus.status === 'error' && (
              <CloudOff className="h-4 w-4 text-red-500" />
            )}
            <span className={`text-xs ${statusClass}`}>{statusText}</span>
            <Button
              size="sm"
              variant={autoSyncEnabled ? 'default' : 'outline'}
              onClick={() => setAutoSyncEnabled(!autoSyncEnabled)}
              title="Toggle auto sync"
            >
              Auto Sync {autoSyncEnabled ? 'On' : 'Off'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => triggerSync({ source: 'manual' })}>
              Sync
            </Button>
          </div>
        </div>
      </div>

      {/* Editor Section */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar with Tabs */}
        <Tabs
          value={currentEditor}
          onValueChange={handleEditorChange}
          orientation="vertical"
          className="w-full bg-muted border-r border-border"
        >
          <TabsList variant="default" className="flex-col items-center h-full w-12 p-2 gap-4 bg-muted border-0 rounded-none">
            <TabsTrigger value="email" title="Email Editor" className="w-full cursor-pointer hover:bg-accent">
              <Mail className="h-10 w-10" />
            </TabsTrigger>
            <TabsTrigger value="sms" title="SMS Editor" className="w-full cursor-pointer hover:bg-accent">
              <MessageSquare className="h-10 w-10" />
            </TabsTrigger>
          </TabsList>

          <ResizablePanelGroup orientation="horizontal" className="flex-1 w-full">
            <ResizablePanel defaultSize={60} minSize={30}>
              <TabsContent value="email" className="flex-1 flex-col overflow-hidden flex h-full w-full">
                <EmailEditor
                  emailContent={emailContent}
                  onEmailChange={handleEmailChange}
                  zoom={zoom}
                />
              </TabsContent>

              <TabsContent value="sms" className="flex-1 flex-col overflow-hidden flex h-full w-full">
                <SmsEditor
                  smsContent={smsContent}
                  onSmsChange={handleSmsChange}
                  zoom={zoom}
                />
              </TabsContent>
            </ResizablePanel>

            <ResizableHandle />

            <ResizablePanel defaultSize={40} minSize={30} className="flex flex-col border-l border-border w-full">
              <div className="bg-muted/50 px-4 py-2 border-b border-border flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    {currentEditor === 'email' ? 'Email Preview' : 'SMS Preview'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {currentEditor === 'email' ? 'Live preview of your email template' : 'How your SMS will appear on mobile devices'}
                  </p>
                </div>
                {currentEditor === 'email' && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant={deviceView === 'desktop' ? 'default' : 'ghost'}
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setDeviceView('desktop')}
                      title="Desktop View"
                    >
                      <Monitor className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={deviceView === 'tablet' ? 'default' : 'ghost'}
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setDeviceView('tablet')}
                      title="Tablet View"
                    >
                      <Tablet className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={deviceView === 'mobile' ? 'default' : 'ghost'}
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setDeviceView('mobile')}
                      title="Mobile View"
                    >
                      <Smartphone className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-auto flex items-center justify-center bg-gray-50 p-4">
                {currentEditor === 'email' ? (
                  emailContent ? (
                    <div
                      className="bg-white rounded-lg shadow-lg overflow-hidden"
                      style={{
                        width:
                          deviceView === 'desktop'
                            ? '100%'
                            : deviceView === 'tablet'
                              ? '768px'
                              : '375px',
                        maxWidth: '100%',
                      }}
                    >
                      <iframe
                        title="Email Preview"
                        srcDoc={emailContent}
                        className="w-full border-0 h-full"
                        style={{ minHeight: '600px' }}
                        sandbox="allow-scripts"
                      />
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-muted-foreground">Enter HTML to see email preview</p>
                    </div>
                  )
                ) : (
                  <div className="w-full max-w-sm">
                    <div className="flex flex-col items-end">
                      <div className="bg-gray-200 rounded-3xl rounded-tr-none px-4 py-2 max-w-xs">
                        <p className="text-sm text-gray-800 whitespace-pre-wrap wrap-break-word">
                          {smsContent || 'SMS preview will appear here'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 text-xs text-gray-500 text-right">
                      {smsContent.length} / 160 characters
                    </div>
                  </div>
                )}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </Tabs>
      </div>

      {/* Floating Toolbar */}
      <div className="fixed bottom-4 right-4 flex items-center gap-2 bg-background border border-border rounded-lg p-2 shadow-lg">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Zoom In"
          onClick={() => setZoom((prev) => Math.min(prev + 10, 200))}
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Zoom Out"
          onClick={() => setZoom((prev) => Math.max(prev - 10, 50))}
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <div className="w-px h-6 bg-border" />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Save"
        >
          <Save className="h-4 w-4" />
        </Button>
      </div>
    </main>
  )
}
