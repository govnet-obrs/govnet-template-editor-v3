'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useTemplateApi, type Template } from '@/hooks/useTemplateApi'
import type { EditorConfig } from '@/lib/editor-types'
import { toast } from 'sonner'

interface NotificationTemplateEditorProps {
  config?: EditorConfig
}

export function NotificationTemplateEditor({ config }: NotificationTemplateEditorProps) {
  const { config: defaultConfig, updateConfig, saveTemplate, loading, error } =
    useTemplateApi('notification')
  const [template, setTemplate] = useState<Template>({
    id: '',
    name: 'New Notification Template',
    type: 'notification',
    content: '',
    lastModified: new Date(),
  })
  const editorConfig = config || defaultConfig
  const isEditorConfig = 'apiUrl' in editorConfig
  const initialApiUrl = isEditorConfig ? editorConfig.apiUrl : editorConfig.url
  const initialApiKey = isEditorConfig ? '' : editorConfig.auth?.token || ''
  const [apiUrl, setApiUrl] = useState(initialApiUrl)
  const [apiKey, setApiKey] = useState(initialApiKey)

  const handleApiConfigChange = () => {
    updateConfig({
      url: apiUrl,
      auth: {
        type: apiKey ? 'api-key' : 'none',
        token: apiKey,
        header: 'X-API-Key',
      },
    })
    toast.success('API configuration updated')
  }

  const handleSave = async () => {
    try {
      const result = await saveTemplate(template)
      setTemplate((prev) => ({ ...prev, id: result.id }))
      toast.success('Template saved successfully')
    } catch (err) {
      toast.error('Failed to save template')
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Notification Template Editor</CardTitle>
          <CardDescription>
            Create and manage notification templates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-url">API URL</Label>
            <Input
              id="api-url"
              placeholder="https://api.example.com"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="api-key">API Key (Optional)</Label>
            <Input
              id="api-key"
              type="password"
              placeholder="Your API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>

          <Button onClick={handleApiConfigChange} variant="outline">
            Update Configuration
          </Button>

          {error && <div className="text-sm text-red-500">{error}</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Template Content</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">Template Name</Label>
            <Input
              id="template-name"
              value={template.name}
              onChange={(e) =>
                setTemplate((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Enter template name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-content">Content</Label>
            <Textarea
              id="template-content"
              value={template.content}
              onChange={(e) =>
                setTemplate((prev) => ({ ...prev, content: e.target.value }))
              }
              placeholder="Enter notification template content"
              rows={10}
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={loading}>
              {loading ? 'Saving...' : 'Save Template'}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger>
                <Button variant="destructive">Clear</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogTitle>Clear Template</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to clear this template? This action
                  cannot be undone.
                </AlertDialogDescription>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() =>
                    setTemplate((prev) => ({ ...prev, content: '' }))
                  }
                >
                  Clear
                </AlertDialogAction>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
