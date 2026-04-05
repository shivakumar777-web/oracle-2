/** CT upload wizard — patient_context_json fields aligned with backend CT services. */

export type {
  CtBodyRegion,
  CtContrastPhase,
  CtDicomBandOption,
  CtDicomFileBand,
  CtImageViewMode,
  CtProductModalityId,
  CtUploadPathKind,
  CtWizardState,
} from "@manthana/domain";

export {
  CT_PRODUCT_MODALITY_IDS,
  CT_WIZARD_INITIAL,
  buildCtPatientContextJson,
  ctBodyRegionForProductModality,
  ctDicomBandsForRegion,
  ctImageUploadHint,
  ctQualityMessage,
  declaredFileCountFromWizard,
  gatewayBackendModalityForProduct,
  gatewayModalityForCtRegion,
  isCtProductModality,
  modalityBarIdFromBackendCt,
  totalsegModelFromWizard,
  uploadTypeFromWizard,
} from "@manthana/domain";
