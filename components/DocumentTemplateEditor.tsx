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

interface DocumentTemplateEditorProps {
  config?: EditorConfig
}

export function DocumentTemplateEditor({ config }: DocumentTemplateEditorProps) {
  const { config: defaultConfig, updateConfig, saveTemplate, loading, error } =
    useTemplateApi('document')
  const editorConfig = config || defaultConfig
  const isEditorConfig = 'apiUrl' in editorConfig
  const initialApiUrl = isEditorConfig ? editorConfig.apiUrl : editorConfig.url
  const initialAuthType: 'none' | 'bearer' = isEditorConfig
    ? 'none'
    : editorConfig.auth?.type === 'bearer'
      ? 'bearer'
      : 'none'
  const initialAuthToken = isEditorConfig ? '' : editorConfig.auth?.token || ''

  const [template, setTemplate] = useState<Template>({
    id: '',
    name: 'New Document Template',
    type: 'document',
    content: '',
    lastModified: new Date(),
  })
  const [apiUrl, setApiUrl] = useState(initialApiUrl)
  const [authType, setAuthType] = useState<'none' | 'bearer'>(initialAuthType)
  const [authToken, setAuthToken] = useState(initialAuthToken)

  const handleApiConfigChange = () => {
    updateConfig({
      url: apiUrl,
      auth: {
        type: authType,
        token: authToken,
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
          <CardTitle>Document Template Editor</CardTitle>
          <CardDescription>
            Create and manage document templates with advanced formatting
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
            <Label htmlFor="auth-type">Authentication Type</Label>
            <select
              id="auth-type"
              value={authType}
              onChange={(e) =>
                setAuthType(e.target.value as 'none' | 'bearer')
              }
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="none">None</option>
              <option value="bearer">Bearer Token</option>
            </select>
          </div>

          {authType !== 'none' && (
            <div className="space-y-2">
              <Label htmlFor="auth-token">Auth Token</Label>
              <Input
                id="auth-token"
                type="password"
                placeholder="Your authentication token"
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
              />
            </div>
          )}

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
            <Label htmlFor="template-content">Content (Markdown)</Label>
            <Textarea
              id="template-content"
              value={template.content}
              onChange={(e) =>
                setTemplate((prev) => ({ ...prev, content: e.target.value }))
              }
              placeholder="Enter document template content (supports Markdown)"
              rows={12}
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
