import { createAuth } from "@keystone-6/auth";
import { config } from "@keystone-6/core";
import "dotenv/config";
import { models } from "./models";
import { revocableStatelessSessions } from "./revocableSession";
import { extendGraphqlSchema } from "./mutations";
import { sendPasswordResetEmail } from "./lib/mail";
import { s3ForcePathStyle } from "./lib/s3-storage";

// As in E-commerce: no built-in database or session secret in any environment.
const databaseURL = process.env.DATABASE_URL;
if (!databaseURL) {
  throw new Error("DATABASE_URL is required");
}
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error("SESSION_SECRET must be at least 32 characters long");
}

const sessionConfig = {
  maxAge: 60 * 60 * 24 * 30,
  secret: sessionSecret,
};

// As in E-commerce: placeholder storage only outside production.
function productionEnv(name: string, developmentFallback: string): string {
  if (process.env[name]) return process.env[name]!;
  if (process.env.NODE_ENV === "production") {
    throw new Error(`${name} is required in production`);
  }
  return developmentFallback;
}

const bucketName = productionEnv("S3_BUCKET_NAME", "keystone-test");
const region = productionEnv("S3_REGION", "ap-southeast-2");
const accessKeyId = productionEnv("S3_ACCESS_KEY_ID", "keystone");
const secretAccessKey = productionEnv("S3_SECRET_ACCESS_KEY", "keystone");
const endpoint = productionEnv("S3_ENDPOINT", "https://sfo3.digitaloceanspaces.com");


const { withAuth } = createAuth({
  listKey: "User",
  identityField: "email",
  secretField: "password",
  initFirstItem: {
    fields: ["name", "email", "password"],
    itemData: {
      onboardingStatus: "not_started",
      role: {
        create: {
          name: "Admin",
          canAccessDashboard: true,
          canReadOrders: true,
          canManageOrders: true,
          canReadPayments: true,
          canManagePayments: true,
          canReadProducts: true,
          canManageProducts: true,
          canReadInventory: true,
          canManageInventory: true,
          canReadLoyalty: true,
          canManageLoyalty: true,
          canSeeOtherPeople: true,
          canEditOtherPeople: true,
          canManagePeople: true,
          canManageRoles: true,
          canManageSettings: true,
          canManageOnboarding: true,
        },
      },
    },
  },
  passwordResetLink: {
    async sendToken(args) {
      // send the email
      await sendPasswordResetEmail(args.token, args.identity);
    },
  },
  sessionData: `
    name
    email
    onboardingStatus
    role {
      id
      name
      canAccessDashboard
      canReadOrders
      canManageOrders
      canReadPayments
      canManagePayments
      canReadProducts
      canManageProducts
      canReadInventory
      canManageInventory
      canReadLoyalty
      canManageLoyalty
      canSeeOtherPeople
      canEditOtherPeople
      canManagePeople
      canManageRoles
      canManageSettings
      canManageOnboarding
    }
  `,
});

export default withAuth(
  config({
    db: {
      provider: "postgresql",
      url: databaseURL,
      extendPrismaSchema: (schema) => `${schema}\n\nmodel GraphQLRateLimitBucket {\n  bucketKey   String\n  windowStart DateTime @postgresql.Timestamptz\n  requestCount Int @default(0)\n  costUnits    Int @default(0)\n  expiresAt    DateTime @postgresql.Timestamptz\n\n  @@id([bucketKey, windowStart])\n  @@index([expiresAt])\n}\n`,
    },
    lists: models,
    storage: {
      my_images: {
        kind: "s3",
        type: "image",
        bucketName,
        region,
        accessKeyId,
        secretAccessKey,
        endpoint,
        signed: { expiry: 5000 },
        forcePathStyle: s3ForcePathStyle(endpoint),
      },
    },
    ui: {
      isAccessAllowed: ({ session }) => session?.data.role?.canAccessDashboard ?? false,
    },
    session: revocableStatelessSessions(sessionConfig),
    graphql: {
      extendGraphqlSchema,
    },
  })
);