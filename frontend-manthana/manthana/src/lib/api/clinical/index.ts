/**
 * Clinical section API — drug interaction, herb-drug, trials, ICD-10, SNOMED.
 */

export {
  checkDrugInteraction,
  checkHerbDrugSafety,
  findClinicalTrials,
  suggestICD10,
  fetchEnrichedDrugInteraction,
  fetchSnomedLookup,
} from "./client";
