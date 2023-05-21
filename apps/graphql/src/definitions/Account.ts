import { GraphQLError } from "graphql";
import gqlTag from "graphql-tag";
import type { PartialModelObject } from "objection";

import { Account, Project, Purchase, User } from "@argos-ci/database/models";
import {
  getCustomerSubscriptionOrThrow,
  terminateStripeTrial,
  timestampToDate,
} from "@argos-ci/stripe";

import type {
  IPurchaseStatus,
  IResolvers,
} from "../__generated__/resolver-types.js";
import { IPermission } from "../__generated__/resolver-types.js";
import type { Context } from "../context.js";
import { paginateResult } from "./PageInfo.js";

// eslint-disable-next-line import/no-named-as-default-member
const { gql } = gqlTag;

export const typeDefs = gql`
  type AccountAvatar {
    url(size: Int!): String
    initial: String!
    color: String!
  }

  enum PurchaseStatus {
    "Returned on personal account"
    none

    "Active purchase"
    active
    "Active purchase. A forced plan is set"
    forced
    "Active purchase. Trial in progress: the subscription will start at the end of period"
    trial
    "Active purchase. Trial in progress: the subscription will end at the end of period"
    trialCanceled
    "Active purchase. Missing payment method: the subscription will end at the end of period"
    paymentMethodMissing

    "No active purchase."
    missing
    "No active purchase: the trial has ended"
    trialExpired
    "No active purchase: the subscription has been canceled"
    canceled
  }

  interface Account implements Node {
    id: ID!
    stripeCustomerId: String
    stripeClientReferenceId: String!
    hasUsageBasedPlan: Boolean!
    hasPaidPlan: Boolean!
    consumptionRatio: Float
    currentMonthUsedScreenshots: Int!
    screenshotsLimitPerMonth: Int
    slug: String!
    name: String
    plan: Plan
    periodStartDate: DateTime
    periodEndDate: DateTime
    purchase: Purchase
    purchaseStatus: PurchaseStatus!
    oldPaidPurchase: Purchase
    permissions: [Permission!]!
    projects(after: Int!, first: Int!): ProjectConnection!
    ghAccount: GithubAccount
    avatar: AccountAvatar!
  }

  input UpdateAccountInput {
    id: ID!
    name: String
    slug: String
  }

  extend type Query {
    "Get Account by slug"
    account(slug: String!): Account
    "Get Account by id"
    accountById(id: ID!): Account
    "Get Team by id"
    teamById(id: ID!): Team
  }

  extend type Mutation {
    "Update Account"
    updateAccount(input: UpdateAccountInput!): Account!
    "Terminate trial early"
    terminateTrial(accountId: ID!): Account!
  }
`;

const colors = [
  "#2a3b4c",
  "#10418e",
  "#4527a0",
  "#8ca1ee",
  "#65b7d7",
  "#65b793",
  "#00796b",
  "#9c1258",
  "#c20006",
  "#ff3d44",
  "#ffb83d",
  "#f58f00",
];

const getAvatarColor = (id: string): string => {
  const randomIndex = Number(id) % colors.length;
  return colors[randomIndex] ?? colors[0] ?? "#000";
};

export const getWritableAccount = async (args: {
  id: string;
  user: User | undefined | null;
}): Promise<Account> => {
  if (!args.user) {
    throw new Error("Unauthorized");
  }
  const account = await Account.query().findById(args.id).throwIfNotFound();
  const hasWritePermission = await account.$checkWritePermission(args.user);
  if (!hasWritePermission) {
    throw new Error("Unauthorized");
  }
  return account;
};

const RESERVED_SLUGS = [
  "auth",
  "checkout-success",
  "login",
  "vercel",
  "invite",
  "teams",
];

const accountById = async (
  _root: unknown,
  args: { id: string },
  ctx: Context
) => {
  if (!ctx.auth) return null;
  const account = await Account.query().findById(args.id);
  if (!account) return null;
  const hasReadPermission = await account.$checkReadPermission(ctx.auth.user);
  if (!hasReadPermission) return null;
  return account;
};

export const resolvers: IResolvers = {
  Account: {
    __resolveType: (account) => {
      switch (account.type) {
        case "team":
          return "Team";
        case "user":
          return "User";
        default:
          throw new Error(`Unknown account type: ${account.type}`);
      }
    },
    stripeClientReferenceId: (account, _args, ctx) => {
      if (!ctx.auth) {
        throw new Error("Unauthorized");
      }
      return Purchase.encodeStripeClientReferenceId({
        accountId: account.id,
        purchaserId: ctx.auth.user.id,
      });
    },
    projects: async (account, args) => {
      const result = await Project.query()
        .where("accountId", account.id)
        .range(args.after, args.after + args.first - 1);
      return paginateResult({
        after: args.after,
        first: args.first,
        result,
      });
    },
    hasUsageBasedPlan: async (account) => {
      return account.$hasUsageBasedPlan();
    },
    hasPaidPlan: async (account) => {
      return account.$hasPaidPlan();
    },
    consumptionRatio: async (account) => {
      return account.$getScreenshotsConsumptionRatio();
    },
    currentMonthUsedScreenshots: async (account) => {
      return account.$getScreenshotsCurrentConsumption();
    },
    periodStartDate: async (account) => {
      return account.$getCurrentConsumptionStartDate();
    },
    periodEndDate: async (account) => {
      return account.$getCurrentConsumptionEndDate();
    },
    purchase: async (account) => {
      return account.$getActivePurchase();
    },
    purchaseStatus: async (account) => {
      return account.$getPurchaseStatus() as Promise<IPurchaseStatus>;
    },
    oldPaidPurchase: async (account) => {
      const oldPaidPurchase = await Purchase.query()
        .where("accountId", account.id)
        .whereNot({ name: "free" })
        .whereRaw("?? < now()", "endDate")
        .joinRelated("plan")
        .orderBy("endDate", "DESC")
        .first();
      return oldPaidPurchase ?? null;
    },
    plan: async (account) => {
      return account.$getPlan();
    },
    screenshotsLimitPerMonth: async (account) => {
      return account.$getScreenshotsMonthlyLimit();
    },
    permissions: async (account, _args, ctx) => {
      if (!ctx.auth) {
        return [];
      }
      const writable = await account.$checkWritePermission(ctx.auth.user);
      return writable
        ? [IPermission.Read, IPermission.Write]
        : [IPermission.Read];
    },
    ghAccount: async (account, _args, ctx) => {
      if (!account.githubAccountId) return null;
      return ctx.loaders.GithubAccount.load(account.githubAccountId);
    },
    avatar: async (account, _args, ctx) => {
      const ghAccount = account.githubAccountId
        ? await ctx.loaders.GithubAccount.load(account.githubAccountId)
        : null;
      const initial = ((account.name || account.slug)[0] || "x").toUpperCase();
      const color = getAvatarColor(account.id);
      if (ghAccount) {
        return {
          getUrl: ({ size }: { size?: number }) => {
            const baseUrl = `https://github.com/${ghAccount.login}.png`;
            if (!size) {
              return baseUrl;
            }
            return `${baseUrl}?size=${size}`;
          },
          initial,
          color,
        };
      }
      return {
        getUrl: () => null,
        initial,
        color,
      };
    },
  },
  AccountAvatar: {
    url: (avatar, args) => {
      return avatar.getUrl(args);
    },
  },
  Query: {
    account: async (_root, args, ctx) => {
      if (!ctx.auth) return null;
      const account = await Account.query().findOne({ slug: args.slug });
      if (!account) return null;
      const hasReadPermission = await account.$checkReadPermission(
        ctx.auth.user
      );
      if (!hasReadPermission) return null;
      return account;
    },
    accountById,
    teamById: accountById,
  },
  Mutation: {
    updateAccount: async (_root, args, ctx) => {
      const { id, ...input } = args.input;
      const account = await getWritableAccount({ id, user: ctx.auth?.user });

      const data: PartialModelObject<Account> = {};

      if (input.slug && account.slug !== input.slug) {
        if (RESERVED_SLUGS.includes(input.slug)) {
          throw new GraphQLError("Slug is reserved for internal usage", {
            extensions: {
              code: "BAD_USER_INPUT",
              field: "slug",
            },
          });
        }
        const slugExists = await Account.query().findOne({ slug: input.slug });
        if (slugExists) {
          throw new GraphQLError("Slug already exists", {
            extensions: {
              code: "BAD_USER_INPUT",
              field: "slug",
            },
          });
        }
        data.slug = input.slug;
      }

      if (input.name !== undefined) {
        data.name = input.name;
      }

      return account.$query().patchAndFetch(data);
    },
    terminateTrial: async (_root, args, ctx) => {
      const { accountId } = args;
      const account = await getWritableAccount({
        id: accountId,
        user: ctx.auth?.user,
      });
      const purchase = await account.$getActivePurchase();
      if (
        !purchase ||
        purchase.trialEndDate === null ||
        new Date(purchase.trialEndDate) < new Date()
      ) {
        return account;
      }

      if (!account.stripeCustomerId) {
        throw new Error("No stripe customer id");
      }

      const subscription = await getCustomerSubscriptionOrThrow(
        account.stripeCustomerId
      );
      await terminateStripeTrial(subscription.id);
      const updatedSubscription = await getCustomerSubscriptionOrThrow(
        account.stripeCustomerId
      );
      const trialEndDate = updatedSubscription.trial_end
        ? timestampToDate(updatedSubscription.trial_end)
        : new Date().toISOString();
      await Purchase.query().findById(purchase.id).patch({ trialEndDate });
      const updatedAccount = await account
        .$query()
        .throwIfNotFound({ message: "Account not found" });
      return updatedAccount;
    },
  },
};
