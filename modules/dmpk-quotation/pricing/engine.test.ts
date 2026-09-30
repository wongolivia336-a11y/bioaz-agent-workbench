import assert from "node:assert/strict";
import test from "node:test";
import { evaluatePricing } from "../../../lib/workbench/pricingEngine.ts";
import { baCoefficient, elisaPricing, perPlatePricing, perSamplePricing, regionCoefficient } from "./policy.ts";
import { buildCollectionChargeDrafts, totalUniqueAnimals, validateStudyFacts, type DmpkStudyFacts } from "./facts.ts";
import { compileAda, compileAssayTask, compileClinicalPathology, compilePathology, compileReport } from "./rules2.ts";

test("minimum billing applies only when the task opts in", () => {
  const eligible = evaluatePricing(perSamplePricing({ actualQty: 18, unitPrice: 35, minimumQty: 30, minimumEligible: true }));
  const ordinary = evaluatePricing(perSamplePricing({ actualQty: 18, unitPrice: 35, minimumQty: 30, minimumEligible: false }));
  assert.equal(eligible?.billedQty, 30);
  assert.equal(eligible?.amount, 1050);
  assert.equal(ordinary?.billedQty, 18);
  assert.equal(ordinary?.amount, 630);
});

test("plate pricing rounds the plate count up", () => {
  const result = evaluatePricing(perPlatePricing({ actualQty: 43, capacity: 42, platePrice: 800 }));
  assert.equal(result?.billedQty, 43);
  assert.equal(result?.amount, 1600);
});

test("ELISA follows the 2.0 homogenization tiers", () => {
  assert.equal(evaluatePricing(elisaPricing(30, false))?.amount, 1000);
  assert.equal(evaluatePricing(elisaPricing(31, false))?.amount, 1085);
  assert.equal(evaluatePricing(elisaPricing(30, true))?.amount, 1350);
  assert.equal(evaluatePricing(elisaPricing(31, true))?.amount, 1395);
});

test("BA and region coefficients compose, while hard cost skips region", () => {
  const region = regionCoefficient("apac")!;
  const normal = evaluatePricing(perSamplePricing({ actualQty: 10, unitPrice: 10, coefficients: [baCoefficient, region] }));
  const hardCost = evaluatePricing(perSamplePricing({ actualQty: 10, unitPrice: 10, coefficients: [baCoefficient, region], hardCost: true }));
  assert.equal(normal?.amount, 195);
  assert.equal(hardCost?.amount, 150);
});

test("CNY catalog prices convert to USD before coefficients", () => {
  const result = evaluatePricing(perSamplePricing({ actualQty: 1, unitPrice: 650, sourceCurrency: "CNY" }));
  assert.equal(result?.amount, 100);
  assert.equal(result?.currency, "USD");
});

test("shared PK and TK collection creates one physical collection charge", () => {
  const facts: DmpkStudyFacts = {
    groups: [{ id: "g1", label: "主组", species: "大鼠", animalCount: 6, role: "main", services: ["tox", "tk", "pk"] }],
    collections: [{ id: "d7", label: "D7 共用采血", kind: "blood", timepoint: "D7", groupIds: ["g1"], animalCount: 6 }],
    assayTasks: [
      { id: "pk-d7", kind: "pk", analyte: "A", matrix: "血浆", method: "LC-MS/MS", actualSampleQty: 6, collectionEventId: "d7" },
      { id: "tk-d7", kind: "tk", analyte: "A", matrix: "血浆", method: "LC-MS/MS", actualSampleQty: 6, collectionEventId: "d7" },
    ],
  };
  assert.deepEqual(validateStudyFacts(facts), []);
  assert.equal(buildCollectionChargeDrafts(facts).length, 1);
  assert.deepEqual(buildCollectionChargeDrafts(facts)[0].taskIds, ["pk-d7", "tk-d7"]);
  assert.equal(totalUniqueAnimals(facts), 6);
});

test("tasks without real samples are blocked instead of billed as zero", () => {
  const facts: DmpkStudyFacts = {
    groups: [],
    collections: [],
    assayTasks: [{ id: "empty", kind: "ba", analyte: "A", matrix: "血浆", method: "ELISA", actualSampleQty: 0 }],
  };
  assert.equal(validateStudyFacts(facts)[0]?.severity, "blocking");
});

test("method development charges 50 percent for each additional matrix", () => {
  const rows = compileAssayTask({ id: "a", kind: "pk", analyte: "A", matrices: ["血浆", "肝", "肾"], method: "LC-MS/MS", actualSampleQty: 20, pricingMode: "per-sample", methodBasePrice: 1000, sampleUnitPrice: 10, minimumEligible: true }, { region: "domestic" });
  assert.equal(rows[0].amount, 2000);
  assert.equal(rows[1].billedQty, 30);
});

test("BA applies 1.5 to method and detection, then region coefficient", () => {
  const rows = compileAssayTask({ id: "ba", kind: "ba", analyte: "A", matrices: ["血浆"], method: "LC-MS/MS", actualSampleQty: 10, pricingMode: "per-sample", methodBasePrice: 1000, sampleUnitPrice: 10 }, { region: "apac" });
  assert.equal(rows[0].amount, 1950);
  assert.equal(rows[1].amount, 195);
});

test("clinical pathology prevents duplicate hematology tiers", () => {
  const rows = compileClinicalPathology([{ id: "basic", kind: "hematology-basic", actualSampleQty: 2, unitPrice: 30 }, { id: "retic", kind: "hematology-retic", actualSampleQty: 2, unitPrice: 40 }], { region: "domestic" });
  assert.equal(rows[0].status, "excluded");
  assert.equal(rows[1].amount, 80);
});

test("ADA stages are calculated independently by plate", () => {
  const rows = compileAda({ screening: { samples: 43, capacity: 42, platePrice: 100 }, confirmation: { samples: 5, capacity: 42, platePrice: 200 }, titer: { samples: 9, platePrice: 80 } }, { region: "domestic" });
  assert.deepEqual(rows.map((row) => row.amount), [200, 200, 160]);
});

test("pathology bundle inclusion prevents duplicate charges and hard cost skips region", () => {
  const rows = compilePathology([{ id: "n", kind: "necropsy", qty: 2, unitPrice: 100 }, { id: "f", kind: "fixation", qty: 2, unitPrice: 50, includedBy: "病理组合价" }], { region: "europe-americas" });
  assert.equal(rows[0].amount, 200);
  assert.equal(rows[1].status, "excluded");
});

test("BA Only report is 15 percent while unresolved integrated BA report stays pending", () => {
  assert.equal(compileReport({ kind: "ba-only", baMethodAndDetectionTotal: 1000 }, { region: "domestic" })[0].amount, 150);
  assert.equal(compileReport({ kind: "integrated", baMergedIntoIntegrated: true }, { region: "domestic" })[0].status, "pending-confirm");
});
