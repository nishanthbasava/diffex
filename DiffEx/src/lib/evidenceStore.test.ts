import { describe, it, expect, beforeEach } from "vitest";
import {
  upsertFeature,
  findFeatureByLabelOrSynonym,
  findFeatureById,
  upsertPatientEvidence,
  getPatientEvidence,
} from "./evidenceStore";

describe("evidenceStore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("feature registry", () => {
    it("creates a new feature", () => {
      const f = upsertFeature({
        canonical_label: "Fever",
        feature_type: "symptom",
        value_type: "boolean",
        synonyms: ["febrile"],
      });
      expect(f.id).toBeTruthy();
      expect(f.canonical_label).toBe("Fever");
      expect(findFeatureById(f.id)?.canonical_label).toBe("Fever");
    });

    it("dedupes by canonical label case-insensitively and merges synonyms", () => {
      const first = upsertFeature({
        canonical_label: "Fever",
        feature_type: "symptom",
        value_type: "boolean",
        synonyms: ["febrile"],
      });
      const second = upsertFeature({
        canonical_label: "fever",
        feature_type: "symptom",
        value_type: "boolean",
        synonyms: ["temperature"],
      });
      expect(second.id).toBe(first.id);
      expect(second.synonyms).toEqual(expect.arrayContaining(["febrile", "temperature"]));
    });

    it("finds features by label or synonym, case-insensitively", () => {
      const f = upsertFeature({
        canonical_label: "Breathing issues",
        feature_type: "symptom",
        value_type: "boolean",
        synonyms: ["shortness of breath", "SOB"],
      });
      expect(findFeatureByLabelOrSynonym("breathing issues")?.id).toBe(f.id);
      expect(findFeatureByLabelOrSynonym("Shortness of Breath")?.id).toBe(f.id);
      expect(findFeatureByLabelOrSynonym("sob")?.id).toBe(f.id);
      expect(findFeatureByLabelOrSynonym("nonexistent")).toBeNull();
    });
  });

  describe("patient evidence", () => {
    it("stores evidence and joins the feature label on read", () => {
      const f = upsertFeature({
        canonical_label: "Cough",
        feature_type: "symptom",
        value_type: "boolean",
        synonyms: [],
      });
      upsertPatientEvidence({
        patient_id: "p1",
        feature_id: f.id,
        polarity: "present",
        value_boolean: true,
        extracted_by: "manual",
      });

      const evidence = getPatientEvidence("p1");
      expect(evidence).toHaveLength(1);
      expect(evidence[0].canonical_label).toBe("Cough");
      expect(evidence[0].polarity).toBe("present");
    });

    it("upserts by patient + feature instead of duplicating", () => {
      const f = upsertFeature({
        canonical_label: "Fever",
        feature_type: "symptom",
        value_type: "boolean",
        synonyms: [],
      });
      upsertPatientEvidence({ patient_id: "p1", feature_id: f.id, polarity: "present", extracted_by: "manual" });
      upsertPatientEvidence({ patient_id: "p1", feature_id: f.id, polarity: "absent", extracted_by: "manual" });

      const evidence = getPatientEvidence("p1");
      expect(evidence).toHaveLength(1);
      expect(evidence[0].polarity).toBe("absent");
    });

    it("scopes evidence to the requested patient", () => {
      const f = upsertFeature({
        canonical_label: "Fever",
        feature_type: "symptom",
        value_type: "boolean",
        synonyms: [],
      });
      upsertPatientEvidence({ patient_id: "p1", feature_id: f.id, polarity: "present", extracted_by: "manual" });
      upsertPatientEvidence({ patient_id: "p2", feature_id: f.id, polarity: "present", extracted_by: "manual" });

      expect(getPatientEvidence("p1")).toHaveLength(1);
      expect(getPatientEvidence("p3")).toHaveLength(0);
    });
  });
});
