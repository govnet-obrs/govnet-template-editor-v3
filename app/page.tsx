"use client";

import { useState } from "react";
import { AddEditorForm } from "@/components/AddEditorForm";
import { EditorList } from "@/components/EditorList";
import { useEditorStorage } from "@/hooks/useEditorStorage";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import type { EditorConfig } from "@/lib/editor-types";

export default function Page() {
  const { editors, isLoaded, saveEditor, deleteEditor } = useEditorStorage();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEditor, setEditingEditor] = useState<EditorConfig | null>(null);

  if (!isLoaded) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome to Govnet Template Editor
          </h1>
          <p className="mt-2 text-muted-foreground">
            Create and manage template editors with flexible API integration
          </p>
        </div>

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Your Editors</h2>
            <p className="text-sm text-muted-foreground">
              {editors.length} editor{editors.length !== 1 ? "s" : ""}{" "}
              configured
            </p>
          </div>
          <Button
            onClick={() => {
              setEditingEditor(null);
              setShowAddForm(true);
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Editor
          </Button>
        </div>

        <EditorList
          editors={editors}
          onDeleteEditor={deleteEditor}
          onEditEditor={(editor) => {
            setEditingEditor(editor);
            setShowAddForm(true);
          }}
        />

        <Dialog
          open={showAddForm}
          onOpenChange={(open) => {
            setShowAddForm(open);
            if (!open) {
              setEditingEditor(null);
            }
          }}
        >
          <DialogContent className="w-full max-w-2xl  max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingEditor ? "Edit Editor" : "Add New Editor"}
              </DialogTitle>
            </DialogHeader>
            <AddEditorForm
              existingEditors={editors}
              editingEditor={editingEditor}
              onSave={(editor) => {
                saveEditor(editor);
                setShowAddForm(false);
                setEditingEditor(null);
              }}
              onCancel={() => {
                setShowAddForm(false);
                setEditingEditor(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}
