// Ayurvedic correlations for common radiology findings (KnowledgePanel / domain hints).

export interface AyurvedaFormulation {
  name: string;
  action: string;
  reference: string;
  reference_link: string;
}

export interface AyurvedaEntry {
  classical_name: string;
  classical_name_devanagari: string;
  dominant_dosha: string;
  dosha_detail: string;
  formulations: AyurvedaFormulation[];
  classical_text?: string;
}

export const AYURVEDA_MAP: Record<string, AyurvedaEntry> = {
  consolidation: {
    classical_name: "Shwasa Roga",
    classical_name_devanagari: "श्वास रोग",
    dominant_dosha: "Kapha-Vata imbalance",
    dosha_detail: "Kapha obstruction in Pranavaha Srotas with Vata provocation.",
    formulations: [
      {
        name: "Sitopaladi Churna",
        action: "Classical anti-Kapha expectorant; reduces Ama in Rasavaha Srotas.",
        reference: "AYUSH Pharmacopoeia of India, Part I, Vol. II",
        reference_link: "https://ayush.gov.in/ayush-pharmacopoeia",
      },
      {
        name: "Vasarishta",
        action: "Bronchodilator and anti-infective; Kapha‑Vata shamak.",
        reference: "Ayurvedic Formulary of India, Part I",
        reference_link: "https://ayush.gov.in/ayush-pharmacopoeia",
      },
    ],
    classical_text: "Charaka Samhita, Chikitsa Sthana 17",
  },
  pleural_effusion: {
    classical_name: "Jalodara",
    classical_name_devanagari: "जलोदर",
    dominant_dosha: "Kapha-Pitta imbalance",
    dosha_detail: "Fluid accumulation due to impaired Agni and Kapha excess in serous cavities.",
    formulations: [
      {
        name: "Punarnavarishta",
        action: "Diuretic, reduces fluid accumulation; Kapha-hara.",
        reference: "AYUSH Pharmacopoeia of India",
        reference_link: "https://ayush.gov.in/ayush-pharmacopoeia",
      },
    ],
  },
  cardiomegaly: {
    classical_name: "Hridroga",
    classical_name_devanagari: "हृद्रोग",
    dominant_dosha: "Vata-Kapha imbalance",
    dosha_detail: "Vyana Vayu disturbance with Kapha obstruction in Hridaya.",
    formulations: [
      {
        name: "Arjunarishta",
        action: "Cardiotonic; classical formulation for Hridroga.",
        reference: "Charaka Samhita, Chikitsa Sthana 26",
        reference_link: "https://ayush.gov.in/ayush-pharmacopoeia",
      },
    ],
  },
  pneumothorax: {
    classical_name: "Vayu Sanchaya",
    classical_name_devanagari: "वायु संचय",
    dominant_dosha: "Vata",
    dosha_detail: "Accumulation and derangement of Vata in the thoracic cavities.",
    formulations: [],
    classical_text: "Charaka Samhita, Sutra Sthana 17",
  },
  tb_infiltrate: {
    classical_name: "Rajayakshma",
    classical_name_devanagari: "राजयक्ष्मा",
    dominant_dosha: "Tri-dosha",
    dosha_detail: "Advanced wasting disorder involving all three doshas with Pranavaha and Rasavaha Srotas.",
    formulations: [],
    classical_text: "Charaka Samhita, Chikitsa Sthana 8",
  },
  lung_nodule: {
    classical_name: "Granthi",
    classical_name_devanagari: "ग्रन्थि",
    dominant_dosha: "Kapha-Vata",
    dosha_detail: "Localised Kapha accumulation with Vata stagnation forming nodular swellings.",
    formulations: [],
  },
  intracranial_hemorrhage: {
    classical_name: "Shiro Roga",
    classical_name_devanagari: "शिरोरोग",
    dominant_dosha: "Vata Prakopa",
    dosha_detail: "Severe vitiation of Vata in Shira leading to acute neurological derangements.",
    formulations: [],
  },
  hepatomegaly: {
    classical_name: "Yakrit Vriddhi",
    classical_name_devanagari: "यकृत वृद्धि",
    dominant_dosha: "Pitta-Kapha",
    dosha_detail: "Enlargement of Yakrit due to Pitta aggravation with Kapha involvement.",
    formulations: [],
  },
};

export const shouldShowAyurveda = (
  domain: string | undefined,
  userProfile: string | undefined,
  findings: { label: string }[]
): boolean => {
  if (domain === "ayurveda") return true;
  if (userProfile === "BAMS" || userProfile === "BHMS") return true;

  const hasCorrelate = findings.some((f) => {
    const key = f.label.toLowerCase().replace(/\s+/g, "_");
    return key in AYURVEDA_MAP;
  });
  return hasCorrelate;
};

