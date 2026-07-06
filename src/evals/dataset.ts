import type { PullRequestMetadata } from "../diff/types";
import type { EvalExpectation } from "./evaluators";

export type EvalExample = {
  name: string;
  metadata: PullRequestMetadata;
  diff: string;
  expected: EvalExpectation;
};

const metadataFor = (
  number: number,
  title: string,
  description: string,
): PullRequestMetadata => ({
  number,
  title,
  description,
  author: "eval-bot",
  repository: "acme/storefront",
});

export const EVAL_DATASET: EvalExample[] = [
  {
    name: "sql-injection-in-route-handler",
    metadata: metadataFor(
      101,
      "Add order lookup endpoint",
      "Lets support staff look up orders by id.",
    ),
    diff: `diff --git a/src/app/api/orders/route.ts b/src/app/api/orders/route.ts
--- a/src/app/api/orders/route.ts
+++ b/src/app/api/orders/route.ts
@@ -1,4 +1,9 @@
 import { db } from "@/db/client";
+
+export const GET = async (request: Request) => {
+  const orderId = new URL(request.url).searchParams.get("id");
+  const rows = await db.execute(\`SELECT * FROM orders WHERE id = '\${orderId}'\`);
+  return Response.json(rows);
+};
`,
    expected: { mustFlag: [["injection", "sql", "parameterized"]] },
  },
  {
    name: "hardcoded-api-key",
    metadata: metadataFor(
      102,
      "Wire up payment client",
      "Adds the payment provider client.",
    ),
    diff: `diff --git a/src/services/server/paymentService.ts b/src/services/server/paymentService.ts
--- a/src/services/server/paymentService.ts
+++ b/src/services/server/paymentService.ts
@@ -1,3 +1,6 @@
 import { PaymentClient } from "payments-sdk";
+
+const PAYMENT_API_KEY = "sk-live-8f2ab91cd0e34f56789a4b21cdef0987";
+
+export const paymentClient = new PaymentClient({ apiKey: PAYMENT_API_KEY });
`,
    expected: { mustFlag: [["secret", "credential", "key", "hardcoded"]] },
  },
  {
    name: "cryptic-naming-and-magic-numbers",
    metadata: metadataFor(
      103,
      "Retry failed uploads",
      "Adds retry handling to the upload helper.",
    ),
    diff: `diff --git a/src/lib/upload.ts b/src/lib/upload.ts
--- a/src/lib/upload.ts
+++ b/src/lib/upload.ts
@@ -1,4 +1,12 @@
 import { uploadBlob } from "@/services/client/blobService";
+
+export const u = async (f: File, n: number) => {
+  for (let i = 0; i < 3; i++) {
+    const r = await uploadBlob(f);
+    if (r.ok) return r;
+    if (n > 4) break;
+  }
+  throw new Error("upload failed");
+};
`,
    expected: { mustFlag: [["naming", "descriptive", "magic", "constant"]] },
  },
  {
    name: "clean-refactor-should-stay-quiet",
    metadata: metadataFor(
      104,
      "Extract price formatting helper",
      "Pure refactor, no behaviour change.",
    ),
    diff: `diff --git a/src/lib/formatPrice.ts b/src/lib/formatPrice.ts
--- a/src/lib/formatPrice.ts
+++ b/src/lib/formatPrice.ts
@@ -1,2 +1,8 @@
 const CURRENCY_SYMBOL = "£";
+
+const roundToPence = (amount: number): number => Math.round(amount * 100) / 100;
+
+export const formatPrice = (amount: number): string => {
+  const roundedAmount = roundToPence(amount);
+  return \`\${CURRENCY_SYMBOL}\${roundedAmount.toFixed(2)}\`;
+};
`,
    expected: { mustFlag: [], expectClean: true },
  },
  {
    name: "eval-on-user-input",
    metadata: metadataFor(
      105,
      "Add calculator widget endpoint",
      "Evaluates pricing formulas from the request.",
    ),
    diff: `diff --git a/src/app/api/formula/route.ts b/src/app/api/formula/route.ts
--- a/src/app/api/formula/route.ts
+++ b/src/app/api/formula/route.ts
@@ -1,3 +1,7 @@
 import { NextResponse } from "next/server";
+
+export const POST = async (request: Request) => {
+  const { formula } = await request.json();
+  return NextResponse.json({ result: eval(formula) });
+};
`,
    expected: { mustFlag: [["injection", "eval", "code execution"]] },
  },
  {
    name: "renamed-cli-flag-makes-docs-stale",
    metadata: metadataFor(
      106,
      "Rename --verbose flag to --log-level",
      "Replaces the boolean flag with levels.",
    ),
    diff: `diff --git a/src/cli/flags.ts b/src/cli/flags.ts
--- a/src/cli/flags.ts
+++ b/src/cli/flags.ts
@@ -1,5 +1,5 @@
 export const CLI_FLAGS = {
-  verbose: { type: "boolean", description: "Print detailed output" },
+  logLevel: { type: "string", description: "One of: quiet, normal, debug" },
   output: { type: "string", description: "Output directory" },
 };
`,
    expected: { mustFlag: [], docsImpactExpected: true },
  },
];
