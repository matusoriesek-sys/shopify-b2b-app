import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  TextField,
  Button,
  Banner,
  InlineStack,
  Divider,
  Badge,
} from "@shopify/polaris";
import { useState, useCallback } from "react";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  // Check if B2B metafield definitions exist
  let metafieldsConfigured = false;
  try {
    const response = await admin.graphql(`
      {
        metafieldDefinitions(
          first: 10,
          ownerType: CUSTOMER,
          namespace: "custom",
          query: "key:b2b"
        ) {
          edges {
            node {
              key
              name
              type {
                name
              }
            }
          }
        }
      }
    `);
    const data = await response.json();
    metafieldsConfigured = (data.data?.metafieldDefinitions?.edges?.length || 0) > 0;
  } catch (e) {
    console.error("Failed to check metafields:", e);
  }

  const stats = {
    totalCustomers: await prisma.b2BCustomer.count({ where: { shop } }),
    totalSegments: await prisma.segment.count({ where: { shop } }),
    totalRules: await prisma.pricingRule.count({ where: { shop } }),
    pendingRegistrations: await prisma.registration.count({ where: { shop, status: "pending" } }),
  };

  return json({ metafieldsConfigured, stats, shop });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType") as string;

  if (actionType === "setup_metafields") {
    // Create B2B metafield definitions
    const metafields = [
      { key: "b2b", name: "B2B zákazník", type: "boolean", description: "Či je zákazník B2B" },
      { key: "b2b_status", name: "B2B status", type: "single_line_text_field", description: "Status B2B registrácie (pending/approved/rejected)" },
      { key: "b2b_segment", name: "B2B segment", type: "single_line_text_field", description: "Cenový segment zákazníka" },
      { key: "b2b_company", name: "B2B firma", type: "single_line_text_field", description: "Názov firmy" },
      { key: "b2b_discount", name: "B2B zľava", type: "number_decimal", description: "Percentuálna zľava zákazníka" },
    ];

    const errors: string[] = [];
    for (const mf of metafields) {
      try {
        await admin.graphql(`
          mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
            metafieldDefinitionCreate(definition: $definition) {
              createdDefinition {
                id
                name
              }
              userErrors {
                field
                message
              }
            }
          }
        `, {
          variables: {
            definition: {
              name: mf.name,
              namespace: "custom",
              key: mf.key,
              description: mf.description,
              type: mf.type,
              ownerType: "CUSTOMER",
              pin: true,
            },
          },
        });
      } catch (e: any) {
        errors.push(`${mf.key}: ${e.message}`);
      }
    }

    if (errors.length > 0) {
      return json({ error: `Niektoré metafieldy sa nepodarilo vytvoriť: ${errors.join(", ")}` });
    }

    return json({ success: true, message: "Metafieldy úspešne vytvorené" });
  }

  return json({ error: "Unknown action" }, { status: 400 });
};

export default function Settings() {
  const { metafieldsConfigured, stats, shop } = useLoaderData<typeof loader>();
  const submit = useSubmit();

  const handleSetupMetafields = useCallback(() => {
    const formData = new FormData();
    formData.set("actionType", "setup_metafields");
    submit(formData, { method: "post" });
  }, [submit]);

  return (
    <Page title="Nastavenia" subtitle="Konfigurácia B2B aplikácie">
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {/* Metafields Setup */}
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">Customer metafieldy</Text>
                  <Badge tone={metafieldsConfigured ? "success" : "attention"}>
                    {metafieldsConfigured ? "Nakonfigurované" : "Potrebná konfigurácia"}
                  </Badge>
                </InlineStack>
                <Text as="p">
                  B2B appka používa customer metafieldy na uloženie B2B statusu,
                  segmentu a zľavy. Tieto metafieldy musia byť vytvorené v Shopify.
                </Text>
                <BlockStack gap="100">
                  <Text as="p" variant="bodySm">• <code>custom.b2b</code> — boolean (je B2B)</Text>
                  <Text as="p" variant="bodySm">• <code>custom.b2b_status</code> — text (pending/approved/rejected)</Text>
                  <Text as="p" variant="bodySm">• <code>custom.b2b_segment</code> — text (názov segmentu)</Text>
                  <Text as="p" variant="bodySm">• <code>custom.b2b_company</code> — text (firma)</Text>
                  <Text as="p" variant="bodySm">• <code>custom.b2b_discount</code> — číslo (% zľava)</Text>
                </BlockStack>
                {!metafieldsConfigured && (
                  <Button variant="primary" onClick={handleSetupMetafields}>
                    Vytvoriť metafieldy automaticky
                  </Button>
                )}
              </BlockStack>
            </Card>

            {/* App Proxy Info */}
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Registračný formulár (App Proxy)</Text>
                <Text as="p">
                  Registračný formulár je dostupný na vašom obchode cez App Proxy:
                </Text>
                <Banner>
                  <Text as="p" fontWeight="semibold">
                    https://{shop}/apps/b2b/register
                  </Text>
                </Banner>
                <Text as="p" variant="bodySm" tone="subdued">
                  Môžete ho pridať do navigácie alebo vytvoriť stránku s odkazom naň.
                  Formulár je plne štylizovateľný cez vašu tému.
                </Text>
              </BlockStack>
            </Card>

            {/* Pricing Function Info */}
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Cenová funkcia (Shopify Function)</Text>
                <Text as="p">
                  B2B ceny sa aplikujú automaticky cez Shopify Function, ktorá
                  kontroluje customer metafield <code>custom.b2b_discount</code>
                  a aplikuje zľavu na cart.
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Po deploynutí appky cez <code>shopify app deploy</code> sa funkcia
                  automaticky zaregistruje.
                </Text>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">Štatistiky</Text>
              <Divider />
              <InlineStack align="space-between">
                <Text as="p">B2B zákazníci</Text>
                <Text as="p" fontWeight="semibold">{stats.totalCustomers}</Text>
              </InlineStack>
              <InlineStack align="space-between">
                <Text as="p">Segmenty</Text>
                <Text as="p" fontWeight="semibold">{stats.totalSegments}</Text>
              </InlineStack>
              <InlineStack align="space-between">
                <Text as="p">Cenové pravidlá</Text>
                <Text as="p" fontWeight="semibold">{stats.totalRules}</Text>
              </InlineStack>
              <InlineStack align="space-between">
                <Text as="p">Čakajúce registrácie</Text>
                <Badge tone={stats.pendingRegistrations > 0 ? "attention" : undefined}>
                  {stats.pendingRegistrations}
                </Badge>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
