"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Bell, FileText, Trash2 } from "lucide-react";
import type { EditorConfig } from "@/lib/editor-types";

interface EditorListProps {
  editors: EditorConfig[];
  onDeleteEditor: (editorId: string) => void;
  onEditEditor: (editor: EditorConfig) => void;
}

export function EditorList({
  editors,
  onDeleteEditor,
  onEditEditor,
}: EditorListProps) {
  const getEditorIcon = (type: string) => {
    return type === "notify" ? (
      <Bell className="h-5 w-5" />
    ) : (
      <FileText className="h-5 w-5" />
    );
  };

  if (editors.length === 0) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle>No Editors Created Yet</CardTitle>
          <CardDescription className="mt-2">
            Create your first editor to get started with template editing
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {editors.map((editor) => (
          <Card key={editor.id} className="flex flex-col">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-muted p-2">
                    {getEditorIcon(editor.type)}
                  </div>
                  <div>
                    <CardTitle className="capitalize">{editor.name}</CardTitle>
                    <CardDescription className="capitalize">
                      {editor.type} •{" "}
                      {editor.syncMode === "online" ? "Online" : "Local"}
                    </CardDescription>
                  </div>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger>
                    <Button variant="ghost" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogTitle>Delete Editor</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete "{editor.name}"? This
                      action cannot be undone.
                    </AlertDialogDescription>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onDeleteEditor(editor.id)}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-3">
              {editor.syncMode === "online" && (
                <>
                  <div>
                    <p className="text-xs text-muted-foreground">API URL</p>
                    <p className="break-all text-sm font-mono">
                      {editor.apiUrl}
                    </p>
                  </div>
                  {editor.credentials.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Credentials
                      </p>
                      <p className="text-sm">
                        {editor.credentials.length} credential
                        {editor.credentials.length !== 1 ? "s" : ""} in{" "}
                        {editor.credentialsType === "header"
                          ? "request header"
                          : "query parameter"}
                      </p>
                    </div>
                  )}
                </>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="text-sm">
                  {new Date(editor.createdAt).toLocaleDateString()}
                </p>
              </div>
            </CardContent>
            <div className="border-t px-6 py-3 flex justify-between">
              <Button
                onClick={() =>
                  (location.href = "/" + editor.type + "?editorId=" + editor.id)
                }
              >
                Open Editor
              </Button>
              <Button onClick={() => onEditEditor(editor)} variant="outline">
                Edit
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
