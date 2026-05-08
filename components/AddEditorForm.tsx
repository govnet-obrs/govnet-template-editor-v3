'use client'

import { useState, useEffect } from 'react'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2 } from 'lucide-react'
import type { EditorConfig, EditorType, SyncMode, CredentialsType } from '@/lib/editor-types'
import { DEFAULT_PREVIEW_ENDPOINTS } from '@/lib/editor-types'
import { toast } from 'sonner'

interface AddEditorFormProps {
  existingEditors: EditorConfig[]
  editingEditor?: EditorConfig | null
  onSave: (editor: EditorConfig) => void
  onCancel: () => void
}

export function AddEditorForm({
  existingEditors,
  editingEditor,
  onSave,
  onCancel,
}: AddEditorFormProps) {
  const isEditMode = Boolean(editingEditor)

  const [name, setName] = useState(editingEditor?.name || '')
  const [type, setType] = useState<EditorType>(editingEditor?.type || 'notify')
  const [syncMode, setSyncMode] = useState<SyncMode>(editingEditor?.syncMode || 'online')
  const [apiUrl, setApiUrl] = useState(editingEditor?.apiUrl || '')
  const [localPreviewUrl, setLocalPreviewUrl] = useState(editingEditor?.localPreviewUrl || '')
  const [credentialsType, setCredentialsType] = useState<CredentialsType>(
    editingEditor?.credentialsType || 'header'
  )
  const [credentials, setCredentials] = useState<Array<{ key: string; value: string }>>(
    editingEditor?.credentials.length
      ? editingEditor.credentials
      : [{ key: '', value: '' }]
  )
  const [previewEndpointsJson, setPreviewEndpointsJson] = useState(
    editingEditor?.previewEndpoints
      ? JSON.stringify(editingEditor.previewEndpoints, null, 2)
      : JSON.stringify(DEFAULT_PREVIEW_ENDPOINTS, null, 2)
  )

  useEffect(() => {
    setName(editingEditor?.name || '')
    setType(editingEditor?.type || 'notify')
    setSyncMode(editingEditor?.syncMode || 'online')
    setApiUrl(editingEditor?.apiUrl || '')
    setLocalPreviewUrl(editingEditor?.localPreviewUrl || '')
    setCredentialsType(editingEditor?.credentialsType || 'header')
    setCredentials(
      editingEditor?.credentials.length
        ? editingEditor.credentials
        : [{ key: '', value: '' }]
    )
    setPreviewEndpointsJson(
      editingEditor?.previewEndpoints
        ? JSON.stringify(editingEditor.previewEndpoints, null, 2)
        : JSON.stringify(DEFAULT_PREVIEW_ENDPOINTS, null, 2)
    )
  }, [editingEditor?.id])

  const handleAddCredential = () => {
    setCredentials([...credentials, { key: '', value: '' }])
  }

  const handleRemoveCredential = (index: number) => {
    setCredentials(credentials.filter((_, i) => i !== index))
  }

  const handleCredentialChange = (
    index: number,
    field: 'key' | 'value',
    value: string
  ) => {
    setCredentials((prev) =>
      prev.map((cred, i) => (i === index ? { ...cred, [field]: value } : cred))
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const isValidUrl = (value: string): boolean => {
      try {
        const parsed = new URL(value)
        return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      } catch {
        return false
      }
    }

    if (!name.trim()) {
      toast.error('Editor name is required')
      return
    }

    const currentEditorId = editingEditor?.id
    const nameExists = existingEditors.some(
      (editor) =>
        editor.id !== currentEditorId &&
        editor.name.toLowerCase() === name.trim().toLowerCase()
    )

    if (nameExists) {
      toast.error(`An editor with the name "${name.trim()}" already exists`)
      return
    }

    if (!apiUrl.trim() && syncMode === 'online') {
      toast.error('API URL is required for online mode')
      return
    }

    if (apiUrl.trim() && !isValidUrl(apiUrl.trim())) {
      toast.error('API URL must be a valid HTTP/HTTPS URL')
      return
    }

    if (localPreviewUrl.trim() && !isValidUrl(localPreviewUrl.trim())) {
      toast.error('Local Preview URL must be a valid HTTP/HTTPS URL')
      return
    }

    let resolvedPreviewEndpoints: string[] = DEFAULT_PREVIEW_ENDPOINTS
    if (type === 'docify') {
      const rawJson = previewEndpointsJson.trim()
      if (rawJson) {
        let parsed: unknown
        try {
          parsed = JSON.parse(rawJson)
        } catch {
          toast.error('Preview Endpoints must be valid JSON (e.g. ["/documents/preview-document"])')
          return
        }
        if (
          !Array.isArray(parsed) ||
          parsed.length === 0 ||
          !parsed.every((v) => typeof v === 'string' && v.trim().startsWith('/'))
        ) {
          toast.error('Preview Endpoints must be a non-empty JSON array of paths starting with /')
          return
        }
        resolvedPreviewEndpoints = (parsed as string[]).map((v) => v.trim())
      }
    }

    const validCredentials = credentials.filter((c) => c.key.trim())
    const now = new Date().toISOString()

    const editor: EditorConfig = {
      id: editingEditor?.id || `editor-${Date.now()}`,
      name: name.trim(),
      type,
      syncMode,
      apiUrl: apiUrl.trim(),
      localPreviewUrl: localPreviewUrl.trim(),
      ...(type === 'docify' ? { previewEndpoints: resolvedPreviewEndpoints } : {}),
      credentialsType,
      credentials: validCredentials,
      createdAt: editingEditor?.createdAt || now,
      updatedAt: now,
    }

    onSave(editor)
    toast.success(
      isEditMode
        ? `Editor "${name.trim()}" updated successfully`
        : `Editor "${name.trim()}" created successfully`
    )
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{isEditMode ? 'Edit Editor' : 'Create New Editor'}</CardTitle>
        <CardDescription>
          {isEditMode
            ? 'Update your template editor configuration'
            : 'Set up a new template editor with your API configuration'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-2 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="editor-name">Editor Name</Label>
              <Input
                id="editor-name"
                placeholder="My Template Editor"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2 w-full">
              <Label htmlFor="editor-type">Editor Type</Label>
              <Select value={type} onValueChange={(value) => setType(value as EditorType)}>
                <SelectTrigger id="editor-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="notify">Notify</SelectItem>
                  <SelectItem value="docify">Docify</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 w-full">
            <div className="space-y-2">
              <Label htmlFor="sync-mode">Sync Mode</Label>
              <Select value={syncMode} onValueChange={(value) => setSyncMode(value as SyncMode)}>
                <SelectTrigger id="sync-mode" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">Online Only</SelectItem>
                  <SelectItem value="local">Local Drive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {syncMode === 'online' && (
              <div className="space-y-2">
                <Label htmlFor="api-url">API URL</Label>
                <Input
                  id="api-url"
                  placeholder="https://api.example.com"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="local-preview-url">Local Preview URL</Label>
            <Input
              id="local-preview-url"
              type="url"
              inputMode="url"
              placeholder="http://localhost:3000"
              value={localPreviewUrl}
              onChange={(e) => setLocalPreviewUrl(e.target.value)}
            />
          </div>

          {type === 'docify' && (
            <div className="space-y-2">
              <Label htmlFor="preview-endpoints">PDF Preview Endpoints</Label>
              <p className="text-xs text-muted-foreground">
                JSON array of relative endpoint paths in order (v1, v2, …). Each path must start with <code>/</code>.
              </p>
              <Textarea
                id="preview-endpoints"
                className="font-mono text-xs min-h-[80px]"
                placeholder='["/documents/preview-document"]'
                value={previewEndpointsJson}
                onChange={(e) => setPreviewEndpointsJson(e.target.value)}
              />
            </div>
          )}

          {syncMode === 'online' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="credentials-type">Credentials Type</Label>
                <Select
                  value={credentialsType}
                  onValueChange={(value) =>
                    setCredentialsType(value as CredentialsType)
                  }
                >
                  <SelectTrigger id="credentials-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="header">Request Header</SelectItem>
                    <SelectItem value="query">Query Parameter</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Credentials</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddCredential}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Credential
                  </Button>
                </div>

                <div className="space-y-3">
                  {credentials.map((cred, index) => (
                    <div key={index} className="flex gap-3 items-center">
                      <div className=" min-w-0">
                        <Input
                          placeholder="Key (e.g., Authorization)"
                          value={cred.key}
                          onChange={(e) =>
                            handleCredentialChange(index, 'key', e.target.value)
                          }
                          className="w-full"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Input
                          placeholder="Value (e.g., Bearer token...)"
                          type="password"
                          value={cred.value}
                          onChange={(e) =>
                            handleCredentialChange(index, 'value', e.target.value)
                          }
                          className="w-full"
                        />
                      </div>
                      {credentials.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveCredential(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="submit" className="flex-1">
              {isEditMode ? 'Save Changes' : 'Create Editor'}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
