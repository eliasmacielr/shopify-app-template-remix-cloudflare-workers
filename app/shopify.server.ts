import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";

import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { PrismaClient } from "@prisma/client/edge";
import { withAccelerate } from "@prisma/extension-accelerate";
import type { AppLoadContext } from "@remix-run/node";

export const shopify = (context: AppLoadContext) =>
  shopifyApp({
    apiKey: context.cloudflare.env.SHOPIFY_API_KEY,
    apiSecretKey: context.cloudflare.env.SHOPIFY_API_SECRET,
    apiVersion: ApiVersion.October24,
    scopes: context.cloudflare.env?.SCOPES?.split(",") || ["read_products"],
    appUrl: context.cloudflare.env?.SHOPIFY_APP_URL,
    authPathPrefix: "/auth",
    sessionStorage: new PrismaSessionStorage(
      new PrismaClient({
        datasourceUrl: context.cloudflare.env.DATABASE_URL,
      }).$extends(withAccelerate()),
      {
        connectionRetries: 10,
        connectionRetryIntervalMs: 5000,
      },
    ),
    distribution: AppDistribution.AppStore,
    future: {
      unstable_newEmbeddedAuthStrategy: true,
      removeRest: true,
    },
    ...(process.env.SHOP_CUSTOM_DOMAIN
      ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
      : {}),
    logger: {
      log: console.log,
    },
  });

export default shopify;
export const authenticate = shopify.authenticate;
export const apiVersion = ApiVersion.October24;
