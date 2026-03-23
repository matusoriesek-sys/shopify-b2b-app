import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import prisma from "../db.server";
import { unauthenticated } from "../shopify.server";

// GET - Registration form (rendered through Liquid/App Proxy)
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop") || "";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>B2B Registrácia</title>
  <style>
    .b2b-form {
      max-width: 600px;
      margin: 2rem auto;
      padding: 2rem;
      font-family: var(--font-body-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
    }
    .b2b-form h2 {
      margin-bottom: 1.5rem;
      font-size: 1.5rem;
    }
    .b2b-form .form-group {
      margin-bottom: 1rem;
    }
    .b2b-form label {
      display: block;
      margin-bottom: 0.25rem;
      font-weight: 500;
      font-size: 0.875rem;
    }
    .b2b-form input,
    .b2b-form textarea,
    .b2b-form select {
      width: 100%;
      padding: 0.5rem 0.75rem;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: 1rem;
      box-sizing: border-box;
    }
    .b2b-form input:focus,
    .b2b-form textarea:focus {
      outline: none;
      border-color: #000;
    }
    .b2b-form .required::after {
      content: " *";
      color: #e53e3e;
    }
    .b2b-form .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }
    .b2b-form button[type="submit"] {
      width: 100%;
      padding: 0.75rem;
      background: #000;
      color: #fff;
      border: none;
      border-radius: 4px;
      font-size: 1rem;
      cursor: pointer;
      margin-top: 1rem;
    }
    .b2b-form button[type="submit"]:hover {
      background: #333;
    }
    .b2b-form .success {
      padding: 1rem;
      background: #f0fff4;
      border: 1px solid #c6f6d5;
      border-radius: 4px;
      color: #276749;
      margin-bottom: 1rem;
    }
    .b2b-form .error {
      padding: 1rem;
      background: #fff5f5;
      border: 1px solid #fed7d7;
      border-radius: 4px;
      color: #c53030;
      margin-bottom: 1rem;
    }
    .b2b-form .helper {
      font-size: 0.75rem;
      color: #718096;
      margin-top: 0.25rem;
    }
  </style>
</head>
<body>
  <div class="b2b-form">
    <h2>Registrácia B2B účtu</h2>
    <p style="margin-bottom: 1.5rem; color: #666;">
      Vyplňte formulár pre získanie B2B prístupu s veľkoobchodnými cenami. 
      Po schválení vašej registrácie vám budú automaticky zobrazené zľavnené ceny.
    </p>
    
    <div id="message"></div>
    
    <form id="b2b-registration-form">
      <input type="hidden" name="shop" value="${shop}">
      
      <div class="form-group">
        <label class="required">Názov firmy</label>
        <input type="text" name="companyName" required>
      </div>
      
      <div class="row">
        <div class="form-group">
          <label>IČO</label>
          <input type="text" name="ico" placeholder="12345678">
        </div>
        <div class="form-group">
          <label>DIČ</label>
          <input type="text" name="dic" placeholder="1234567890">
        </div>
      </div>
      
      <div class="form-group">
        <label>IČ DPH</label>
        <input type="text" name="icDph" placeholder="SK1234567890">
      </div>
      
      <div class="form-group">
        <label class="required">Kontaktná osoba</label>
        <input type="text" name="contactPerson" required>
      </div>
      
      <div class="row">
        <div class="form-group">
          <label class="required">Email</label>
          <input type="email" name="email" required>
        </div>
        <div class="form-group">
          <label>Telefón</label>
          <input type="tel" name="phone">
        </div>
      </div>
      
      <div class="form-group">
        <label>Adresa</label>
        <input type="text" name="address">
      </div>
      
      <div class="row">
        <div class="form-group">
          <label>Mesto</label>
          <input type="text" name="city">
        </div>
        <div class="form-group">
          <label>PSČ</label>
          <input type="text" name="postalCode">
        </div>
      </div>
      
      <div class="form-group">
        <label>Krajina</label>
        <select name="country">
          <option value="SK">Slovensko</option>
          <option value="CZ">Česko</option>
          <option value="AT">Rakúsko</option>
          <option value="DE">Nemecko</option>
          <option value="HU">Maďarsko</option>
          <option value="PL">Poľsko</option>
          <option value="IT">Taliansko</option>
        </select>
      </div>
      
      <button type="submit">Odoslať registráciu</button>
      <p class="helper" style="text-align: center; margin-top: 0.5rem;">
        Po odoslaní bude vaša žiadosť preverená. O výsledku vás budeme informovať emailom.
      </p>
    </form>
  </div>
  
  <script>
    document.getElementById('b2b-registration-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const button = form.querySelector('button[type="submit"]');
      const messageDiv = document.getElementById('message');
      
      button.disabled = true;
      button.textContent = 'Odosielam...';
      
      const data = Object.fromEntries(new FormData(form));
      
      try {
        const response = await fetch('/apps/b2b/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        
        const result = await response.json();
        
        if (result.success) {
          messageDiv.innerHTML = '<div class="success">Ďakujeme! Vaša registrácia bola odoslaná. O schválení vás budeme informovať emailom.</div>';
          form.style.display = 'none';
        } else {
          messageDiv.innerHTML = '<div class="error">' + (result.error || 'Nastala chyba. Skúste to prosím znova.') + '</div>';
          button.disabled = false;
          button.textContent = 'Odoslať registráciu';
        }
      } catch (err) {
        messageDiv.innerHTML = '<div class="error">Nastala chyba. Skúste to prosím znova.</div>';
        button.disabled = false;
        button.textContent = 'Odoslať registráciu';
      }
    });
  </script>
</body>
</html>
  `;

  return new Response(html, {
    headers: { "Content-Type": "text/html" },
  });
};

// POST - Handle registration submission
export const action = async ({ request }: ActionFunctionArgs) => {
  const url = new URL(request.url);
  const body = await request.json();
  const shop = body.shop || url.searchParams.get("shop") || "";

  if (!body.companyName || !body.contactPerson || !body.email) {
    return json(
      { success: false, error: "Vyplňte prosím všetky povinné polia." },
      { status: 400 }
    );
  }

  // Check if email already registered
  const existing = await prisma.registration.findFirst({
    where: { shop, email: body.email, status: { in: ["pending", "approved"] } },
  });

  if (existing) {
    if (existing.status === "approved") {
      return json(
        { success: false, error: "Tento email je už zaregistrovaný ako B2B zákazník." },
        { status: 400 }
      );
    }
    return json(
      { success: false, error: "Registrácia s týmto emailom už čaká na schválenie." },
      { status: 400 }
    );
  }

  // Find or create Shopify customer
  let shopifyCustomerId: string | null = null;
  try {
    const { admin } = await unauthenticated.admin(shop);
    const searchResponse = await admin.graphql(`
      query FindCustomer($query: String!) {
        customers(first: 1, query: $query) {
          edges {
            node {
              id
            }
          }
        }
      }
    `, {
      variables: { query: `email:${body.email}` },
    });

    const searchData = await searchResponse.json();
    const existingCustomer = searchData.data?.customers?.edges?.[0]?.node;

    if (existingCustomer) {
      shopifyCustomerId = existingCustomer.id;
    } else {
      // Create new customer
      const createResponse = await admin.graphql(`
        mutation CreateCustomer($input: CustomerInput!) {
          customerCreate(input: $input) {
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
            email: body.email,
            firstName: body.contactPerson.split(" ")[0] || "",
            lastName: body.contactPerson.split(" ").slice(1).join(" ") || "",
            phone: body.phone || undefined,
            metafields: [
              {
                namespace: "custom",
                key: "b2b",
                value: "false",
                type: "boolean",
              },
              {
                namespace: "custom",
                key: "b2b_status",
                value: "pending",
                type: "single_line_text_field",
              },
              {
                namespace: "custom",
                key: "b2b_company",
                value: body.companyName,
                type: "single_line_text_field",
              },
            ],
          },
        },
      });
      const createData = await createResponse.json();
      shopifyCustomerId = createData.data?.customerCreate?.customer?.id || null;
    }
  } catch (e) {
    console.error("Failed to find/create Shopify customer:", e);
  }

  // Create registration record
  await prisma.registration.create({
    data: {
      shop,
      shopifyCustomerId,
      companyName: body.companyName,
      ico: body.ico || null,
      dic: body.dic || null,
      icDph: body.icDph || null,
      contactPerson: body.contactPerson,
      email: body.email,
      phone: body.phone || null,
      address: body.address || null,
      city: body.city || null,
      postalCode: body.postalCode || null,
      country: body.country || "SK",
    },
  });

  return json({ success: true });
};
