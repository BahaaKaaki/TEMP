# Enterprise Architecture Plan for Slide Generator

## Overview

Transform the slide generator from a single-user frontend-only app to an enterprise-ready multi-tenant SaaS platform.

## Current State

| Aspect | Current State |
|--------|---------------|
| **Architecture** | Pure frontend React SPA (Vite) |
| **Backend** | None |
| **Database** | Browser localStorage only |
| **Authentication** | None |
| **State Management** | React Context + useReducer (`SlideContext.jsx`) |
| **Templates** | Hardcoded in `slideTemplates.js`, custom templates in localStorage |
| **AI Integration** | Direct API calls from frontend (API keys in localStorage) |
| **File Storage** | None (exports download directly) |

## Target Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PRESENTATION TIER                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                    React SPA (Existing Frontend)                        │ │
│  │    SlideContext.jsx → API Client Layer → Authentication Provider        │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                              HTTPS / WebSocket
                                      │
┌─────────────────────────────────────────────────────────────────────────────┐
│                               API GATEWAY                                    │
│              (Rate Limiting, Auth Token Validation, Logging)                │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
┌─────────────────────────────────────────────────────────────────────────────┐
│                            APPLICATION TIER                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │  Auth        │  │  User/Org    │  │  Template    │  │  Deck            │ │
│  │  Service     │  │  Service     │  │  Service     │  │  Service         │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────────┘ │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │  AI Proxy    │  │  Export      │  │  Asset       │  │  Audit           │ │
│  │  Service     │  │  Service     │  │  Service     │  │  Service         │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA TIER                                       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────────────┐ │
│  │   PostgreSQL     │  │   Redis          │  │   S3/MinIO                 │ │
│  │   (Primary DB)   │  │   (Cache/Queue)  │  │   (Asset Storage)          │ │
│  └──────────────────┘  └──────────────────┘  └────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Technology Stack

| Layer | Technology | Justification |
|-------|------------|---------------|
| **Backend** | Node.js (Express) | Same language as frontend, rich ecosystem |
| **Database** | PostgreSQL | ACID compliance, JSON support, multi-tenant |
| **Cache** | Redis | Sessions, real-time pub/sub, rate limiting |
| **Object Storage** | S3/MinIO | Brand assets, exports, thumbnails |
| **Authentication** | JWT + Refresh Tokens | Stateless, scalable, SSO-ready |
| **API Design** | REST with OpenAPI | Simple, well-tooled, easy to secure |

## Implementation Phases

### Phase 1: Foundation (Current)
- [x] Backend project setup
- [ ] PostgreSQL database & schema
- [ ] JWT authentication system
- [ ] User registration/login
- [ ] Frontend auth integration

### Phase 2: Multi-Tenancy & Core Data
- [ ] Organizations & teams
- [ ] Deck persistence
- [ ] Slide CRUD APIs
- [ ] Role-based permissions

### Phase 3: Template Management
- [ ] Per-org templates
- [ ] Template versioning
- [ ] Category management
- [ ] System templates seeding

### Phase 4: AI & Security
- [ ] AI proxy service
- [ ] API key encryption
- [ ] Audit logging
- [ ] Usage tracking

### Phase 5: Collaboration
- [ ] Comments system
- [ ] Real-time presence
- [ ] Notifications

### Phase 6: Enterprise Features
- [ ] SSO (SAML/OIDC)
- [ ] Admin dashboard
- [ ] Analytics
- [ ] Brand assets

## Key Principles

1. **Gradual Migration**: Existing localStorage functionality continues to work
2. **Fallback Support**: App works offline with localStorage
3. **Non-Breaking**: Current users aren't disrupted
4. **Security First**: API keys move server-side immediately
