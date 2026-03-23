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
  FormLayout,
  EmptyState,
  Tabs,
  Banner,
  Divider,
} from "@shopify/polaris";
import { useState, useCallback } from "react";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  const [segments, pricingRules] = await Promise.all([
    prisma.segment.findMany({
      where: { shop },
      orderBy: { name: "asc" },
    }),
    prisma.pricingRule.findMany({
      where: { shop },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      include: { segment: true },
    }),
  ]);

  // Fetch vendors/brands from Shopify
  let vendors: string[] = [];
  let productTypes: string[] = [];
  try {
    const response = await admin.graphql(`
      {
        shop {
          productVendors(first: 250) {
            edges {
              node
            }
          }
          productTypes(first: 250) {
            edges {
              node
            }
          }
        }
      }
    `);
    const data = await response.json();
    vendors = data.data?.shop?.productVendors?.edges?.map((e: any) => e.node) || [];
    productTypes = data.data?.shop?.productTypes?.edges?.map((e: any) => e.node) || [];
  } catch (e) {
    console.error("Failed to fetch vendors/types:", e);
  }

  return json({ segments, pricingRules, vendors, productTypes });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const actionType = formData.get("actionType") as string;

  if (actionType === "create") {
    const segmentId = formData.get("segmentId") as string;
    const ruleType = formData.get("ruleType") as string;
    const target = formData.get("target") as string || "*";
    const discountValue = parseFloat(formData.get("discountValue") as string) || 0;
    const priority = parseInt(formData.get("priority") as string) || 0;

    await prisma.pricingRule.create({
      data: {
        shop,
        segmentId,
        ruleType,
        target,
        discountValue,
        priority,
      },
    });

    return json({ success: true });
  }

  if (actionType === "update") {
    const ruleId = formData.get("ruleId") as string;
    const discountValue = parseFloat(formData.get("discountValue") as string) || 0;
    const priority = parseInt(formData.get("priority") as string) || 0;
    const isActive = formData.get("isActive") === "true";

    await prisma.pricingRule.update({
      where: { id: ruleId },
      data: { discountValue, priority, isActive },
    });

    return json({ success: true });
  }

  if (actionType === "delete") {
    const ruleId = formData.get("ruleId") as string;
    await prisma.pricingRule.delete({ where: { id: ruleId } });
    return json({ success: true });
  }

  if (actionType === "bulk_create") {
    const segmentId = formData.get("segmentId") as string;
    const discountValue = parseFloat(formData.get("discountValue") as string) || 0;
    const targetType = formData.get("targetType") as string; // "vendor" or "product_type"
    const targets = (formData.get("targets") as string).split(",").map(t => t.trim()).filter(Boolean);

    const rules = targets.map((target, i) => ({
      shop,
      segmentId,
      ruleType: targetType,
      target,
      discountValue,
      priority: i,
    }));

    await prisma.pricingRule.createMany({ data: rules });
    return json({ success: true });
  }

  return json({ error: "Unknown action" }, { status: 400 });
};

export default function Pricing() {
  const { segments, pricingRules, vendors, productTypes } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isLoading = navigation.state === "submitting";

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState(segments[0]?.id || "");
  const [ruleType, setRuleType] = useState("percentage");
  const [target, setTarget] = useState("*");
  const [discountValue, setDiscountValue] = useState("0");
  const [priority, setPriority] = useState("0");
  const [selectedTab, setSelectedTab] = useState(0);

  const tabs = [
    { id: "all", content: "Všetky pravidlá" },
    ...segments.map((s: any) => ({
      id: s.id,
      content: s.name,
    })),
  ];

  const filteredRules = selectedTab === 0
    ? pricingRules
    : pricingRules.filter((r: any) => r.segmentId === tabs[selectedTab].id);

  const handleCreate = useCallback(() => {
    const formData = new FormData();
    formData.set("actionType", "create");
    formData.set("segmentId", selectedSegment);
    formData.set("ruleType", ruleType);
    formData.set("target", target);
    formData.set("discountValue", discountValue);
    formData.set("priority", priority);
    submit(formData, { method: "post" });
    setModalOpen(false);
  }, [selectedSegment, ruleType, target, discountValue, priority, submit]);

  const handleDelete = useCallback((ruleId: string) => {
    const formData = new FormData();
    formData.set("actionType", "delete");
    formData.set("ruleId", ruleId);
    submit(formData, { method: "post" });
  }, [submit]);

  const handleToggle = useCallback((rule: any) => {
    const formData = new FormData();
    formData.set("actionType", "update");
    formData.set("ruleId", rule.id);
    formData.set("discountValue", rule.discountValue.toString());
    formData.set("priority", rule.priority.toString());
    formData.set("isActive", (!rule.isActive).toString());
    submit(formData, { method: "post" });
  }, [submit]);

  const ruleTypeOptions = [
    { label: "Percentuálna zľava (všetko)", value: "percentage" },
    { label: "Podľa značky / dodávateľa", value: "vendor" },
    { label: "Podľa typu produktu", value: "product_type" },
  ];

  const segmentOptions = segments.map((s: any) => ({
    label: s.name,
    value: s.id,
  }));

  const targetOptions = ruleType === "vendor"
    ? [{ label: "Všetky", value: "*" }, ...vendors.map(v => ({ label: v, value: v }))]
    : ruleType === "product_type"
    ? [{ label: "Všetky", value: "*" }, ...productTypes.map(t => ({ label: t, value: t }))]
    : [{ label: "Všetky produkty", value: "*" }];

  const getRuleLabel = (rule: any) => {
    if (rule.ruleType === "percentage" || rule.target === "*") return "Všetky produkty";
    if (rule.ruleType === "vendor") return `Značka: ${rule.target}`;
    if (rule.ruleType === "product_type") return `Typ: ${rule.target}`;
    return rule.target;
  };

  const rowMarkup = filteredRules.map((rule: any, index: number) => (
    <IndexTable.Row id={rule.id} key={rule.id} position={index}>
      <IndexTable.Cell>
        <Badge>{rule.segment.name}</Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span">{getRuleLabel(rule)}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone="success">{rule.discountValue}%</Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>{rule.priority}</IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={rule.isActive ? "success" : undefined}>
          {rule.isActive ? "Aktívne" : "Neaktívne"}
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="200">
          <Button size="slim" onClick={() => handleToggle(rule)}>
            {rule.isActive ? "Deaktivovať" : "Aktivovať"}
          </Button>
          <Button
            size="slim"
            variant="plain"
            tone="critical"
            onClick={() => handleDelete(rule.id)}
          >
            Zmazať
          </Button>
        </InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Cenové pravidlá"
      subtitle="Nastavte zľavy pre B2B segmenty — po značkách, dodávateľoch alebo percentuálne"
      primaryAction={{
        content: "Nové pravidlo",
        onAction: () => setModalOpen(true),
        disabled: segments.length === 0,
      }}
    >
      <Layout>
        <Layout.Section>
          {segments.length === 0 ? (
            <Banner
              title="Najprv vytvorte segmenty"
              tone="warning"
              action={{ content: "Vytvoriť segment", url: "/app/segments" }}
            >
              <p>Cenové pravidlá sa viažu na segmenty zákazníkov.</p>
            </Banner>
          ) : (
            <Card padding="0">
              <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
                {filteredRules.length === 0 ? (
                  <EmptyState
                    heading="Žiadne pravidlá"
                    action={{ content: "Pridať pravidlo", onAction: () => setModalOpen(true) }}
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <p>
                      Pridajte cenové pravidlá pre definovanie zliav na produkty
                      podľa značiek, dodávateľov alebo percentuálne pre celý segment.
                    </p>
                  </EmptyState>
                ) : (
                  <IndexTable
                    resourceName={{ singular: "pravidlo", plural: "pravidlá" }}
                    itemCount={filteredRules.length}
                    headings={[
                      { title: "Segment" },
                      { title: "Cieľ" },
                      { title: "Zľava" },
                      { title: "Priorita" },
                      { title: "Stav" },
                      { title: "Akcie" },
                    ]}
                    selectable={false}
                  >
                    {rowMarkup}
                  </IndexTable>
                )}
              </Tabs>
            </Card>
          )}
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">Ako fungujú pravidlá</Text>
              <BlockStack gap="200">
                <Text as="p" variant="bodySm">
                  • Pravidlá sa aplikujú podľa priority (vyššia = prvá)
                </Text>
                <Text as="p" variant="bodySm">
                  • Pravidlo pre konkrétnu značku má prednosť pred všeobecným
                </Text>
                <Text as="p" variant="bodySm">
                  • Ak zákazník patrí do segmentu Gold so zľavou 30%, všetky produkty
                  budú o 30% lacnejšie
                </Text>
                <Text as="p" variant="bodySm">
                  • Môžete pridať pravidlo pre konkrétnu značku s inou zľavou
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>

      {/* Create Rule Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nové cenové pravidlo"
        primaryAction={{
          content: "Vytvoriť",
          onAction: handleCreate,
          loading: isLoading,
        }}
        secondaryActions={[
          { content: "Zrušiť", onAction: () => setModalOpen(false) },
        ]}
      >
        <Modal.Section>
          <FormLayout>
            <Select
              label="Segment"
              options={segmentOptions}
              value={selectedSegment}
              onChange={setSelectedSegment}
            />
            <Select
              label="Typ pravidla"
              options={ruleTypeOptions}
              value={ruleType}
              onChange={(v) => {
                setRuleType(v);
                setTarget("*");
              }}
            />
            {ruleType !== "percentage" && (
              <Select
                label={ruleType === "vendor" ? "Značka / dodávateľ" : "Typ produktu"}
                options={targetOptions}
                value={target}
                onChange={setTarget}
              />
            )}
            <TextField
              label="Zľava"
              value={discountValue}
              onChange={setDiscountValue}
              type="number"
              suffix="%"
              autoComplete="off"
            />
            <TextField
              label="Priorita"
              value={priority}
              onChange={setPriority}
              type="number"
              helpText="Vyššia priorita = aplikuje sa prvá"
              autoComplete="off"
            />
          </FormLayout>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
