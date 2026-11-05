# Chat backend

Authenticated one-to-one chat API built with Node.js, TypeScript, Express, PostgreSQL, and Firebase Firestore. PostgreSQL stores users, chats, and membership. Firestore stores messages, read receipts, and per-user last-seen positions. The EJS view engine is configured for a future UI; this project currently serves JSON APIs only.

## Requirements

- Node.js 22 or newer and npm
- PostgreSQL 14 or newer
- A Firebase project with Firestore enabled
- Firebase server credentials with permission to access Firestore

## Set up locally

### 1. Install dependencies

From the project directory:

```sh
npm install
```

### 2. Create a PostgreSQL database

Create a database (for example, `cfttask`) and note the PostgreSQL username, password, host, and port. With a local server using the `postgres` role, you can create it from Terminal:

```sh
createdb -h localhost -p 5432 -U postgres cfttask
```

If the database already exists, skip this command. Apply the schema from the project directory:

```sh
psql -h localhost -p 5432 -U postgres -d cfttask \
  -f migrations/001_initial_schema.sql
```

If your role or connection settings differ, adjust `-U`, host, and port. A `psql` command must be run in Terminal, not at the `psql` prompt. If you are already in `psql` connected to the correct database, apply the schema with:

```text
\i '/absolute/path/to/codesfortomorrow/migrations/001_initial_schema.sql'
```

You can verify the tables from `psql` with `\dt`; the migration creates `users`, `chats`, and `chat_members`.

### 3. Configure Firebase credentials

In Firebase Console, select or create a project, enable Firestore, and ensure the backend service account is allowed to access Firestore.

For local development, download a service-account JSON file and store it **outside this repository**. Restrict its file permissions (on macOS/Linux, `chmod 600 /path/to/firebase-service-account.json`). Put its full path in `GOOGLE_APPLICATION_CREDENTIALS` in `.env`. Alternatively, provide the service-account JSON contents using `FIREBASE_SERVICE_ACCOUNT_JSON`. Use one method; never commit or share the credential file or its contents.

### 4. Configure environment variables

Copy the example file and edit `.env`:

```sh
cp .env.example .env
```

Set `DATABASE_URL` to match your local PostgreSQL connection. For example:

```dotenv
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/cfttask
```

Set `JWT_SECRET` to a new, private random value at least 32 characters long. On macOS/Linux, you can generate one with:

```sh
openssl rand -hex 32
```

Set `GOOGLE_APPLICATION_CREDENTIALS` to the absolute path of your Firebase service-account file, or set `FIREBASE_SERVICE_ACCOUNT_JSON` to its JSON contents. Keep `.env` private; it is excluded from Git. Do not put credentials in `.env.example`.

The other settings are optional: `PORT` defaults to `3000`, `JWT_EXPIRES_IN_SECONDS` defaults to `3600`, and `CORS_ORIGINS` is a comma-separated allowlist for browser origins. Leave `CORS_ORIGINS` empty when only testing with curl.

### 5. Start and verify the API

Start the development server:

```sh
npm run dev
```

Keep it running, then in another Terminal window verify the health endpoint:

```sh
curl http://localhost:3000/health
```

Expected response:

```json
{"status":"ok"}
```

The health endpoint confirms the HTTP server is running; it does not independently check the database or Firebase credentials. Registration exercises PostgreSQL, and sending a message exercises Firestore.

## Use the API

All chat and user endpoints require a JWT bearer token. Register two users and save each response's `user.id` and `accessToken`. Do not paste tokens or passwords into shared logs or commit them to source control.

### 1. Register users

```sh
curl -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"a-private-password-123","displayName":"Alice"}'
```

Register a second user by repeating the request with a different email, password, and display name. Passwords must be at least 12 characters. Each successful response contains:

```json
{
  "user": {
    "id": "USER_UUID",
    "email": "alice@example.com",
    "displayName": "Alice",
    "createdAt": "TIMESTAMP"
  },
  "accessToken": "JWT"
}
```

### 2. Create or get a one-to-one chat

Use Alice's token and both actual user IDs from registration:

```sh
curl -X POST http://localhost:3000/chat/create \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer ALICE_ACCESS_TOKEN' \
  -d '{"userAId":"ALICE_USER_UUID","userBId":"BOB_USER_UUID"}'
```

The response contains a `chatId`. Repeating the request for the same two users returns the existing chat.

### 3. Send a message

Use Alice's token and ID, and the returned chat ID:

```sh
curl -X POST http://localhost:3000/chat/CHAT_UUID/message/send \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer ALICE_ACCESS_TOKEN' \
  -d '{"senderId":"ALICE_USER_UUID","text":"Hello Bob!"}'
```

Save the returned message `id` for the read and last-seen requests.

### 4. Get messages

```sh
curl 'http://localhost:3000/chat/CHAT_UUID/messages?limit=50' \
  -H 'Authorization: Bearer ALICE_ACCESS_TOKEN'
```

The limit is optional (default `50`, allowed range `1` to `100`). The API returns the latest page in chronological order.

### 5. Mark the message as read

Use Bob's token and ID:

```sh
curl -X POST http://localhost:3000/chat/CHAT_UUID/message/MESSAGE_ID/read \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer BOB_ACCESS_TOKEN' \
  -d '{"userId":"BOB_USER_UUID"}'
```

Marking a message as read more than once is safe; its original read timestamp is retained.

### 6. Update last seen

```sh
curl -X POST http://localhost:3000/chat/CHAT_UUID/lastseen \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer BOB_ACCESS_TOKEN' \
  -d '{"userId":"BOB_USER_UUID","messageId":"MESSAGE_ID"}'
```

The last-seen position is stored per user and chat. Moving it to an earlier message returns `409`.

### 7. List chats and inspect the current user

```sh
curl http://localhost:3000/user/ALICE_USER_UUID/chats \
  -H 'Authorization: Bearer ALICE_ACCESS_TOKEN'
```

Get the authenticated user's profile with `GET /auth/me`, or use `GET /user/ALICE_USER_UUID` for the same user's public profile.

## Authentication and authorization

- `POST /auth/register` creates an account; duplicate emails return `409`.
- `POST /auth/login` accepts `{ "email", "password" }` and returns a user and access token.
- `GET /auth/me` returns the authenticated user's profile.
- Send tokens as `Authorization: Bearer <accessToken>`.
- Body user IDs (`userAId`, `senderId`, or `userId`) must match the token's user.
- Only chat members may access a chat's messages or update its read/last-seen state.

## API reference

| Method and path | Request | Result |
|---|---|---|
| `GET /health` | — | API liveness |
| `POST /auth/register` | `{ "email", "password", "displayName" }` | `201` with user and token |
| `POST /auth/login` | `{ "email", "password" }` | User and token |
| `GET /auth/me` | Bearer token | Authenticated user's profile |
| `POST /chat/create` | `{ "userAId", "userBId" }` | Existing or newly created `chatId` |
| `POST /chat/:chatId/message/send` | `{ "senderId", "text" }` | `201` with created message |
| `GET /chat/:chatId/messages?limit=50` | Optional limit `1`–`100` | Latest messages, chronological |
| `POST /chat/:chatId/message/:messageId/read` | `{ "userId" }` | Read receipt |
| `POST /chat/:chatId/lastseen` | `{ "userId", "messageId" }` | Updated last-seen position |
| `GET /user/:userId/chats` | Bearer token | Chats and member IDs |
| `GET /user/:userId` | Bearer token | Authenticated user's public profile |

Validation errors return `400`; unauthenticated requests return `401`; forbidden identity actions return `403`; missing resources return `404`.

## Development and production

Run the TypeScript build and tests:

```sh
npm run build
npm test
```

For a production build, run `npm run build` followed by `npm start`. Provide production environment variables and Firebase credentials through your deployment platform's secret manager or runtime service identity. Use HTTPS and a strong, private `JWT_SECRET`.

## Firestore data layout

- `chats/{chatId}/messages/{messageId}`: `senderId`, `text`, and `createdAt`
- `chats/{chatId}/messages/{messageId}/readReceipts/{userId}`: `userId` and `readAt`
- `chats/{chatId}/members/{userId}`: `lastSeenMessageId` and `lastSeenAt`

The backend accesses Firestore through Firebase Admin SDK. Configure Firestore rules to deny untrusted client writes to these server-owned collections.
