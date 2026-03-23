import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, session, admin, payload } =
    await authenticate.webhook(request);

  if (!admin && topic !== "APP_UNINSTALLED") {
    throw new Response();
  }

  switch (topic) {
    case "APP_UNINSTALLED":
      if (session) {
        await prisma.session.deleteMany({ where: { shop } });
      }
      break;

    case "CUSTOMERS_CREATE":
      // Check if this customer was created from a B2B registration
      console.log(`New customer created: ${payload.id} for shop ${shop}`);
      break;

    case "CUSTOMERS_UPDATE":
      // Sync B2B metafield changes if needed
      console.log(`Customer updated: ${payload.id} for shop ${shop}`);
      break;

    default:
      throw new Response("Unhandled webhook topic", { status: 404 });
  }

  throw new Response();
};
