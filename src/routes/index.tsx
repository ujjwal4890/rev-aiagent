import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Rocket,
  AlertTriangle,
  CheckCircle,
  Clock,
  MessageSquare,
  Plus,
  Trash2,
  ListChecks,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RevRecover AI — Bounded Revenue Recovery Engine" },
      {
        name: "description",
        content:
          "Track overdue invoices, failed subscriptions and checkout failures, then run bounded AI recovery with audit trails.",
      },
      {
        property: "og:title",
        content: "RevRecover AI — Bounded Revenue Recovery Engine",
      },
      {
        property: "og:description",
        content:
          "Track overdue invoices, failed subscriptions and checkout failures, then run bounded AI recovery with audit trails.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RevRecoverPage,
});

type RecoveryCase = {
  id: string;
  case_ref: string;
  customer: string;
  case_type: string;
  amount: number;
  failure_reason: string;
  attempts: number;
  status: string;
  opt_out: boolean;
  preferred_lang: string;
  recovered_amount: number;
  last_action: string | null;
  last_message: string | null;
};

const MAX_ATTEMPTS = 3;

const CASE_TYPES = [
  "Overdue Receivable",
  "Failed Subscription",
  "Checkout Abandonment",
];

const REASONS = [
  "Invoice Overdue 45 Days",
  "Card Declined (Insufficient Funds)",
  "Expired Credit Card",
  "Payment Gateway Timeout",
  "Disputed Invoice / Legal Notice Requested",
];

const STATUSES = ["Pending", "Recovered", "Escalated"];

type Outcome = {
  status: string;
  attempts: number;
  recovered_amount: number;
  last_action: string;
  last_message: string;
  stopping_rule: string;
  escalation: string;
};

function evaluate(item: RecoveryCase): Outcome {
  if (item.opt_out) {
    return {
      status: "Escalated",
      attempts: item.attempts,
      recovered_amount: 0,
      last_action: "Halted automated reach-out; flagged for compliance review.",
      last_message: "",
      stopping_rule: "STOP: Customer Opted Out / Dispute Raised",
      escalation: "ESCALATED TO HUMAN LEGAL",
    };
  }

  if (item.attempts >= MAX_ATTEMPTS) {
    return {
      status: "Escalated",
      attempts: item.attempts,
      recovered_amount: 0,
      last_action: "Transferred to manual outreach team.",
      last_message: "",
      stopping_rule: `STOP: Max Attempts Limit (${MAX_ATTEMPTS}) Reached`,
      escalation: "ESCALATED TO ACCOUNT MANAGER",
    };
  }

  const reason = item.failure_reason;
  const lang = item.preferred_lang;
  let strategy: string;
  let msg: string;
  let recovered: number;

  if (reason.includes("Insufficient Funds")) {
    strategy = "Smart Retries + Soft SMS";
    msg =
      lang === "Hinglish"
        ? `Hey ${item.customer.split(" ")[0]}! Your subscription retry failed. Subah try karein? https://pay.link/${item.case_ref}`
        : `Hi ${item.customer}, update payment here: https://pay.link/${item.case_ref}`;
    recovered = item.amount;
  } else if (reason.includes("Expired Credit Card")) {
    strategy = "1-Click Card Update Link";
    msg = `Dear ${item.customer}, your card expired. Update here: https://pay.link/update/${item.case_ref}`;
    recovered = item.amount;
  } else if (reason.includes("Timeout")) {
    strategy = "Immediate Auto-Retry Sequencer";
    msg = `Hi ${item.customer}, checkout failed due to a glitch. Finish here: https://checkout.link/${item.case_ref}`;
    recovered = item.amount;
  } else {
    strategy = "Compliant Payment Plan Offer";
    msg = `Dear ${item.customer}, Invoice ${item.case_ref} for ${formatCurrency(item.amount)} is overdue. Reply to arrange a split payment plan.`;
    recovered = item.amount * 0.5;
  }

  return {
    status: "Recovered",
    attempts: item.attempts + 1,
    recovered_amount: recovered,
    last_action: strategy,
    last_message: msg,
    stopping_rule: "None",
    escalation: "Resolved",
  };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

const emptyForm = {
  case_ref: "",
  customer: "",
  case_type: CASE_TYPES[0]!,
  amount: "",
  failure_reason: REASONS[0]!,
  attempts: "0",
  status: STATUSES[0]!,
  opt_out: false,
  preferred_lang: "English",
};

function RevRecoverPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ["recovery_cases"],
    queryFn: async (): Promise<RecoveryCase[]> => {
      const { data, error } = await supabase
        .from("recovery_cases")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        ...row,
        amount: Number(row.amount),
        recovered_amount: Number(row.recovered_amount),
      })) as RecoveryCase[];
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["recovery_cases"] });

  const addCase = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("recovery_cases").insert({
        case_ref: form.case_ref.trim(),
        customer: form.customer.trim(),
        case_type: form.case_type,
        amount: Number(form.amount || 0),
        failure_reason: form.failure_reason,
        attempts: Number(form.attempts || 0),
        status: form.status,
        opt_out: form.opt_out,
        preferred_lang: form.preferred_lang,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Case added");
      setForm(emptyForm);
      setOpen(false);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeCase = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("recovery_cases")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Case removed");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const runBatch = useMutation({
    mutationFn: async () => {
      const pending = cases.filter((item) => item.status === "Pending");
      if (pending.length === 0) return 0;
      for (const item of pending) {
        const outcome = evaluate(item);
        const { error } = await supabase
          .from("recovery_cases")
          .update({
            status: outcome.status,
            attempts: outcome.attempts,
            recovered_amount: outcome.recovered_amount,
            last_action: outcome.last_action,
            last_message: outcome.last_message,
          })
          .eq("id", item.id);
        if (error) throw error;
      }
      return pending.length;
    },
    onSuccess: (count) => {
      toast.success(
        count ? `Processed ${count} case(s)` : "No pending cases to process"
      );
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const resetCase = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("recovery_cases")
        .update({
          status: "Pending",
          recovered_amount: 0,
          last_action: null,
          last_message: null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const totalAtRisk = cases
    .filter((item) => item.status !== "Recovered")
    .reduce((sum, item) => sum + item.amount, 0);
  const totalRecovered = cases.reduce(
    (sum, item) => sum + item.recovered_amount,
    0
  );
  const escalations = cases.filter((item) => item.status === "Escalated").length;
  const processed = cases.filter((item) => item.status !== "Pending");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              💸 RevRecover AI Agent Engine
            </h1>
            <p className="mt-1 text-muted-foreground">
              Automated revenue recovery with bounded rules, escalations, and audit
              trails — backed by your live case database.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="lg" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Case
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Add recovery case</DialogTitle>
                  <DialogDescription>
                    Log an overdue invoice, failed subscription, or checkout failure.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="case_ref">Reference</Label>
                      <Input
                        id="case_ref"
                        placeholder="INV-1002"
                        value={form.case_ref}
                        onChange={(e) =>
                          setForm({ ...form, case_ref: e.target.value })
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="amount">Amount (USD)</Label>
                      <Input
                        id="amount"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="1250"
                        value={form.amount}
                        onChange={(e) =>
                          setForm({ ...form, amount: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="customer">Customer</Label>
                    <Input
                      id="customer"
                      placeholder="Acme Corp"
                      value={form.customer}
                      onChange={(e) =>
                        setForm({ ...form, customer: e.target.value })
                      }
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Case type</Label>
                    <Select
                      value={form.case_type}
                      onValueChange={(value) =>
                        setForm({ ...form, case_type: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CASE_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label>Reason</Label>
                    <Select
                      value={form.failure_reason}
                      onValueChange={(value) =>
                        setForm({ ...form, failure_reason: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {REASONS.map((reason) => (
                          <SelectItem key={reason} value={reason}>
                            {reason}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="grid gap-2">
                      <Label htmlFor="attempts">Attempts</Label>
                      <Input
                        id="attempts"
                        type="number"
                        min="0"
                        value={form.attempts}
                        onChange={(e) =>
                          setForm({ ...form, attempts: e.target.value })
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Status</Label>
                      <Select
                        value={form.status}
                        onValueChange={(value) =>
                          setForm({ ...form, status: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Language</Label>
                      <Select
                        value={form.preferred_lang}
                        onValueChange={(value) =>
                          setForm({ ...form, preferred_lang: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="English">English</SelectItem>
                          <SelectItem value="Hinglish">Hinglish</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <Label htmlFor="opt_out">Opted out / disputed</Label>
                      <p className="text-xs text-muted-foreground">
                        Stops automated outreach and escalates to a human.
                      </p>
                    </div>
                    <Switch
                      id="opt_out"
                      checked={form.opt_out}
                      onCheckedChange={(checked) =>
                        setForm({ ...form, opt_out: checked })
                      }
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    onClick={() => addCase.mutate()}
                    disabled={
                      addCase.isPending ||
                      !form.case_ref.trim() ||
                      !form.customer.trim()
                    }
                  >
                    {addCase.isPending ? "Saving..." : "Save case"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button
              onClick={() => runBatch.mutate()}
              size="lg"
              className="gap-2"
              disabled={runBatch.isPending}
            >
              <Rocket className="h-4 w-4" />
              {runBatch.isPending ? "Running..." : "Run Recovery Batch"}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Total Revenue At Risk
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalAtRisk)}</div>
              <p className="text-xs text-muted-foreground">Across open cases</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Money Recovered</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(totalRecovered)}
              </div>
              <p className="text-xs text-muted-foreground">Recorded in database</p>
            </CardContent>
          </Card>

          <Card className="sm:col-span-2 lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Stopping Rules / Escalations
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{escalations}</div>
              <p className="text-xs text-muted-foreground">
                Cases escalated to human review
              </p>
            </CardContent>
          </Card>
        </div>

        <Separator className="my-8" />

        <Tabs defaultValue="cases" className="w-full">
          <TabsList className="grid w-full grid-cols-3 sm:w-auto">
            <TabsTrigger value="cases" className="gap-2">
              <ListChecks className="h-4 w-4" />
              Cases
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-2">
              <Clock className="h-4 w-4" />
              Audit Trail
            </TabsTrigger>
            <TabsTrigger value="messages" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Messages
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cases" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Recovery cases</CardTitle>
                <CardDescription>
                  Live records: overdue invoices, subscription failures and checkout
                  failures with status, attempts and reason.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="py-8 text-center text-muted-foreground">Loading…</p>
                ) : cases.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
                    <p className="text-muted-foreground">
                      No cases yet. Use "Add Case" to log your first one.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Reference</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead className="text-center">Attempts</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cases.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">
                              {item.case_ref}
                            </TableCell>
                            <TableCell>
                              {item.customer}
                              {item.opt_out && (
                                <Badge variant="outline" className="ml-2">
                                  Opted out
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>{item.case_type}</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(item.amount)}
                            </TableCell>
                            <TableCell className="max-w-[220px]">
                              {item.failure_reason}
                            </TableCell>
                            <TableCell className="text-center">
                              {item.attempts}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  item.status === "Recovered"
                                    ? "default"
                                    : item.status === "Escalated"
                                      ? "destructive"
                                      : "secondary"
                                }
                              >
                                {item.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                {item.status !== "Pending" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => resetCase.mutate(item.id)}
                                  >
                                    Reset
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Delete ${item.case_ref}`}
                                  onClick={() => removeCase.mutate(item.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Audit Trail</CardTitle>
                <CardDescription>
                  Recovery actions, stopping rules, and escalations per case.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {processed.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
                    <p className="text-muted-foreground">
                      Run the recovery batch to generate the audit trail.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Reference</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead className="text-right">At Risk</TableHead>
                          <TableHead className="text-right">Recovered</TableHead>
                          <TableHead>Outcome</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {processed.map((item) => (
                          <TableRow key={`audit-${item.id}`}>
                            <TableCell className="font-medium">
                              {item.case_ref}
                            </TableCell>
                            <TableCell>{item.customer}</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(item.amount)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(item.recovered_amount)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  item.status === "Recovered"
                                    ? "default"
                                    : "destructive"
                                }
                              >
                                {item.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{item.last_action ?? "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="messages" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Customer Messages Log</CardTitle>
                <CardDescription>Generated recovery messages per case.</CardDescription>
              </CardHeader>
              <CardContent>
                {processed.filter((item) => item.last_message).length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
                    <p className="text-muted-foreground">
                      Run the recovery batch to generate customer messages.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {processed
                      .filter((item) => item.last_message)
                      .map((item) => (
                        <div
                          key={`msg-${item.id}`}
                          className="rounded-lg border bg-card p-4 text-card-foreground"
                        >
                          <div className="mb-2 flex items-center gap-2">
                            <span className="font-semibold">{item.case_ref}</span>
                            <span className="text-muted-foreground">•</span>
                            <span className="text-muted-foreground">
                              {item.customer}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap text-sm leading-relaxed">
                            {item.last_message}
                          </p>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
