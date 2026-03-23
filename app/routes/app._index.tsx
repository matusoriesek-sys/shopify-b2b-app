import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  InlineGrid,
  Box,
  Badge,
  InlineStack,
  Icon,
  Button,
} from "@shopify/polaris";
import {
  PersonIcon,
  OrderIcon,
  SettingsIcon,
} from "@shopify/polaris-icons";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const [
    pendingRegistrations,
    totalCustomers,
    totalSegments,
    recentRegistrations,
  ] = await Promise.all([
    prisma.registration.count({ where: { shop, status: "pending" } }),
    prisma.b2BCustomer.count({ where: { shop } }),
    prisma.segment.count({ where: { shop } }),
    prisma.registration.findMany({
      where: { shop },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { segment: true },
    }),
  ]);

  return json({
    pendingRegistrations,
    totalCustomers,
    totalSegments,
    recentRegistrations,
  });
};

export default function Dashboard() {
  const {
    pendingRegistrations,
    totalCustomers,
    totalSegments,
    recentRegistrations,
  } = useLoaderData<typeof loader>();

  return (
    <Page title="B2B Dashboard">
      <BlockStack gap="500">
        <InlineGrid columns={3} gap="400">
          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text as="h2" variant="headingSm">Čakajúce registrácie</Text>
                {pendingRegistrations > 0 && (
                  <Badge tone="attention">{pendingRegistrations.toString()}</Badge>
                )}
              </InlineStack>
              <Text as="p" variant="heading2xl" fontWeight="bold">
                {pendingRegistrations}
              </Text>
              <Button url="/app/registrations" variant="plain">
                Zobraziť všetky →
              </Button>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text as="h2" variant="headingSm">B2B zákazníci</Text>
              <Text as="p" variant="heading2xl" fontWeight="bold">
                {totalCustomers}
              </Text>
              <Button url="/app/segments" variant="plain">
                Spravovať segmenty →
              </Button>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text as="h2" variant="headingSm">Cenové segmenty</Text>
              <Text as="p" variant="heading2xl" fontWeight="bold">
                {totalSegments}
              </Text>
              <Button url="/app/pricing" variant="plain">
                Cenové pravidlá →
              </Button>
            </BlockStack>
          </Card>
        </InlineGrid>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Posledné registrácie</Text>
                {recentRegistrations.length === 0 ? (
                  <Text as="p" tone="subdued">
                    Zatiaľ žiadne registrácie. Registračný formulár je dostupný
                    cez App Proxy na vašom obchode.
                  </Text>
                ) : (
                  <BlockStack gap="300">
                    {recentRegistrations.map((reg: any) => (
                      <InlineStack key={reg.id} align="space-between" blockAlign="center">
                        <BlockStack gap="100">
                          <Text as="p" fontWeight="semibold">{reg.companyName}</Text>
                          <Text as="p" tone="subdued">{reg.email}</Text>
                        </BlockStack>
                        <InlineStack gap="200">
                          {reg.segment && (
                            <Badge>{reg.segment.name}</Badge>
                          )}
                          <Badge
                            tone={
                              reg.status === "approved"
                                ? "success"
                                : reg.status === "rejected"
                                ? "critical"
                                : "attention"
                            }
                          >
                            {reg.status === "approved"
                              ? "Schválené"
                              : reg.status === "rejected"
                              ? "Zamietnuté"
                              : "Čaká"}
                          </Badge>
                        </InlineStack>
                      </InlineStack>
                    ))}
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Rýchly štart</Text>
                <BlockStack gap="200">
                  <Text as="p" variant="bodySm">
                    1. Vytvorte cenové segmenty (napr. Gold, Silver)
                  </Text>
                  <Text as="p" variant="bodySm">
                    2. Nastavte cenové pravidlá pre každý segment
                  </Text>
                  <Text as="p" variant="bodySm">
                    3. Aktivujte registračný formulár na storefront
                  </Text>
                  <Text as="p" variant="bodySm">
                    4. Schvaľujte B2B zákazníkov a priraďte segmenty
                  </Text>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
