import {
  lookupBookByIsbnCdp,
  type IsbnLookupDebugCandidate,
  type LookupSourceId,
} from "./isbn-lookup-cdp.js";

export type IsbnLookupResult = {
  title: string | null;
  author: string | null;
  publisher: string | null;
  publishYear: number | null;
  coverUrl: string | null;
  source: LookupSourceId | null;
};

export type LookupSourceLabel = {
  id: LookupSourceId;
  label: string;
};

export type IsbnLookupCandidate = {
  item: IsbnLookupResult;
  matchedSource: LookupSourceLabel | null;
  foundFields: string[];
  completenessScore: number;
};

export type IsbnLookupResponse = {
  item: IsbnLookupResult | null;
  candidates: IsbnLookupCandidate[];
  debugCandidates: IsbnLookupDebugCandidate[];
  attemptedSources: LookupSourceLabel[];
  matchedSource: LookupSourceLabel | null;
  foundFields: string[];
};

const attemptedSources: LookupSourceLabel[] = [
  { id: "openlibrary", label: "Open Library" },
  { id: "googlebooks", label: "Google Books" },
  { id: "taaze", label: "讀冊" },
  { id: "books_tw", label: "博客來" },
  { id: "tenlong", label: "天瓏書店" },
  { id: "sanmin", label: "三民書局" },
  { id: "cinii", label: "CiNii Books" },
  { id: "amazon_jp", label: "Amazon.co.jp" },
  { id: "amazon", label: "Amazon" },
];

function getSourceLabel(source: LookupSourceId | null) {
  return attemptedSources.find((item) => item.id === source) ?? null;
}

function getFoundFields(item: IsbnLookupResult | null) {
  if (!item) {
    return [];
  }

  const fields: string[] = [];

  if (item.title?.trim()) {
    fields.push("書名");
  }
  if (item.author?.trim()) {
    fields.push("作者");
  }
  if (item.publisher?.trim()) {
    fields.push("出版社");
  }
  if (typeof item.publishYear === "number") {
    fields.push("出版年");
  }
  if (item.coverUrl?.trim()) {
    fields.push("封面");
  }

  return fields;
}

function getCompletenessScore(item: IsbnLookupResult | null) {
  return getFoundFields(item).length;
}

function normalizeCoverUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return value.startsWith("http://") ? value.replace("http://", "https://") : value;
}

function normalizeYear(value: string | undefined) {
  if (!value) {
    return null;
  }

  const match = value.match(/\d{4}/);
  return match ? Number(match[0]) : null;
}

function normalizeCandidateKey(item: IsbnLookupResult) {
  return [
    item.title?.trim().toLowerCase() ?? "",
    item.author?.trim().toLowerCase() ?? "",
    item.publisher?.trim().toLowerCase() ?? "",
    String(item.publishYear ?? ""),
  ].join("|");
}

function dedupeCandidates(items: IsbnLookupResult[]) {
  const seen = new Set<string>();
  const results: IsbnLookupResult[] = [];

  for (const item of items) {
    const key = normalizeCandidateKey(item);

    if (!item.title?.trim()) {
      continue;
    }

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    results.push(item);
  }

  return results;
}

function toCandidate(item: IsbnLookupResult): IsbnLookupCandidate {
  return {
    item,
    matchedSource: getSourceLabel(item.source),
    foundFields: getFoundFields(item),
    completenessScore: getCompletenessScore(item),
  };
}

function getSourcePriority(source: LookupSourceId | null) {
  switch (source) {
    case "books_tw":
      return 6;
    case "taaze":
      return 5;
    case "tenlong":
      return 4;
    case "sanmin":
      return 3;
    case "googlebooks":
      return 2;
    case "openlibrary":
      return 1;
    default:
      return 0;
  }
}

function compareCandidates(left: IsbnLookupCandidate, right: IsbnLookupCandidate) {
  return (
    right.completenessScore - left.completenessScore ||
    Number(Boolean(right.item.coverUrl)) - Number(Boolean(left.item.coverUrl)) ||
    Number(Boolean(right.item.author)) - Number(Boolean(left.item.author)) ||
    Number(Boolean(right.item.publisher)) - Number(Boolean(left.item.publisher)) ||
    getSourcePriority(right.item.source) - getSourcePriority(left.item.source)
  );
}

async function lookupOpenLibrary(isbn: string): Promise<IsbnLookupResult | null> {
  let response: Response;

  try {
    response = await fetch(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`,
    );
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as Record<string, any>;
  const book = payload[`ISBN:${isbn}`];

  if (!book) {
    return null;
  }

  return {
    title: book.title ?? null,
    author: Array.isArray(book.authors)
      ? book.authors.map((item: any) => item.name).join(", ")
      : null,
    publisher: Array.isArray(book.publishers)
      ? book.publishers.map((item: any) => item.name).join(", ")
      : null,
    publishYear: normalizeYear(book.publish_date),
    coverUrl: normalizeCoverUrl(
      book.cover?.large ?? book.cover?.medium ?? book.cover?.small ?? null,
    ),
    source: "openlibrary",
  };
}

async function lookupGoogleBooks(isbn: string): Promise<IsbnLookupResult | null> {
  let response: Response;

  try {
    response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    items?: Array<{
      volumeInfo?: {
        title?: string;
        authors?: string[];
        publisher?: string;
        publishedDate?: string;
        imageLinks?: {
          thumbnail?: string;
          smallThumbnail?: string;
        };
      };
    }>;
  };

  const volume = payload.items?.[0]?.volumeInfo;

  if (!volume) {
    return null;
  }

  return {
    title: volume.title ?? null,
    author: volume.authors?.join(", ") ?? null,
    publisher: volume.publisher ?? null,
    publishYear: normalizeYear(volume.publishedDate),
    coverUrl: normalizeCoverUrl(
      volume.imageLinks?.thumbnail ?? volume.imageLinks?.smallThumbnail ?? null,
    ),
    source: "googlebooks",
  };
}

function stripHtmlTags(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function lookupBooksTwSearch(isbn: string): Promise<IsbnLookupResult[]> {
  let response: Response;

  try {
    response = await fetch(`https://search.books.com.tw/search/query/key/${isbn}/cat/books`);
  } catch {
    return [];
  }

  if (!response.ok) {
    return [];
  }

  const html = await response.text();
  const publisherMatch = html.match(
    /id="adv_publishing_origin"[\s\S]*?<label[^>]*><div>([^<(]+)\(\d+\)/i,
  );
  const sharedPublisher = publisherMatch ? decodeHtmlEntities(stripHtmlTags(publisherMatch[1])) : null;

  const blockMatches = Array.from(
    html.matchAll(/<div class="table-td" id="prod-itemlist-[^"]+">([\s\S]*?)<\/div>\s*<\/div>\s*<div class="table-tr">/gi),
  );

  const items = blockMatches
    .map((match): IsbnLookupResult | null => {
      const block = match[1] ?? "";
      const titleMatch = block.match(/<h4><a[^>]*title="([^"]+)"/i);
      const authorMatch = block.match(/<p class="author">([\s\S]*?)<\/p>/i);
      const imageMatch = block.match(/data-src="([^"]+)"/i);

      const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : null;
      const author = authorMatch ? decodeHtmlEntities(stripHtmlTags(authorMatch[1])) : null;
      const coverUrl = imageMatch ? normalizeCoverUrl(decodeHtmlEntities(imageMatch[1])) : null;

      if (!title) {
        return null;
      }

      return {
        title,
        author,
        publisher: sharedPublisher,
        publishYear: null,
        coverUrl,
        source: "books_tw" as const,
      };
    })
    .filter((item): item is IsbnLookupResult => Boolean(item));

  return items;
}

function extractJsonLdObjects(html: string) {
  const matches = Array.from(
    html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
  );

  const objects: any[] = [];

  for (const match of matches) {
    const raw = match[1]?.trim();
    if (!raw) {
      continue;
    }

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        objects.push(...parsed);
      } else {
        objects.push(parsed);
      }
    } catch {
      continue;
    }
  }

  return objects;
}

function normalizeAuthor(value: unknown) {
  if (typeof value === "string") {
    return value.trim() || null;
  }

  if (Array.isArray(value)) {
    const names = value
      .map((item) =>
        typeof item === "string"
          ? item.trim()
          : typeof item?.name === "string"
            ? item.name.trim()
            : "",
      )
      .filter(Boolean);

    return names.length > 0 ? names.join(", ") : null;
  }

  if (typeof value === "object" && value && typeof (value as { name?: unknown }).name === "string") {
    return (value as { name: string }).name.trim() || null;
  }

  return null;
}

function collectStructuredBookCandidates(
  value: unknown,
  source: LookupSourceId,
): IsbnLookupResult[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectStructuredBookCandidates(item, source));
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  const record = value as Record<string, unknown>;
  const nestedResults = Object.values(record).flatMap((item) =>
    collectStructuredBookCandidates(item, source),
  );
  const typeValue = record["@type"];
  const types = Array.isArray(typeValue) ? typeValue : [typeValue];
  const looksLikeBook = types.some(
    (type) =>
      typeof type === "string" &&
      ["Book", "Product", "CreativeWork", "ItemList", "ListItem"].includes(type),
  );

  if (!looksLikeBook) {
    return nestedResults;
  }

  const bookLike =
    (record.item && typeof record.item === "object" ? record.item : null) ??
    (record.itemOffered && typeof record.itemOffered === "object" ? record.itemOffered : null) ??
    record;
  const book = bookLike as Record<string, unknown>;
  const title =
    typeof book.name === "string"
      ? book.name.trim() || null
      : typeof book.headline === "string"
        ? book.headline.trim() || null
        : null;
  const author = normalizeAuthor(book.author);
  const publisher =
    typeof book.publisher === "string"
      ? book.publisher.trim() || null
      : typeof (book.publisher as { name?: unknown })?.name === "string"
        ? ((book.publisher as { name: string }).name.trim() || null)
        : null;
  const publishYear = normalizeYear(
    typeof book.datePublished === "string"
      ? book.datePublished
      : typeof book.releaseDate === "string"
        ? book.releaseDate
        : undefined,
  );
  const coverUrl = normalizeCoverUrl(
    typeof book.image === "string"
      ? book.image
      : Array.isArray(book.image)
        ? book.image.find((entry) => typeof entry === "string") ?? null
        : typeof (book.image as { url?: unknown })?.url === "string"
          ? ((book.image as { url: string }).url ?? null)
          : null,
  );

  if (!title) {
    return nestedResults;
  }

  return [
    ...nestedResults,
    {
      title,
      author,
      publisher,
      publishYear,
      coverUrl,
      source,
    },
  ];
}

async function lookupTaazeSearch(isbn: string): Promise<IsbnLookupResult[]> {
  let response: Response;

  try {
    response = await fetch(
      `https://www.taaze.tw/rwd_searchResult.html?keyword%5B%5D=${encodeURIComponent(isbn)}&keyType%5B%5D=0`,
    );
  } catch {
    return [];
  }

  if (!response.ok) {
    return [];
  }

  const html = await response.text();
  const structuredCandidates = dedupeCandidates(
    collectStructuredBookCandidates(extractJsonLdObjects(html), "taaze"),
  );

  if (structuredCandidates.length > 0) {
    return structuredCandidates;
  }

  const productMatches = Array.from(
    html.matchAll(/<a[^>]+href="([^"]*\/products\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi),
  );

  const items = productMatches
    .map((match): IsbnLookupResult | null => {
      const href = decodeHtmlEntities(match[1] ?? "");
      const anchorHtml = match[0] ?? "";
      const index = match.index ?? 0;
      const snippet = html.slice(Math.max(0, index - 600), Math.min(html.length, index + 2200));
      const titleFromAttr = anchorHtml.match(/title="([^"]+)"/i)?.[1] ?? null;
      const titleFromText = stripHtmlTags(match[2] ?? "");
      const authorMatch =
        snippet.match(/作者(?:[^<]{0,20})<\/[^>]+>\s*<[^>]+>([\s\S]*?)<\/[^>]+>/i) ??
        snippet.match(/作者[:：]\s*([^<\n]+)/i);
      const publisherMatch =
        snippet.match(/出版社(?:[^<]{0,20})<\/[^>]+>\s*<[^>]+>([\s\S]*?)<\/[^>]+>/i) ??
        snippet.match(/出版社[:：]\s*([^<\n]+)/i);
      const yearMatch =
        snippet.match(/出版(?:日期|年)[:：]?\s*([^<\n]+)/i) ??
        snippet.match(/(\d{4})[\/\-年]/i);
      const imageMatch =
        snippet.match(/<(?:img|source)[^>]+(?:data-src|src)="([^"]+)"/i) ??
        anchorHtml.match(/<(?:img|source)[^>]+(?:data-src|src)="([^"]+)"/i);
      const title =
        decodeHtmlEntities((titleFromAttr ?? titleFromText).trim()) || null;
      const author = authorMatch
        ? decodeHtmlEntities(stripHtmlTags(authorMatch[1])).trim() || null
        : null;
      const publisher = publisherMatch
        ? decodeHtmlEntities(stripHtmlTags(publisherMatch[1])).trim() || null
        : null;
      const publishYear = normalizeYear(yearMatch?.[1]);
      const coverUrl = normalizeCoverUrl(imageMatch?.[1] ? decodeHtmlEntities(imageMatch[1]) : null);

      if (!title || !/\/products\//i.test(href)) {
        return null;
      }

      return {
        title,
        author,
        publisher,
        publishYear,
        coverUrl,
        source: "taaze",
      };
    })
    .filter((item): item is IsbnLookupResult => Boolean(item));

  return dedupeCandidates(items);
}

async function lookupTenlong(isbn: string): Promise<IsbnLookupResult | null> {
  let response: Response;

  try {
    response = await fetch(`https://www.tenlong.com.tw/products/${isbn}`);
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  const html = await response.text();
  const objects = extractJsonLdObjects(html);
  const book = objects.find((item) => {
    const typeValue = item?.["@type"];
    const types = Array.isArray(typeValue) ? typeValue : [typeValue];
    return types.some((type) => typeof type === "string" && /Book|Product/i.test(type));
  });

  if (!book) {
    return null;
  }

  const name =
    typeof book.name === "string" && book.name.trim().length > 0 ? book.name.trim() : null;
  const author = normalizeAuthor(book.author);
  const publisher =
    typeof book.publisher === "string"
      ? book.publisher.trim() || null
      : typeof book.publisher?.name === "string"
        ? book.publisher.name.trim() || null
        : null;
  const publishYear = normalizeYear(
    typeof book.datePublished === "string" ? book.datePublished : undefined,
  );
  const coverUrl = normalizeCoverUrl(
    typeof book.image === "string"
      ? book.image
      : Array.isArray(book.image)
        ? book.image.find((value: unknown) => typeof value === "string") ?? null
        : null,
  );

  if (!name) {
    return null;
  }

  return {
    title: name,
    author,
    publisher,
    publishYear,
    coverUrl,
    source: "tenlong",
  };
}

export async function lookupBookByIsbn(
  isbn: string,
  includeDebug = false,
): Promise<IsbnLookupResponse> {
  const normalizedIsbn = isbn.replace(/[^0-9Xx]/g, "");
  const debugCandidates: IsbnLookupDebugCandidate[] = [];

  if (!normalizedIsbn) {
    return {
      item: null,
      candidates: [],
      debugCandidates,
      attemptedSources,
      matchedSource: null,
      foundFields: [],
    };
  }

  const results = await Promise.all([
    lookupOpenLibrary(normalizedIsbn),
    lookupGoogleBooks(normalizedIsbn),
    lookupTenlong(normalizedIsbn),
    lookupTaazeSearch(normalizedIsbn),
    lookupBooksTwSearch(normalizedIsbn),
  ]);

  const cdpResults = await lookupBookByIsbnCdp(
    normalizedIsbn,
    includeDebug ? debugCandidates : undefined,
  );

  const dedupedCandidates = dedupeCandidates(
    [...results.flat(), ...cdpResults].filter((item): item is IsbnLookupResult => Boolean(item)),
  )
    .map(toCandidate)
    .sort(compareCandidates);

  const selected = dedupedCandidates[0] ?? null;

  return {
    item: selected?.item ?? null,
    candidates: dedupedCandidates,
    debugCandidates,
    attemptedSources,
    matchedSource: selected?.matchedSource ?? null,
    foundFields: selected?.foundFields ?? [],
  };
}
