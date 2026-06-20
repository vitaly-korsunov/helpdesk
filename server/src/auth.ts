import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { Role } from "../generated/prisma/enums";
import { prisma } from "./db";

const clientUrl = process.env.CLIENT_URL;
if (!clientUrl) {
  throw new Error("CLIENT_URL must be set in the environment");
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  trustedOrigins: [clientUrl],
  rateLimit: {
    // Only throttle in production. Dev/test never set NODE_ENV=production,
    // so local dev and the e2e suite run with rate limiting fully disabled.
    enabled: process.env.NODE_ENV === "production",
    window: 10,
    max: 20,
    customRules: {
      // "/get-session" is checked on every page load/focus and isn't a
      // brute-force target, so it's exempt even when rate limiting is on.
      "/get-session": false,
    },
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    requireEmailVerification: true,
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      console.log(`[auth] verification link for ${user.email}: ${url}`);
    },
  },
  user: {
    additionalFields: {
      role: {
        type: Object.values(Role) as [string, ...string[]],
        required: false,
        defaultValue: Role.AGENT,
        input: false,
      },
    },
  },
});
