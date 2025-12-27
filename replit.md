# BTC Price Relay - Nostr Price Oracle

## Overview

A real-time Bitcoin price oracle built on the Nostr protocol. The application aggregates BTC prices from multiple exchanges (Coinbase, Kraken, CoinGecko, Bitstamp) and serves them through a Nostr relay. Users can query prices using local keypairs or NIP-07 wallet extensions.

This is a full-stack TypeScript application with a React frontend and Express backend that implements a custom Nostr relay for price data.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite with custom configuration for Replit environment
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack Query for server state, React hooks for local state
- **UI Components**: shadcn/ui built on Radix primitives with Tailwind CSS
- **Design System**: Material Design 3 principles with developer-focused customization (Inter + JetBrains Mono fonts)
- **Theming**: Dark/light mode support with CSS variables

### Backend Architecture
- **Runtime**: Node.js with Express
- **WebSocket Server**: Native `ws` library for Nostr relay functionality
- **Protocol**: Custom Nostr relay implementation handling price request/response events
- **Cryptography**: nostr-tools library for event signing, verification, and key generation

### Nostr Protocol Implementation
- Custom event kinds for price requests (KIND_PRICE_REQ), responses (KIND_PRICE_RES), and errors (KIND_PRICE_ERR)
- Event validation with signature verification using secp256k1
- Rate limiting per IP and pubkey with configurable burst limits
- In-memory event storage with configurable limits

### Data Flow
1. Client creates signed Nostr event requesting BTC price
2. WebSocket sends event to relay
3. Relay fetches prices from multiple exchange APIs
4. Prices aggregated using configurable methods (trimmed_mean, median, mean)
5. Response event signed by relay and sent back to client

### Build System
- Development: Vite dev server with HMR
- Production: Vite builds frontend, esbuild bundles server with selected dependencies
- TypeScript path aliases: `@/` for client, `@shared/` for shared code

## External Dependencies

### Database
- **PostgreSQL**: Configured via Drizzle ORM with schema in `shared/schema.ts`
- **Drizzle Kit**: Database migrations in `./migrations` directory
- Connection via `DATABASE_URL` environment variable

### Price Data Sources
- Coinbase API
- Kraken API
- CoinGecko API
- Bitstamp API

### Key Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `RELAY_PRIVKEY_HEX`: Relay's Nostr private key for signing responses
- `RELAY_PUBKEY_HEX`: Relay's Nostr public key
- `MIN_QUORUM`: Minimum number of price sources required (default: 3)
- `FETCH_TIMEOUT_MS`: API fetch timeout (default: 2500)
- `CACHE_TTL_MS`: Price cache duration (default: 2000)

### Third-Party Libraries
- **nostr-tools**: Client-side Nostr event creation and signing
- **@noble/secp256k1**: Cryptographic operations for Nostr
- **zod**: Schema validation for events and API responses
- **wouter**: Client-side routing
- **@tanstack/react-query**: Data fetching and caching
- **shadcn/ui + Radix**: UI component library