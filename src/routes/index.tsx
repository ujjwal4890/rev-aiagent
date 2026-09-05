import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
import { Rocket, AlertTriangle, CheckCircle, Clock, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RevRecover AI — Bounded Revenue Recovery Engine" },
      {
        name: "description",
        content:
          "Autonomous AI revenue recovery agent with bounded rules, escalations, and audit trails.",
      },
      {
        property: "og:title",
        content: "RevRecover AI — Bounded Revenue Recovery Engine",
      },
      {
        property: "og:description",
        content:
          "Autonomous AI revenue recovery agent with bounded rules, escalations, and audit trails.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RevRecoverPage,
});

type RecoveryCase = {
  id: string;
  customer: string;
  type: string;
  amount: number;
  failure_reason: string;
  attempts: number;
  opt_out: boolean;
  preferred_lang: string;
  status: string;
};

type AuditEntry = {
  timestamp: string;
  case_id: string;
  customer: string;
  amount_at_risk: number;
  action_taken: string;
  recovered_amount: number;
  stopping_rule_triggered: string;
  escalation_status: string;
  message_generated: string;
};

const MAX_ATTEMPTS = 3;

function getInitialBatch(): RecoveryCase[] {
  return [
    {
      id: "INV-1001",
      customer: "Acme Corp (B2B)",
      type: "Overdue Receivable",
      amount: 12500.0,
      failure_reason: "Invoice Overdue 45 Days",
      attempts: 2,
      opt_out: false,
      preferred_lang: "English",
      status: "Pending",
    },
    {
      id: "SUB-2042",
      customer: "Rahul Sharma",
      type: "Failed Subscription",
      amount: 49.0,
      failure_reason: "Card Declined (Insufficient Funds)",
      attempts: 1,
      opt_out: false,
      preferred_lang: "Hinglish",
      status: "Pending",
    },
    {
      id: "CHK-9081",
      customer: "Priya Verma",
      type: "Checkout Abandonment",
      amount: 320.0,
      failure_reason: "Payment Gateway Timeout",
      attempts: 0,
      opt_out: false,
      preferred_lang: "Hinglish",
      status: "Pending",
    },
    {
      id: "SUB-3099",
      customer: "TechStart Inc",
      type: "Failed Subscription",
      amount: 1200.0,
      failure_reason: "Expired Credit Card",
      attempts: 3,
      opt_out: false,
      preferred_lang: "English",
      status: "Pending",
    },
    {
      id: "INV-1088",
      customer: "Global Logistics LLC",
      type: "Overdue Receivable",
      amount: 8500.0,
      failure_reason: "Disputed Invoice / Legal Notice Requested",
      attempts: 1,
      opt_out: true,
      preferred_lang: "English",
      status: "Pending",
    },
  ];
}

function evaluateAndRecover(item: RecoveryCase): {
  updated: RecoveryCase;
  audit: AuditEntry;
} {
  const auditEntry: AuditEntry = {
    timestamp: new Date().toLocaleString(),
    case_id: item.id,
    customer: item.customer,
    amount_at_risk: item.amount,
    action_taken: "",
    recovered_amount: 0.0,
    stopping_rule_triggered: "None",
    escalation_status: "Automated",
    message_generated: "",
  };

  if (item.opt_out) {
    auditEntry.stopping_rule_triggered = "STOP: Customer Opted Out / Dispute Raised";
    auditEntry.escalation_status = "ESCALATED TO HUMAN LEGAL";
    auditEntry.action_taken = "Halted automated reach-out; flagged for compliance review.";
    item.status = "Escalated";
    return { updated: item, audit: auditEntry };
  }

  if (item.attempts >= MAX_ATTEMPTS) {
    auditEntry.stopping_rule_triggered = `STOP: Max Attempts Limit (${MAX_ATTEMPTS}) Reached`;
    auditEntry.escalation_status = "ESCALATED TO ACCOUNT MANAGER";
    auditEntry.action_taken = "Transferred to manual outreach team.";
    item.status = "Escalated";
    return { updated: item, audit: auditEntry };
  }

  const reason = item.failure_reason;
  const lang = item.preferred_lang;
  let strategy = "";
  let msg = "";
  let recovered = 0.0;

  if (reason.includes("Insufficient Funds")) {
    strategy = "Smart Retries + Soft SMS";
    msg =
      lang === "Hinglish"
        ? `Hey ${item.customer.split(" ")[0]}! Your subscription retry failed. Subah try karein? https://pay.link/${item.id}`
        : `Hi ${item.customer}, update payment here: https://pay.link/${item.id}`;
    recovered = item.amount;
  } else if (reason.includes("Expired Credit Card")) {
    strategy = "1-Click Card Update Link";
    msg = `Dear ${item.customer}, your card expired. Update here: https://pay.link/update/${item.id}`;
    recovered = item.amount;
  } else if (reason.includes("Payment Gateway Timeout")) {
    strategy = "Immediate Auto-Retry Sequencer";
    msg = `Hi ${item.customer}, checkout failed due to a glitch. Finish here: https://checkout.link/${item.id}`;
    recovered = item.amount;
  } else {
    strategy = "Compliant Payment Plan Offer";
    msg = `Dear ${item.customer}, Invoice ${item.id} for $${item.amount} is overdue. Reply to arrange a split payment plan.`;
    recovered = item.amount * 0.5;
  }

  item.attempts += 1;
  auditEntry.action_taken = strategy;
  auditEntry.message_generated = msg;
  auditEntry.recovered_amount = recovered;
  item.status = "Recovered";
  auditEntry.escalation_status = "Resolved";

  return { updated: item, audit: auditEntry };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function RevRecoverPage() {
  const [batch, setBatch] = useState<RecoveryCase[]>(getInitialBatch);
  const [auditTrail, setAuditTrail] = useState<AuditEntry[]>([]);

  function runBatch() {
    const updatedBatch: RecoveryCase[] = [];
    const trail: AuditEntry[] = [];

    for (const caseItem of batch) {
      const { updated, audit } = evaluateAndRecover({ ...caseItem });
      updatedBatch.push(updated);
      trail.push(audit);
    }

    setBatch(updatedBatch);
    setAuditTrail(trail);
  }

  const totalAtRisk = batch.reduce((sum, item) => sum + item.amount, 0);
  const totalRecovered = auditTrail.reduce(
    (sum, entry) => sum + entry.recovered_amount,
    0
  );
  const escalations = auditTrail.filter(
    (entry) => entry.stopping_rule_triggered !== "None"
  ).length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              💸 RevRecover AI Agent Engine
            </h1>
            <p className="mt-1 text-muted-foreground">
              Track 03: Automated Revenue Recovery with Bounded Rules, Escalations,
              and Audit Trails
            </p>
          </div>
          <Button onClick={runBatch} size="lg" className="gap-2">
            <Rocket className="h-4 w-4" />
            Run Recovery Batch
          </Button>
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
              <p className="text-xs text-muted-foreground">Across all open cases</p>
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
              <p className="text-xs text-muted-foreground">
                From last batch execution
              </p>
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

        <Tabs defaultValue="audit" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:w-auto">
            <TabsTrigger value="audit" className="gap-2">
              <Clock className="h-4 w-4" />
              Audit Trail & Escalations
            </TabsTrigger>
            <TabsTrigger value="messages" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Customer Messages Log
            </TabsTrigger>
          </TabsList>

          <TabsContent value="audit" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Audit Trail</CardTitle>
                <CardDescription>
                  Full record of recovery actions, stopping rules, and escalations.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {auditTrail.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
                    <p className="text-muted-foreground">
                      Click "Run Recovery Batch" to execute the agent and generate the
                      audit trail.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Case ID</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead className="text-right">At Risk</TableHead>
                          <TableHead className="text-right">Recovered</TableHead>
                          <TableHead>Stopping Rule</TableHead>
                          <TableHead>Escalation</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditTrail.map((entry) => (
                          <TableRow key={entry.case_id}>
                            <TableCell className="font-medium">{entry.case_id}</TableCell>
                            <TableCell>{entry.customer}</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(entry.amount_at_risk)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(entry.recovered_amount)}
                            </TableCell>
                            <TableCell>
                              {entry.stopping_rule_triggered === "None" ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                                <Badge variant="destructive">
                                  {entry.stopping_rule_triggered}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  entry.escalation_status === "Resolved"
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {entry.escalation_status}
                              </Badge>
                            </TableCell>
                            <TableCell>{entry.action_taken}</TableCell>
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
                <CardDescription>
                  Generated recovery messages per case.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {auditTrail.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
                    <p className="text-muted-foreground">
                      Click "Run Recovery Batch" to generate customer messages.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {auditTrail
                      .filter((entry) => entry.message_generated)
                      .map((entry) => (
                        <div
                          key={`msg-${entry.case_id}`}
                          className="rounded-lg border bg-card p-4 text-card-foreground"
                        >
                          <div className="mb-2 flex items-center gap-2">
                            <span className="font-semibold">{entry.case_id}</span>
                            <span className="text-muted-foreground">•</span>
                            <span className="text-muted-foreground">
                              {entry.customer}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap text-sm leading-relaxed">
                            {entry.message_generated}
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
