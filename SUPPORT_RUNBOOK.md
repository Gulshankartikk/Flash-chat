# Flash Chat — Support Operations & Agent Desk Runbook

**Audience**: Flash Support Agents, System Administrators, Customer Success  
**System URL**: `/support` (Customer Desk) & `/admin/support` (Agent Queue Console)  

---

## 1. Role-Based Access Control & Permissions

| Role | Access Scope | Capabilities |
|---|---|---|
| **`user`** | `/support` | Create tickets, chat with Flash Support (AI + Human), rate experience (1-5 stars). Blocked from `/admin/support` (404/403). |
| **`support`** | `/support` & `/admin/support` | View unassigned queue, assign tickets to self, reply to customers, resolve tickets, view customer diagnostics. |
| **`admin`** | Full System | All support capabilities + manage canned replies, modify FAQ seeds, view SLA metrics, manage agent accounts. |

---

## 2. Customer Privacy & Diagnostic Scope

### What Support Agents CAN See:
- User's public profile name, username, and account creation date.
- Ticket subject, category (`account`, `bug`, `feature`, `billing`, `other`), and customer description.
- Sanitized diagnostic context (app version, browser/OS platform, viewport resolution, online/offline state).
- Messages sent directly within the `#support` conversation channel.

### What Support Agents CANNOT See:
- Customer's private 1:1 or group chats.
- Customer's encrypted Pocket Vault items, notes, or master PIN.
- User passwords, auth tokens, or payment card details.
- User's private contacts list or address book.

---

## 3. Ticket Lifecycle & SLA Policy

```
[Customer Creates Ticket]
          │
          ▼
   (Flash AI First Response)
   * Instant triage, FAQ suggestions, & self-service links *
          │
     ┌────┴────────────────────────┐
     ▼                             ▼
[Resolved by AI]          [Customer Requests Agent]
     │                             │
     ▼                             ▼
(Customer 1-5★ Rating)      (Status: 'pending' -> In Agent Queue)
                                   │
                                   ▼
                            (Agent Assigned)
                                   │
                                   ▼
                            (Agent Replies)
                                   │
                                   ▼
                            (Ticket Resolved)
                                   │
                                   ▼
                            (Customer 1-5★ Rating)
```

### 3.1 Service Level Agreements (SLAs)
- **AI First-Response**: `< 3 seconds` (Instant AI triage).
- **Human Agent First-Reply**: `< 15 minutes` during operating hours.
- **Ticket Reopen Window**: Customers can reopen a resolved ticket within **7 days**. On Day 8, the ticket permanently locks and requires a new submission.

---

## 4. Agent Console Keyboard Shortcuts (`/admin/support`)

- `J`: Navigate to next ticket in queue.
- `K`: Navigate to previous ticket in queue.
- `A`: Assign active ticket to current logged-in agent.
- `E`: Mark active ticket as Resolved.
- `?`: Open shortcut reference modal.
