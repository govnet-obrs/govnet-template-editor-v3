'use client'

import { useState, useEffect } from 'react'
import type { EditorConfig } from '@/lib/editor-types'

export const EDITOR_STORAGE_KEY = 'template-editors'

export function useEditorStorage() {
  const [editors, setEditors] = useState<EditorConfig[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(EDITOR_STORAGE_KEY)
    if (stored) {
      try {
        setEditors(JSON.parse(stored))
      } catch (err) {
        console.error('Failed to parse editors from storage:', err)
      }
    }
    setIsLoaded(true)
  }, [])

  const saveEditor = (editor: EditorConfig) => {
    const existing = editors.find((e) => e.id === editor.id)
    const updated = existing
      ? editors.map((e) => (e.id === editor.id ? editor : e))
      : [...editors, editor]
    try {
      localStorage.setItem(EDITOR_STORAGE_KEY, JSON.stringify(updated))
    } catch (err) {
      console.error('Failed to persist editor to storage:', err)
    }
    setEditors(updated)
  }

  const deleteEditor = (editorId: string) => {
    const updated = editors.filter((e) => e.id !== editorId)
    try {
      localStorage.setItem(EDITOR_STORAGE_KEY, JSON.stringify(updated))
    } catch (err) {
      console.error('Failed to persist editor deletion to storage:', err)
    }
    setEditors(updated)
  }

  const getEditor = (editorId: string) => {
    return editors.find((e) => e.id === editorId)
  }

  return {
    editors,
    isLoaded,
    saveEditor,
    deleteEditor,
    getEditor,
  }
}
