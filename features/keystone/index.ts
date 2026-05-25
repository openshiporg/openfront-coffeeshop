import { createAuth } from "@keystone-6/auth";
import { config } from "@keystone-6/core";
import "dotenv/config";
import { models } from "./models";
import { statelessSessions } from "@keystone-6/core/session";
import { extendGraphqlSchema } from "./mutations";
import { sendPasswordResetEmail } from "./lib/mail";

const databaseURL = process.env.DATABASE_URL || "file:./keystone.db";

const sessionConfig = {
  maxAge: 60 * 60 * 24 * 360, // How long they stay signed in?
  secret:
    process.env.SESSION_SECRET || "this secret should only be used in testing",
};

const {
  S3_BUCKET_NAME: bucketName = "keystone-test",
  S3_REGION: region = "ap-southeast-2",
  S3_ACCESS_KEY_ID: accessKeyId = "keystone",
  S3_SECRET_ACCESS_KEY: secretAccessKey = "keystone",
  S3_ENDPOINT: endpoint = "https://sfo3.digitaloceanspaces.com",
} = process.env;

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
        forcePathStyle: true,
      },
    },
    ui: {
      isAccessAllowed: ({ session }) => session?.data.role?.canAccessDashboard ?? false,
    },
    session: statelessSessions(sessionConfig),
    graphql: {
      extendGraphqlSchema,
    },
  })
);