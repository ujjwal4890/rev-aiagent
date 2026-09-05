import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime
import random

st.set_page_config(page_title="RevRecover AI", page_icon="💸", layout="wide")
st.title("💸 RevRecover AI Agent Engine")
st.caption("Track 03: Automated Revenue Recovery with Bounded Rules, Escalations, and Audit Trails")

def get_initial_batch():
    return [
        {"id": "INV-1001", "customer": "Acme Corp (B2B)", "type": "Overdue Receivable", "amount": 12500.00, "failure_reason": "Invoice Overdue 45 Days", "attempts": 2, "opt_out": False, "preferred_lang": "English", "status": "Pending"},
        {"id": "SUB-2042", "customer": "Rahul Sharma", "type": "Failed Subscription", "amount": 49.00, "failure_reason": "Card Declined (Insufficient Funds)", "attempts": 1, "opt_out": False, "preferred_lang": "Hinglish", "status": "Pending"},
        {"id": "CHK-9081", "customer": "Priya Verma", "type": "Checkout Abandonment", "amount": 320.00, "failure_reason": "Payment Gateway Timeout", "attempts": 0, "opt_out": False, "preferred_lang": "Hinglish", "status": "Pending"},
        {"id": "SUB-3099", "customer": "TechStart Inc", "type": "Failed Subscription", "amount": 1200.00, "failure_reason": "Expired Credit Card", "attempts": 3, "opt_out": False, "preferred_lang": "English", "status": "Pending"},
        {"id": "INV-1088", "customer": "Global Logistics LLC", "type": "Overdue Receivable", "amount": 8500.00, "failure_reason": "Disputed Invoice / Legal Notice Requested", "attempts": 1, "opt_out": True, "preferred_lang": "English", "status": "Pending"}
    ]

if "batch" not in st.session_state:
    st.session_state.batch = get_initial_batch()
if "audit_trail" not in st.session_state:
    st.session_state.audit_trail = []

MAX_ATTEMPTS = 3

def evaluate_and_recover(item):
    audit_entry = {
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "case_id": item["id"],
        "customer": item["customer"],
        "amount_at_risk": item["amount"],
        "action_taken": "",
        "recovered_amount": 0.0,
        "stopping_rule_triggered": "None",
        "escalation_status": "Automated",
        "message_generated": ""
    }

    if item["opt_out"]:
        audit_entry["stopping_rule_triggered"] = "STOP: Customer Opted Out / Dispute Raised"
        audit_entry["escalation_status"] = "ESCALATED TO HUMAN LEGAL"
        audit_entry["action_taken"] = "Halted automated reach-out; flagged for compliance review."
        item["status"] = "Escalated"
        return item, audit_entry

    if item["attempts"] >= MAX_ATTEMPTS:
        audit_entry["stopping_rule_triggered"] = f"STOP: Max Attempts Limit ({MAX_ATTEMPTS}) Reached"
        audit_entry["escalation_status"] = "ESCALATED TO ACCOUNT MANAGER"
        audit_entry["action_taken"] = "Transferred to manual outreach team."
        item["status"] = "Escalated"
        return item, audit_entry

    reason, lang = item["failure_reason"], item["preferred_lang"]

    if "Insufficient Funds" in reason:
        strategy = "Smart Retries + Soft SMS"
        msg = f"Hey {item['customer'].split()[0]}! Your subscription retry failed. Subah try karein? https://pay.link/{item['id']}" if lang == "Hinglish" else f"Hi {item['customer']}, update payment here: https://pay.link/{item['id']}"
        recovered = item["amount"]
    elif "Expired Credit Card" in reason:
        strategy = "1-Click Card Update Link"
        msg = f"Dear {item['customer']}, your card expired. Update here: https://pay.link/update/{item['id']}"
        recovered = item["amount"]
    elif "Payment Gateway Timeout" in reason:
        strategy = "Immediate Auto-Retry Sequencer"
        msg = f"Hi {item['customer']}, checkout failed due to a glitch. Finish here: https://checkout.link/{item['id']}"
        recovered = item["amount"]
    else:
        strategy = "Compliant Payment Plan Offer"
        msg = f"Dear {item['customer']}, Invoice {item['id']} for ${item['amount']} is overdue. Reply to arrange a split payment plan."
        recovered = item["amount"] * 0.5

    item["attempts"] += 1
    audit_entry["action_taken"] = strategy
    audit_entry["message_generated"] = msg
    audit_entry["recovered_amount"] = recovered
    item["status"] = "Recovered"
    audit_entry["escalation_status"] = "Resolved"

    return item, audit_entry

st.sidebar.header("⚙️ Agent Controls")
if st.sidebar.button("🚀 Run Recovery Agent Batch Loop", type="primary"):
    st.session_state.audit_trail = []
    updated_batch = []
    for case in st.session_state.batch:
        updated_item, audit = evaluate_and_recover(case)
        updated_batch.append(updated_item)
        st.session_state.audit_trail.append(audit)
    st.session_state.batch = updated_batch

df_audit = pd.DataFrame(st.session_state.audit_trail) if st.session_state.audit_trail else pd.DataFrame()
total_at_risk = sum([item["amount"] for item in st.session_state.batch])
total_recovered = df_audit["recovered_amount"].sum() if not df_audit.empty else 0.0

c1, c2, c3 = st.columns(3)
c1.metric("Total Revenue At Risk", f"${total_at_risk:,.2f}")
c2.metric("Money Recovered", f"${total_recovered:,.2f}")
c3.metric("Stopping Rules / Escalations", len(df_audit[df_audit["stopping_rule_triggered"] != "None"]) if not df_audit.empty else 0)

st.divider()
tab1, tab2 = st.tabs(["📊 Audit Trail & Escalations", "📜 Customer Messages Log"])
with tab1:
    if not df_audit.empty:
        st.dataframe(df_audit[["case_id", "customer", "amount_at_risk", "recovered_amount", "stopping_rule_triggered", "escalation_status", "action_taken"]], use_container_width=True)
    else:
        st.info("Click 'Run Recovery Agent Batch Loop' in sidebar to execute.")
with tab2:
    if not df_audit.empty:
        for idx, row in df_audit.iterrows():
            if row["message_generated"]:
                st.code(f"Case: {row['case_id']}\nMessage: {row['message_generated']}", language="text")
