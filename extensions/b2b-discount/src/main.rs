use serde::{Deserialize, Serialize};
use shopify_function::prelude::*;
use shopify_function::Result;

// Auto-generated types from run.graphql
generate_types!(
    query_path = "./src/run.graphql",
    schema_path = "./schema.graphql"
);

#[derive(Serialize, Deserialize, Default, Clone)]
struct Config {
    // Additional vendor-specific rules can be stored here
    vendor_discounts: Option<Vec<VendorDiscount>>,
}

#[derive(Serialize, Deserialize, Clone)]
struct VendorDiscount {
    vendor: String,
    discount_percentage: f64,
}

#[shopify_function_target(query_path = "src/run.graphql", schema_path = "schema.graphql")]
fn run(input: input::ResponseData) -> Result<output::FunctionRunResult> {
    let cart = &input.cart;
    
    // Check if customer is B2B
    let customer = match &cart.buyer_identity.customer {
        Some(c) => c,
        None => {
            return Ok(output::FunctionRunResult {
                discounts: vec![],
                discount_application_strategy: output::DiscountApplicationStrategy::FIRST,
            });
        }
    };

    // Check B2B metafield
    let is_b2b = customer
        .metafield
        .as_ref()
        .map(|m| m.value == "true")
        .unwrap_or(false);

    if !is_b2b {
        return Ok(output::FunctionRunResult {
            discounts: vec![],
            discount_application_strategy: output::DiscountApplicationStrategy::FIRST,
        });
    }

    // Get B2B discount percentage
    let discount_percentage = customer
        .b2b_discount
        .as_ref()
        .and_then(|m| m.value.parse::<f64>().ok())
        .unwrap_or(0.0);

    if discount_percentage <= 0.0 {
        return Ok(output::FunctionRunResult {
            discounts: vec![],
            discount_application_strategy: output::DiscountApplicationStrategy::FIRST,
        });
    }

    // Parse config for vendor-specific discounts
    let config: Config = input
        .discount_node
        .metafield
        .as_ref()
        .and_then(|m| serde_json::from_str(&m.value).ok())
        .unwrap_or_default();

    // Build discount targets
    let mut targets: Vec<output::Target> = vec![];
    
    for line in &cart.lines {
        if let Some(merchandise) = &line.merchandise {
            match merchandise {
                input::InputCartLinesMerchandise::ProductVariant(variant) => {
                    // Check for vendor-specific discount
                    let vendor_discount = config
                        .vendor_discounts
                        .as_ref()
                        .and_then(|vd| {
                            vd.iter().find(|v| {
                                variant.product.vendor
                                    .as_ref()
                                    .map(|pv| pv.to_lowercase() == v.vendor.to_lowercase())
                                    .unwrap_or(false)
                            })
                        })
                        .map(|v| v.discount_percentage);

                    let effective_discount = vendor_discount.unwrap_or(discount_percentage);
                    
                    if effective_discount > 0.0 {
                        targets.push(output::Target::ProductVariant(
                            output::ProductVariantTarget {
                                id: variant.id.clone(),
                                quantity: None,
                            },
                        ));
                    }
                }
                _ => {}
            }
        }
    }

    if targets.is_empty() {
        return Ok(output::FunctionRunResult {
            discounts: vec![],
            discount_application_strategy: output::DiscountApplicationStrategy::FIRST,
        });
    }

    Ok(output::FunctionRunResult {
        discounts: vec![output::Discount {
            message: Some(format!("B2B zľava {}%", discount_percentage)),
            targets,
            value: output::Value::Percentage(output::Percentage {
                value: discount_percentage.to_string(),
            }),
        }],
        discount_application_strategy: output::DiscountApplicationStrategy::FIRST,
    })
}
