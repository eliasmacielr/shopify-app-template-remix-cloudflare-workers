// app/routes/app_proxy.ts
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { shopify } from "../shopify.server";
import prisma from "../db.server";

export async function loader({ request, context, params }: LoaderFunctionArgs) {
  try {
    const { authenticate } = shopify(context);
    const { liquid, admin } = await authenticate.public.appProxy(request);
    const query = Object.fromEntries(new URL(request.url).searchParams);

    // Retrieve accessToken from Prisma
    const session = await prisma(
      context.cloudflare.env.DATABASE_URL,
    ).session.findFirst({
      where: { shop: query.shop || "ftspeed-apg.myshopify.com" },
      select: { id: true, shop: true, accessToken: true },
    });

    if (!session || !session.accessToken || !admin) {
      return json(
        { error: "No session or accessToken found" },
        { status: 404 },
      );
    }

    // Transform the params.fitment string from "2013_subaru_brz" to "2013|Subaru|BRZ"
    const fitmentParam = params.fitment || "";
    const fitmentParts = fitmentParam.split("_");
    // Capitalize the first letter of the second part and uppercase the third part
    if (fitmentParts.length === 3) {
      fitmentParts[1] =
        fitmentParts[1].charAt(0).toUpperCase() +
        fitmentParts[1].slice(1).toLowerCase();
      fitmentParts[2] = fitmentParts[2].toUpperCase();
    }
    const fitmentTag = fitmentParts.join("|");

    const response = await admin.graphql(
      `#graphql
      query GetProduct {
        products(first: 20, query: "metafield:custom.fitments:${fitmentTag}") {
          nodes {
            id
            title
            handle
            onlineStoreUrl
            featuredMedia {
              preview {
                image {
                  url
                  altText
                  width
                  height
                }
              }
            }
            priceRangeV2 {
              minVariantPrice {
                amount
                currencyCode
              }
            }
            metafield(namespace: "custom", key: "fitments") {
              value
            }
          }
        }
      }`,
    );

    const data = await response.json();
    if (data.errors) {
      console.error("GraphQL errors:", data.errors);
      return json({ error: data.errors }, { status: 500 });
    }

    const gridItems = data.data.products.nodes
      .map(
        (card_product) => `
        <li class="grid__item scroll-trigger animate--slide-in">
        {%- liquid
          assign ratio = 0.66
        -%}
          <div class="card-wrapper product-card-wrapper underline-links-hover">
            <div class="card card--card card--media color-scheme-1 gradient" style="--ratio-percent: {{ 1 | divided_by: ratio | times: 100 }}%;">
              <div class="card__inner ratio" style="--ratio-percent: {{ 1 | divided_by: ratio | times: 100 }}%;">
                <div class="card__media">
                  <div class="media media--transparent media--hover-effect">
                    <img
                      srcset="
                        ${(card_product?.featuredMedia?.preview?.image?.width ?? 0) >= 165 ? card_product?.featuredMedia?.preview?.image?.url : ""} 165w,
                        ${(card_product?.featuredMedia?.preview?.image?.width ?? 0) >= 360 ? card_product?.featuredMedia?.preview?.image?.url : ""} 360w,
                        ${(card_product?.featuredMedia?.preview?.image?.width ?? 0) >= 533 ? card_product?.featuredMedia?.preview?.image?.url : ""} 533w,
                        ${(card_product?.featuredMedia?.preview?.image?.width ?? 0) >= 720 ? card_product?.featuredMedia?.preview?.image?.url : ""} 720w,
                        ${(card_product?.featuredMedia?.preview?.image?.width ?? 0) >= 940 ? card_product?.featuredMedia?.preview?.image?.url : ""} 940w,
                        ${(card_product?.featuredMedia?.preview?.image?.width ?? 0) >= 1066 ? card_product?.featuredMedia?.preview?.image?.url : ""} 1066w,
                        ${card_product?.featuredMedia?.preview?.image?.url} ${card_product?.featuredMedia?.preview?.image?.width}w
                      "
                      src="${card_product?.featuredMedia?.preview?.image?.url}"
                      sizes="(min-width: {{ settings.page_width }}px) {{ settings.page_width | minus: 130 | divided_by: 4 }}px, (min-width: 990px) calc((100vw - 130px) / 4), (min-width: 750px) calc((100vw - 120px) / 3), calc((100vw - 35px) / 2)"
                      alt="${card_product?.featuredMedia?.preview?.image?.altText}"
                      class="motion-reduce"
                      {% unless lazy_load == false %}
                        loading="lazy"
                      {% endunless %}
                      width="${card_product?.featuredMedia?.preview?.image?.width}"
                      height="${card_product?.featuredMedia?.preview?.image?.height}"
                    >
                  </div>
                </div>
                <div class="card__content">
                  <div class="card__information">
                    <h3
                      class="card__heading"
                      {% if card_product.featured_media == null and settings.card_style == 'standard' %}
                        id="title-{{ section_id }}-${card_product?.id}"
                      {% endif %}
                    >
                      <a
                        href="${card_product?.onlineStoreUrl}"
                        id="StandardCardNoMediaLink-{{ section_id }}-${card_product?.id}"
                        class="full-unstyled-link"
                        aria-labelledby="StandardCardNoMediaLink-{{ section_id }}-${card_product?.id} NoMediaStandardBadge-{{ section_id }}-${card_product?.id}"
                      >
                        ${card_product?.title}
                      </a>
                    </h3>
                    <div class="card-information">
                      <span class="caption-large light"></span>
                      <div class="price">
                        <div class="price__container">
                          <div class="price__regular">
                            <span class="visually-hidden visually-hidden--inline">Regular price</span>
                            <span class="price-item price-item--regular">
                              ${card_product?.priceRangeV2?.minVariantPrice?.amount} ${card_product?.priceRangeV2?.minVariantPrice?.currencyCode}
                            </span>
                          </div>
                          <div class="price__sale">
                            <span class="visually-hidden visually-hidden--inline">Regular price</span>
                            <span>
                              <s class="price-item price-item--regular">
                                ${card_product?.priceRangeV2?.minVariantPrice?.amount} ${card_product?.priceRangeV2?.minVariantPrice?.currencyCode}
                              </s>
                            </span>
                            <span class="visually-hidden visually-hidden--inline">Sale price</span>
                            <span class="price-item price-item--sale price-item--last">
                              ${card_product?.priceRangeV2?.minVariantPrice?.amount} ${card_product?.priceRangeV2?.minVariantPrice?.currencyCode}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="card__content">
                <div class="card__information">
                  <h3
                    class="card__heading"
                    {% if card_product.featured_media == null and settings.card_style == 'standard' %}
                      id="title-{{ section_id }}-${card_product?.id}"
                    {% endif %}
                  >
                    <a
                      href="${card_product?.onlineStoreUrl}"
                      id="StandardCardNoMediaLink-{{ section_id }}-${card_product?.id}"
                      class="full-unstyled-link"
                      aria-labelledby="StandardCardNoMediaLink-{{ section_id }}-${card_product?.id} NoMediaStandardBadge-{{ section_id }}-${card_product?.id}"
                    >
                      ${card_product?.title}
                    </a>
                  </h3>
                  <div class="card-information">
                    <span class="caption-large light"></span>
                    <div class="price">
                      <div class="price__container">
                        <div class="price__regular">
                          <span class="visually-hidden visually-hidden--inline">Regular price</span>
                          <span class="price-item price-item--regular">
                            ${card_product?.priceRangeV2?.minVariantPrice?.amount} ${card_product?.priceRangeV2?.minVariantPrice?.currencyCode}
                          </span>
                        </div>
                        <div class="price__sale">
                          <span class="visually-hidden visually-hidden--inline">Regular price</span>
                          <span>
                            <s class="price-item price-item--regular">
                              ${card_product?.priceRangeV2?.minVariantPrice?.amount} ${card_product?.priceRangeV2?.minVariantPrice?.currencyCode}
                            </s>
                          </span>
                          <span class="visually-hidden visually-hidden--inline">Sale price</span>
                          <span class="price-item price-item--sale price-item--last">
                            ${card_product?.priceRangeV2?.minVariantPrice?.amount} ${card_product?.priceRangeV2?.minVariantPrice?.currencyCode}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </li>
      `,
      )
      .join("");

    const collectionParam = params.collection_path
      ? params.collection_path.split("/").pop()
      : null;

    console.log("Collection Param:", collectionParam);

    let collectionTree = "";
    if (collectionParam) {
      try {
        const response = await admin.graphql(
          `#graphql
          query GetCollection {
            collectionByIdentifier(identifier:  {
              handle: "engine"
            }) {
              id
            }
          }`,
        );

        const data = await response.json();
        if (data.errors) {
          console.error("GraphQL errors:", data.errors);
          return json({ error: data.errors }, { status: 500 });
        }

        const collectionId = data.data.collectionByIdentifier.id
          .split("/")
          .pop();

        console.log("Collection ID Retrieved:", collectionId);

        collectionTree = `<div class="page-width">
          {%- assign collection_tree_value = shop.metafields.collection_tree.collection_tree.value -%}
          {%- assign nodes = collection_tree_value.nodes -%}
          {%- assign collection_id = ${collectionId} | append: '' -%}

          {%- if collection_tree_value.parentChildren[collection_id] -%}
            <h3 class="collection-tree__title center">
              {{ 'sections.collection_template.shop_upgrades_by_category' | t: collection_title: collection.title }}
            </h3>
          {%- endif -%}

          <div class="collection-tree__parent">
            {% assign subcollections_ids = collection_tree_value.parentChildren[collection_id] %}
            {%- for id in subcollections_ids -%}
              {%- assign subcollection_id = id | append: '' -%}
              {%- assign subcollection = nodes[subcollection_id] -%}
              <div class="collection-tree__child center">
                {%- if subcollection.i -%}
                  <img
                    src="{{ subcollection.i }}"
                    alt="{{ subcollection.t | escape }} image"
                    class="motion-reduce"
                    width="120"
                    height="120"
                  >
                {%- endif -%}
                {%- unless collection_tree_value.parentChildren[subcollection_id] -%}
                  <a
                    href="{{ routes.collections_url }}/{{ collection.handle }}/{{ subcollection.h }}"
                    class="full-unstyled-link font-body-bold"
                  >
                    {{- subcollection.t -}}
                  </a>
                {%- else -%}
                  <p class="subcollection__title font-body-bold">{{ subcollection.t }}</p>
                  <div
                    class="collection-tree__grandchildren center"
                    style="--link-primary-color: {{ section.settings.link_primary_color }}"
                  >
                    {%- for child_id in collection_tree_value.parentChildren[subcollection_id] limit: 5 -%}
                      {%- assign child_collection = nodes[child_id] -%}
                      <a
                        href="{{ routes.collections_url }}/{{ collection.handle }}/{{ subcollection.h }}/{{ child_collection.h }}"
                        class="full-unstyled-link"
                      >
                        {{- child_collection.t -}}
                      </a>
                    {%- endfor -%}
                  </div>
                  <a
                    href="{{ routes.collections_url }}/{{ collection.handle }}/{{ subcollection.h }}"
                    class="full-unstyled-link font-body-bold"
                    >Shop All</a
                  >
                {%- endunless -%}
                {% comment %} {{ collection_tree_value.parentChildren[subcollection_id] }} {% endcomment %}
              </div>
            {%- endfor -%}
          </div>
        </div>`;
      } catch (error) {
        console.error("Error fetching collection tree:", error);
      }
    }

    const mainCollectionProductGrid = `
      <div class="page-width">
        <div class="collection-hero color-scheme-1 gradient">
          <div class="collection-hero__inner page-width scroll-trigger animate--fade-in">
            <div class="collection-hero__text-wrapper">
              <h1 class="collection-hero__title"><span class="visually-hidden">Collection: </span>${fitmentParts?.[0]} ${fitmentParts?.[1]} ${fitmentParts?.[2]}</h1>
            </div>
          </div>
        </div>
        ${collectionTree}
        <ul
          id="product-grid"
          data-id="{{ section.id }}"
          class="grid product-grid grid--2-col-tablet-down grid--4-col-desktop"
        >
          ${gridItems}
        </ul>
      </div>
    `;

    return liquid(mainCollectionProductGrid, {
      status: 200,
      headers: { "Content-Type": "application/liquid" },
    });
  } catch (error) {
    console.error("Error:", error);
    return json({ error: error.message, shop: query.shop }, { status: 500 });
  }
}
