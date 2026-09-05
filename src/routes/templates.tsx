import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save } from "lucide-react";
import type { MessageTemplate } from "@/lib/recovery";

export const Route = createFileRoute("/templates")({
  head: () => ({
    meta: [
      { title: "Message Templates — RevRecover AI" },
      {
        name: "description",
        content:
          "Edit the English and Hinglish recovery message wording for every payment failure reason.",
      },
      { property: "og:title", content: "Message Templates — RevRecover AI" },
      {
        property: "og:description",
        content:
          "Edit the English and Hinglish recovery message wording for every payment failure reason.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TemplatesPage,
});

type Draft = Record<string, MessageTemplate>;

function TemplatesPage() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>({});

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["message_templates"],
    queryFn: async (): Promise<MessageTemplate[]> => {
      const { data, error } = await supabase
        .from("message_templates")
        .select("*")
        .order("failure_reason", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MessageTemplate[];
    },
  });

  useEffect(() => {
    if (templates.length === 0) return;
    setDraft((prev) => {
      const next: Draft = { ...prev };
      for (const row of templates) if (!next[row.id]) next[row.id] = row;
      return next;
    });
  }, [templates]);

  const save = useMutation({
    mutationFn: async (row: MessageTemplate) => {
      const { error } = await supabase
        .from("message_templates")
        .update({
          strategy: row.strategy,
          english_template: row.english_template,
          hinglish_template: row.hinglish_template,
        })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template saved");
      queryClient.invalidateQueries({ queryKey: ["message_templates"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const update = (id: string, patch: Partial<MessageTemplate>) =>
    setDraft((prev) => ({ ...prev, [id]: { ...prev[id]!, ...patch } }));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-6">
        <Button asChild variant="ghost" size="sm" className="mb-4 gap-2">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
        </Button>

        <h1 className="text-3xl font-bold tracking-tight">Message Templates</h1>
        <p className="mt-1 text-muted-foreground">
          Edit the English and Hinglish wording used for each failure reason.
          Placeholders you can use: <code>{"{customer}"}</code>{" "}
          <code>{"{first_name}"}</code> <code>{"{reference}"}</code>{" "}
          <code>{"{amount}"}</code> <code>{"{pay_url}"}</code>{" "}
          <code>{"{checkout_url}"}</code>
        </p>

        <div className="mt-8 grid gap-6">
          {isLoading && (
            <p className="text-muted-foreground">Loading templates…</p>
          )}
          {templates.map((row) => {
            const value = draft[row.id] ?? row;
            return (
              <Card key={row.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{row.failure_reason}</CardTitle>
                  <CardDescription>
                    Applied to every case with this failure reason.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor={`strategy-${row.id}`}>Strategy label</Label>
                    <Input
                      id={`strategy-${row.id}`}
                      value={value.strategy}
                      onChange={(e) =>
                        update(row.id, { strategy: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`en-${row.id}`}>English message</Label>
                    <Textarea
                      id={`en-${row.id}`}
                      rows={3}
                      value={value.english_template}
                      onChange={(e) =>
                        update(row.id, { english_template: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`hi-${row.id}`}>Hinglish message</Label>
                    <Textarea
                      id={`hi-${row.id}`}
                      rows={3}
                      value={value.hinglish_template}
                      onChange={(e) =>
                        update(row.id, { hinglish_template: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      className="gap-2"
                      onClick={() => save.mutate(value)}
                      disabled={save.isPending}
                    >
                      <Save className="h-4 w-4" />
                      Save
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
