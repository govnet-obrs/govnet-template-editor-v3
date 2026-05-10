'use client'

import { useRef, useEffect, useCallback } from 'react'
import Editor from '@monaco-editor/react'
import { useTheme } from 'next-themes'
import { attachEditorKeyboardHandler } from '@/lib/editor-shortcuts'
import { Button } from '@/components/ui/button'
import { Download, Upload } from 'lucide-react'

export interface HtmlEditorProps {
  htmlContent: string
  downloadHtmlContent?: string
  onHtmlChange: (value: string) => void
  zoom: number
  onPushHtml?: () => void
  onDownloadHtml?: () => void
  globalAssetNames?: string[]
}

export function HtmlEditor({ htmlContent, downloadHtmlContent, onHtmlChange, zoom, onPushHtml, onDownloadHtml, globalAssetNames = [] }: HtmlEditorProps) {
  const editorRef = useRef<any>(null)
  const monacoRef = useRef<any>(null)
  const { resolvedTheme } = useTheme()

  const handleDownload = useCallback(() => {
    if (onDownloadHtml) {
      onDownloadHtml()
      return
    }

    const contentToDownload = downloadHtmlContent ?? htmlContent
    const blob = new Blob([contentToDownload || ''], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'template.html'
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }, [onDownloadHtml, downloadHtmlContent, htmlContent])

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor
    monacoRef.current = monaco
    editor.focus()

    // Register completion provider for global asset attrs and values
    monaco.languages.registerCompletionItemProvider('html', {
      provideCompletionItems: (model: any, position: any) => {
        const textUntilPosition = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        })
        // Attribute name suggestions
        const attrSuggestions = [
          {
            label: 'data-docify-global-css',
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: 'data-docify-global-css',
            detail: 'Global CSS Asset Attribute',
          },
          {
            label: 'data-docify-global-js',
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: 'data-docify-global-js',
            detail: 'Global JS Asset Attribute',
          },
        ]
        // Value suggestions for global asset attrs
        const valueSuggestions = globalAssetNames.map((name) => ({
          label: name,
          kind: monaco.languages.CompletionItemKind.Value,
          insertText: name,
          detail: 'Global Asset Name',
        }))

        // If user is typing an attribute value for a global asset attr, suggest asset names
        const attrMatch = textUntilPosition.match(/(data-docify-global-(css|js))\s*=\s*['"][^'"]*$/)
        if (attrMatch) {
          return { suggestions: valueSuggestions }
        }
        // Otherwise, suggest attribute names
        if (/\s<\w*[^>]*$/.test(textUntilPosition)) {
          return { suggestions: attrSuggestions }
        }
        return { suggestions: [] }
      },
    })
  }

  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return
    const cleanup = attachEditorKeyboardHandler(editorRef.current, monacoRef.current, 'html')
    return cleanup
  }, [])

  const getEditorTheme = () => {
    return resolvedTheme === 'dark' ? 'vs-dark' : 'vs'
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="bg-muted/50 px-4 py-2 border-b border-border flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">HTML Template</p>
        <div className="flex items-center gap-2">
          {onPushHtml && (
            <Button
              variant="outline"
              size="icon"
              onClick={onPushHtml}
              title="Push HTML"
              aria-label="Push HTML"
            >
              <Upload className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={handleDownload}
            title="Download HTML"
            aria-label="Download HTML"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden" style={{ zoom: `${zoom}%` }}>
        <Editor
          height="100%"
          defaultLanguage="html"
          value={htmlContent}
          onChange={(value) => onHtmlChange(value || '')}
          theme={getEditorTheme()}
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 13,
            lineNumbers: 'on',
            wordWrap: 'on',
            formatOnPaste: true,
            formatOnType: true,
            automaticLayout: true,
            folding: true,
            // bracketMatching: 'always',
            autoIndent: 'full',
            suggestOnTriggerCharacters: true,
            quickSuggestions: true,
            parameterHints: { enabled: true },
            hover: { enabled: true },
          }}
        />
      </div>
    </div>
  )
}
