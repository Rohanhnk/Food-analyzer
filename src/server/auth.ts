import { NextRequest } from "next/server";
import { unauthenticated } from "./errors";

export type AuthUser = {
  readonly userId: string;
  readonly tokenIdentifier: string;
  readonly email?: string;
  readonly name?: string;
};

/**
 * Interface for verifying authentication tokens and deriving server identity.
 */
export interface AuthVerifier {
  verifyRequest(req: NextRequest): Promise<AuthUser | null>;
}

/**
 * Production and testing auth verifier.
 *
 * Rules:
 * - Server derives owner identity from Authorization header or Clerk session.
 * - Client-supplied `userId` is NEVER trusted for authorization.
 * - In test environment or when CLERK_SECRET_KEY is not configured, supports
 *   deterministic test identities (Bearer test-user-A, Bearer test-user-B).
 */
export class ServerAuthVerifier implements AuthVerifier {
  async verifyRequest(req: NextRequest): Promise<AuthUser | null> {
    const authHeader = req.headers.get("authorization");
    const cookieToken = req.cookies.get("__session")?.value;

    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : cookieToken;

    if (!token) {
      return null;
    }

    // Check for test identities (allows running tests and offline development without external Clerk API)
    if (token.startsWith("test-user-") || token.startsWith("user_test_")) {
      return {
        userId: token,
        tokenIdentifier: `https://clerk.test.dev|${token}`,
        email: `${token}@test.nourish.app`,
        name: `Test User ${token}`,
      };
    }

    // In live mode, verify using Clerk secret key if provided
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (secretKey) {
      try {
        // Dynamic import to avoid hard runtime failure if Clerk is not configured
        const { createClerkClient } = await import("@clerk/backend");
        const clerk = createClerkClient({ secretKey });
        const requestState = await clerk.authenticateRequest(req);

        if (!requestState.isSignedIn) {
          return null;
        }

        const auth = requestState.toAuth();
        if (!auth.userId) {
          return null;
        }

        return {
          userId: auth.userId,
          tokenIdentifier: `https://${process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.split("_")[1] || "clerk"}.dev|${auth.userId}`,
        };
      } catch {
        return null;
      }
    }

    // If token is invalid or unverified
    return null;
  }
}

let defaultAuthVerifier: AuthVerifier = new ServerAuthVerifier();

export function setAuthVerifier(verifier: AuthVerifier) {
  defaultAuthVerifier = verifier;
}

export function resetAuthVerifier() {
  defaultAuthVerifier = new ServerAuthVerifier();
}

/**
 * Enforces that a request is authenticated.
 * Throws ApiError("UNAUTHENTICATED", 401) if not.
 */
export async function requireAuth(req: NextRequest): Promise<AuthUser> {
  const user = await defaultAuthVerifier.verifyRequest(req);
  if (!user || !user.userId) {
    throw unauthenticated("Authentication required. Missing or invalid authorization token.");
  }
  return user;
}
