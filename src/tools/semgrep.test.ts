import { describe, expect, test } from "bun:test";

import type { DiffFile } from "../diff/types";
import { createSemgrepTool, scanWithBuiltinRules } from "./semgrep";

const fileWith = (path: string, addedLines: string[]): DiffFile => ({
  path,
  status: "modified",
  hunks: [
    {
      header: "",
      lines: addedLines.map((content, index) => ({
        kind: "added",
        content,
        newLineNumber: index + 1,
      })),
    },
  ],
});

describe("scanWithBuiltinRules", () => {
  test("flags injection patterns with their OWASP category", () => {
    const findings = scanWithBuiltinRules([
      fileWith("src/route.ts", [
        "const result = eval(userFormula);",
        "await db.execute(`SELECT * FROM orders WHERE id = '${orderId}'`);",
      ]),
    ]);

    expect(findings).toHaveLength(2);
    expect(
      findings.every((finding) => finding.owaspCategory === "A03 Injection"),
    ).toBe(true);
    expect(findings[1]).toMatchObject({
      file: "src/route.ts",
      line: 2,
      severity: "error",
    });
  });

  test("flags redaction placeholders as hardcoded credentials", () => {
    const findings = scanWithBuiltinRules([
      fileWith("src/pay.ts", ['const key = "[REDACTED:api-key]";']),
    ]);

    expect(findings[0]!.ruleId).toBe("generic.secrets.hardcoded-credential");
  });

  test("ignores removed and context lines", () => {
    const file: DiffFile = {
      path: "src/old.ts",
      status: "modified",
      hunks: [
        {
          header: "",
          lines: [
            { kind: "removed", content: "eval(dangerous);", oldLineNumber: 1 },
            {
              kind: "context",
              content: "eval(alsoDangerousButPreExisting);",
              oldLineNumber: 2,
              newLineNumber: 2,
            },
          ],
        },
      ],
    };

    expect(scanWithBuiltinRules([file])).toEqual([]);
  });

  test("stays silent on clean code", () => {
    const findings = scanWithBuiltinRules([
      fileWith("src/clean.ts", [
        "const rows = await db.query('SELECT * FROM orders WHERE id = $1', [orderId]);",
      ]),
    ]);

    expect(findings).toEqual([]);
  });
});

describe("createSemgrepTool", () => {
  test("returns JSON findings and honours the paths filter", async () => {
    const files = [
      fileWith("src/a.ts", ["eval(x);"]),
      fileWith("src/b.ts", ["eval(y);"]),
    ];
    const semgrepTool = createSemgrepTool(files);

    const scopedReport = JSON.parse(
      await semgrepTool.invoke({ paths: ["src/b.ts"] }),
    );

    expect(scopedReport).toHaveLength(1);
    expect(scopedReport[0].file).toBe("src/b.ts");
  });
});
