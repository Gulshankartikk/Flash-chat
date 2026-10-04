# Flash Chat - Load, Concurrency & Scalability Suite (10-3c)

## Overview
High-concurrency benchmark and stress-testing suite for Flash Chat MERN super-app.

### Components
1. **Data Seeder (`loadtest/seed/seedData.js`)**:
   - Generates 1,000 Users, 5,000 Posts, 3,000 Conversations, 200,000 Messages, 20,000 Notifications, 5,000 Pocket items.
   - Refuses to run if `NODE_ENV === 'production'`.
   - Run: `node loadtest/seed/seedData.js [--reset]`

2. **HTTP Load Scenarios (`loadtest/httpLoadTest.js`)**:
   - **Read Mix (200 VUs)**: Target p95 < 400ms, Errors < 1%.
   - **Write Mix (100 VUs)**: Target p95 < 600ms, Errors < 1%.
   - **Ramp & Knee Test**: Analyzes saturation point.
   - **Spike Recovery**: 50 -> 400 VUs spike absorption.
   - **Race Conditions**: Atomic likes, deduplicated direct chats, PIN lockout.
   - Run: `node loadtest/httpLoadTest.js`
