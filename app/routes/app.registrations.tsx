import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  IndexTable,
  Badge,
  Button,
  InlineStack,
  Modal,
  TextField,
  Select,
  Banner,
  EmptyState,
  Filters,
  ChoiceList,
  useIndexResourceState,
} from "@shopify/polaris";
import { useState, useCallback } from "react";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status") || "all";

  const where: any = { shop };
  if (statusFilter !== "all") {
    where.status = statusFilter;
  }

  const [registrations, segments] = await Promise.all([
    prisma.registration.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { segment: true },
    }),
    prisma.segment.findMany({ where: { shop } }),
  ]);

  return json({ registrations, segments, statusFilter });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const actionType = formData.get("actionType") as string;

  if (actionType === "approve") {
    const registrationId = formData.get("registrationId") as string;
    const segmentId = formData.get("segmentId") as string;

    const registration = await prisma.registration.update({
      where: { id: registrationId },
      data: {
        status: "approved",
        segmentId,
        approvedAt: new Date(),
      },
    });

    // Create or find Shopify customer and set B2B metafields
    if (registration.shopifyCustomerId) {
      const segment = await prisma.segment.findUnique({
        where: { id: segmentId },
      });

      // Set customer metafields via GraphQL
      await admin.graphql(`
        mutation SetCustomerB2BMetafields($input: CustomerInput!) {
          customerUpdate(input: $input) {
            customer {
              id
            }
            userErrors {
              field
              message
            }
          }
        }
      `, {
        variables: {
          input: {
            id: registration.shopifyCustomerId,
            metafields: [
              {
                namespace: "custom",
                key: "b2b",
                value: "true",
                type: "boolean",
              },
              {
                namespace: "custom",
                key: "b2b_status",
                value: "approved",
                type: "single_line_text_field",
              },
              {
                namespace: "custom",
                key: "b2b_segment",
                value: segment?.name || "",
                type: "single_line_text_field",
              },
              {
                namespace: "custom",
                key: "b2b_company",
                value: registration.companyName,
                type: "single_line_text_field",
              },
              {
                namespace: "custom",
                key: "b2b_discount",
                value: (segment?.defaultDiscount || 0).toString(),
                type: "number_decimal",
              },
            ],
          },
        },
      });

      // Create B2BCustomer record
      await prisma.b2BCustomer.upsert({
        where: {
          shop_shopifyCustomerId: {
            shop,
            shopifyCustomerId: registration.shopifyCustomerId,
          },
        },
        update: { segmentId },
        create: {
          shop,
          shopifyCustomerId: registration.shopifyCustomerId,
          segmentId,
        },
      });
    }

    return json({ success: true, action: "approved" });
  }

  if (actionType === "reject") {
    const registrationId = formData.get("registrationId") as string;
    const rejectionReason = formData.get("rejectionReason") as string;

    await prisma.registration.update({
      where: { id: registrationId },
      data: {
        status: "rejected",
        rejectionReason,
      },
    });

    return json({ success: true, action: "rejected" });
  }

  return json({ error: "Unknown action" }, { status: 400 });
};

export default function Registrations() {
  const { registrations, segments, statusFilter } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isLoading = navigation.state === "submitting";

  const [selectedRegistration, setSelectedRegistration] = useState<any>(null);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  const resourceName = {
    singular: "registrácia",
    plural: "registrácie",
  };

  const handleApprove = useCallback((registration: any) => {
    setSelectedRegistration(registration);
    setSelectedSegment(segments[0]?.id || "");
    setApproveModalOpen(true);
  }, [segments]);

  const handleReject = useCallback((registration: any) => {
    setSelectedRegistration(registration);
    setRejectionReason("");
    setRejectModalOpen(true);
  }, []);

  const submitApprove = useCallback(() => {
    if (!selectedRegistration || !selectedSegment) return;
    const formData = new FormData();
    formData.set("actionType", "approve");
    formData.set("registrationId", selectedRegistration.id);
    formData.set("segmentId", selectedSegment);
    submit(formData, { method: "post" });
    setApproveModalOpen(false);
  }, [selectedRegistration, selectedSegment, submit]);

  const submitReject = useCallback(() => {
    if (!selectedRegistration) return;
    const formData = new FormData();
    formData.set("actionType", "reject");
    formData.set("registrationId", selectedRegistration.id);
    formData.set("rejectionReason", rejectionReason);
    submit(formData, { method: "post" });
    setRejectModalOpen(false);
  }, [selectedRegistration, rejectionReason, submit]);

  const segmentOptions = segments.map((s: any) => ({
    label: `${s.name} (${s.defaultDiscount}% zľava)`,
    value: s.id,
  }));

  const rowMarkup = registrations.map((reg: any, index: number) => (
    <IndexTable.Row id={reg.id} key={reg.id} position={index}>
      <IndexTable.Cell>
        <Text as="span" fontWeight="semibold">{reg.companyName}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>{reg.contactPerson}</IndexTable.Cell>
      <IndexTable.Cell>{reg.email}</IndexTable.Cell>
      <IndexTable.Cell>{reg.ico || "—"}</IndexTable.Cell>
      <IndexTable.Cell>{reg.dic || "—"}</IndexTable.Cell>
      <IndexTable.Cell>
        {reg.segment ? <Badge>{reg.segment.name}</Badge> : "—"}
      </IndexTable.Cell>
      <IndexTable.Cell>
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
            : "Čaká na schválenie"}
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {reg.status === "pending" && (
          <InlineStack gap="200">
            <Button size="slim" variant="primary" onClick={() => handleApprove(reg)}>
              Schváliť
            </Button>
            <Button size="slim" variant="plain" tone="critical" onClick={() => handleReject(reg)}>
              Zamietnuť
            </Button>
          </InlineStack>
        )}
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="B2B Registrácie"
      subtitle="Spravujte žiadosti o B2B prístup"
    >
      <Layout>
        <Layout.Section>
          {segments.length === 0 && (
            <Banner
              title="Najprv vytvorte segmenty"
              tone="warning"
              action={{ content: "Vytvoriť segment", url: "/app/segments" }}
            >
              <p>
                Pred schvaľovaním registrácií musíte mať aspoň jeden cenový segment.
              </p>
            </Banner>
          )}
          <Card padding="0">
            {registrations.length === 0 ? (
              <EmptyState
                heading="Žiadne registrácie"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>
                  Registrácie sa objavia po tom, čo zákazníci vyplnia B2B
                  registračný formulár na vašom obchode.
                </p>
              </EmptyState>
            ) : (
              <IndexTable
                resourceName={resourceName}
                itemCount={registrations.length}
                headings={[
                  { title: "Firma" },
                  { title: "Kontakt" },
                  { title: "Email" },
                  { title: "IČO" },
                  { title: "DIČ" },
                  { title: "Segment" },
                  { title: "Stav" },
                  { title: "Akcie" },
                ]}
                selectable={false}
              >
                {rowMarkup}
              </IndexTable>
            )}
          </Card>
        </Layout.Section>
      </Layout>

      {/* Approve Modal */}
      <Modal
        open={approveModalOpen}
        onClose={() => setApproveModalOpen(false)}
        title={`Schváliť: ${selectedRegistration?.companyName}`}
        primaryAction={{
          content: "Schváliť",
          onAction: submitApprove,
          loading: isLoading,
        }}
        secondaryActions={[
          { content: "Zrušiť", onAction: () => setApproveModalOpen(false) },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Text as="p">
              Zákazník bude označený ako B2B a priradený do vybraného cenového segmentu.
            </Text>
            <Select
              label="Cenový segment"
              options={segmentOptions}
              value={selectedSegment}
              onChange={setSelectedSegment}
            />
            {selectedRegistration && (
              <BlockStack gap="200">
                <Text as="p" variant="bodySm" tone="subdued">
                  Firma: {selectedRegistration.companyName}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  IČO: {selectedRegistration.ico || "—"} | DIČ: {selectedRegistration.dic || "—"}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Email: {selectedRegistration.email}
                </Text>
              </BlockStack>
            )}
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* Reject Modal */}
      <Modal
        open={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title={`Zamietnuť: ${selectedRegistration?.companyName}`}
        primaryAction={{
          content: "Zamietnuť",
          onAction: submitReject,
          destructive: true,
          loading: isLoading,
        }}
        secondaryActions={[
          { content: "Zrušiť", onAction: () => setRejectModalOpen(false) },
        ]}
      >
        <Modal.Section>
          <TextField
            label="Dôvod zamietnutia (voliteľné)"
            value={rejectionReason}
            onChange={setRejectionReason}
            multiline={3}
            autoComplete="off"
          />
        </Modal.Section>
      </Modal>
    </Page>
  );
}
