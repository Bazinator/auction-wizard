
# Auction Wizard

Auction Wizard is a CS:GO skin sniping prototype. Users could set custom filters (price, float, market name) for CS:GO Empire listings, receive matches, and (in future plans) fully automate sniping and purchasing.

## Features

- Real-time WebSocket data from CS:GO Empire
- User-defined sniper filters:
  - Item name
  - Max price
  - Float range
- Live match detection and frontend display
- Planned (not implemented): auto-bidding, auto-withdraw, multi-market price comparison

## Architecture

- **itemService.js** — connects to Empire WebSocket and stores listings
- **SniperService** — infinite loop processing user snipers against live listings
- **apiService.js** — REST API for user config, matches, snipers
- **MongoDB** — stores users, snipers, items

```mermaid
flowchart TD
  Empire[CS:GO Empire WS] --> ItemService
  ItemService --> MongoDB
  SniperService --> MongoDB
  APIService --> MongoDB
  Frontend --> APIService
```

## Tech Stack

- Frontend: React, Next.js
- Backend: Node.js, Express, Mongoose
- Database: MongoDB
- WebSocket Feed: CS:GO Empire


## Development Setup

```bash
git clone <repo-url>
cd /auction-wizard-backend && npm install
cd auction-wizard-fronted && npm install
```

Set environment variables for MongoDB and API URLs.
The MongoDB is current set to run locally, so MongoDB must be installed on the system.
Run servers:

```bash
# Backend
cd auction-wizard-backend && npm start

# Frontend
cd auction-wizard/fronted && npm start
```

Frontend runs at `http://localhost:3000`

---

## Screenshots

### Sniper Filter Setup
![frontendsniper](https://github.com/user-attachments/assets/8d46330b-f68a-4ae8-8fca-2fca23e6c4a8)

### Match Found
![frontendsnipershowingmatch](https://github.com/user-attachments/assets/8d1dd396-4ce9-433a-95a9-49d137706125)

### Project Overview
![projectoverviewflow](https://github.com/user-attachments/assets/439b27eb-ddf7-4328-b44c-84c06b7e48e7)

### Homepage
![frontendhomepage](https://github.com/user-attachments/assets/01653b46-ae1f-4da4-9d6c-3f92cbdeebca)

### Login
![frontendlogin](https://github.com/user-attachments/assets/eb18a4b6-6568-4261-a17c-47a22ace77c7)


---

## Project Status

**Archived:** Project paused to focus on smaller, more manageable builds before returning to full automation.

---

_Michael Bazett — 2025_
```

---
