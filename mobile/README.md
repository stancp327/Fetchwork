# Fetchwork Mobile

React Native app (Expo) for the Fetchwork freelance marketplace.

## Setup

```bash
cd mobile
npm install
cp .env.example .env   # fill in your values
npx expo start
```

## Environment Variables

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_API_URL` | Backend API URL (default: http://localhost:5000 for dev) |
| `EXPO_PUBLIC_STRIPE_PK` | Stripe publishable key |
| `EAS_PROJECT_ID` | Your EAS project ID from expo.dev |

## Dev Workflow

```bash
# Start dev server
npx expo start

# Run on iOS simulator
npx expo start --ios

# Run on Android emulator
npx expo start --android

# Run tests
npm test
```

## EAS Build (Distribution)

```bash
# Install EAS CLI
npm install -g eas-cli
eas login

# Build for internal testing (preview)
eas build --platform all --profile preview

# Build for production
eas build --platform all --profile production

# Submit to App Store / Play Store
eas submit --platform all
```

## Architecture

```
src/
  api/          # Axios client, Socket.io, typed endpoint modules
  components/   # Shared UI (Button, Card, Input, Avatar, Badge, TrustBadge)
  context/      # AuthContext, QueryContext
  navigation/   # React Navigation tree (Root → Auth + Main tabs + stacks)
  screens/      # All screens grouped by feature
  store/        # Zustand auth store
  theme/        # colors, typography, spacing (mirrors web CSS variables)
  types/        # TypeScript navigation param lists
  utils/        # storage (SecureStore), deviceId, formatters
```

## Key Dependencies

| Dep | Purpose |
|---|---|
| `expo` | Managed workflow, EAS Build |
| `@react-navigation/*` | Navigation (native stack + bottom tabs) |
| `@tanstack/react-query` | Data fetching, caching, infinite scroll |
| `zustand` | Auth store (lightweight, no boilerplate) |
| `react-hook-form` + `zod` | Forms + validation |
| `@stripe/stripe-react-native` | Payment Sheet, Connect |
| `socket.io-client` | Real-time messaging |
| `expo-secure-store` | JWT token storage |
| `expo-notifications` | Push notifications (Expo push service) |
| `expo-auth-session` | Google OAuth |

## Connecting to Local Server

When running on a physical device, replace `localhost` with your machine's LAN IP:

```
EXPO_PUBLIC_API_URL=http://192.168.1.100:5000
```

Or use `npx expo start --tunnel` and update the URL accordingly.
