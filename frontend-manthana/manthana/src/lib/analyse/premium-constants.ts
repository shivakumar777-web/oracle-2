export type PremiumCtRegion =
  | "brain"
  | "chest"
  | "abdomen_pelvis"
  | "spine"
  | "vascular"
  | "full_body";

export const PREMIUM_CT_REGION_OPTIONS: Array<{
  id: PremiumCtRegion;
  label: string;
  description: string;
}> = [
  {
    id: "brain",
    label: "Brain",
    description: "Neuro-focused 3D CT structures and lesions.",
  },
  {
    id: "chest",
    label: "Chest",
    description: "Lungs, heart, mediastinum, thoracic vessels.",
  },
  {
    id: "abdomen_pelvis",
    label: "Abdomen/Pelvis",
    description: "Solid organs, bowel, pelvic structures and vessels.",
  },
  {
    id: "spine",
    label: "Spine",
    description: "Vertebrae, spinal canal, posterior elements.",
  },
  {
    id: "vascular",
    label: "Vascular",
    description: "Aorta, major arteries/veins, vessel-centric segmentation.",
  },
  {
    id: "full_body",
    label: "Full Body",
    description: "Broad 127-class segmentation pass across available anatomy.",
  },
];

export const PREMIUM_CT_REQUIRED_UPLOAD_HINT =
  "Strict 3D volumetric input only: DICOM series (ZIP) or NIfTI (.nii/.nii.gz).";

