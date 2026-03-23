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
  FormLayout,
  EmptyState,
  Banner,
} from "@shopify/polaris";
import { useState, useCallback } from "react";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const segments = await prisma.segment.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          customers: true,
          pricingRules: true,
        },
      },
    },
  });

  return json({ segments });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const actionType = formData.get("actionType") as string;

  if (actionType === "create") {
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const defaultDiscount = parseFloat(formData.get("defaultDiscount") as string) || 0;

    if (!name) {
      return json({ error: "Názov segmentu je povinný" }, { status: 400 });
    }

    await prisma.segment.create({
      data: {
        shop,
        name,
        description,
        defaultDiscount,
      },
    });

    return json({ success: true, action: "created" });
  }

  if (actionType === "update") {
    const segmentId = formData.get("segmentId") as string;
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const defaultDiscount = parseFloat(formData.get("defaultDiscount") as string) || 0;

    await prisma.segment.update({
      where: { id: segmentId },
      data: { name, description, defaultDiscount },
    });

    return json({ success: true, action: "updated" });
  }

  if (actionType === "delete") {
    const segmentId = formData.get("segmentId") as string;

    // Check if segment has customers
    const customerCount = await prisma.b2BCustomer.count({
      where: { segmentId },
    });

    if (customerCount > 0) {
      return json({
        error: `Segment má ${customerCount} zákazníkov. Najprv ich presuňte do iného segmentu.`,
      }, { status: 400 });
    }

    await prisma.segment.delete({ where: { id: segmentId } });
    return json({ success: true, action: "deleted" });
  }

  return json({ error: "Unknown action" }, { status: 400 });
};

export default function Segments() {
  const { segments } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isLoading = navigation.state === "submitting";

  const [modalOpen, setModalOpen] = useState(false);
  const [editingSegment, setEditingSegment] = useState<any>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [defaultDiscount, setDefaultDiscount] = useState("0");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const openCreate = useCallback(() => {
    setEditingSegment(null);
    setName("");
    setDescription("");
    setDefaultDiscount("0");
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((segment: any) => {
    setEditingSegment(segment);
    setName(segment.name);
    setDescription(segment.description || "");
    setDefaultDiscount(segment.defaultDiscount.toString());
    setModalOpen(true);
  }, []);

  const handleSave = useCallback(() => {
    const formData = new FormData();
    if (editingSegment) {
      formData.set("actionType", "update");
      formData.set("segmentId", editingSegment.id);
    } else {
      formData.set("actionType", "create");
    }
    formData.set("name", name);
    formData.set("description", description);
    formData.set("defaultDiscount", defaultDiscount);
    submit(formData, { method: "post" });
    setModalOpen(false);
  }, [editingSegment, name, description, defaultDiscount, submit]);

  const handleDelete = useCallback((segmentId: string) => {
    const formData = new FormData();
    formData.set("actionType", "delete");
    formData.set("segmentId", segmentId);
    submit(formData, { method: "post" });
    setDeleteConfirm(null);
  }, [submit]);

  const rowMarkup = segments.map((segment: any, index: number) => (
    <IndexTable.Row id={segment.id} key={segment.id} position={index}>
      <IndexTable.Cell>
        <Text as="span" fontWeight="semibold">{segment.name}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>{segment.description || "—"}</IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone="success">{segment.defaultDiscount}%</Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>{segment._count.customers}</IndexTable.Cell>
      <IndexTable.Cell>{segment._count.pricingRules}</IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="200">
          <Button size="slim" onClick={() => openEdit(segment)}>Upraviť</Button>
          <Button
            size="slim"
            variant="plain"
            tone="critical"
            onClick={() => setDeleteConfirm(segment.id)}
          >
            Zmazať
          </Button>
        </InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Cenové segmenty"
      subtitle="Vytvorte skupiny zákazníkov s rôznymi cenovými úrovňami"
      primaryAction={{
        content: "Nový segment",
        onAction: openCreate,
      }}
    >
      <Layout>
        <Layout.Section>
          <Card padding="0">
            {segments.length === 0 ? (
              <EmptyState
                heading="Žiadne segmenty"
                action={{ content: "Vytvoriť prvý segment", onAction: openCreate }}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>
                  Vytvorte cenové segmenty pre rôzne úrovne B2B zákazníkov.
                  Napríklad: Gold (30% zľava), Silver (20%), Bronze (10%).
                </p>
              </EmptyState>
            ) : (
              <IndexTable
                resourceName={{ singular: "segment", plural: "segmenty" }}
                itemCount={segments.length}
                headings={[
                  { title: "Názov" },
                  { title: "Popis" },
                  { title: "Základná zľava" },
                  { title: "Zákazníci" },
                  { title: "Pravidlá" },
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

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingSegment ? `Upraviť: ${editingSegment.name}` : "Nový segment"}
        primaryAction={{
          content: editingSegment ? "Uložiť" : "Vytvoriť",
          onAction: handleSave,
          loading: isLoading,
        }}
        secondaryActions={[
          { content: "Zrušiť", onAction: () => setModalOpen(false) },
        ]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField
              label="Názov segmentu"
              value={name}
              onChange={setName}
              placeholder="napr. Gold, Silver, Bronze"
              autoComplete="off"
            />
            <TextField
              label="Popis"
              value={description}
              onChange={setDescription}
              multiline={2}
              autoComplete="off"
            />
            <TextField
              label="Základná percentuálna zľava"
              value={defaultDiscount}
              onChange={setDefaultDiscount}
              type="number"
              suffix="%"
              helpText="Predvolená zľava pre všetky produkty v tomto segmente"
              autoComplete="off"
            />
          </FormLayout>
        </Modal.Section>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Zmazať segment?"
        primaryAction={{
          content: "Zmazať",
          onAction: () => deleteConfirm && handleDelete(deleteConfirm),
          destructive: true,
          loading: isLoading,
        }}
        secondaryActions={[
          { content: "Zrušiť", onAction: () => setDeleteConfirm(null) },
        ]}
      >
        <Modal.Section>
          <Text as="p">
            Naozaj chcete zmazať tento segment? Táto akcia sa nedá vrátiť.
          </Text>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
