import { DOMAIN_UNIVERSAL_SOURCES } from "./universal-search-sources";

export interface ResearchDomain {
  id: string;
  label: string;
  symbol: string;
  subtitle: string;
  tradition: string;
  color: string;
  glowColor: string;
  bgGradient: string;
  subdomains: ResearchSubdomain[];
  defaultSources: string[];
  sanskritName?: string;
  arabicName?: string;
  tamilName?: string;
}

export interface ResearchSubdomain {
  id: string;
  label: string;
  labelNative?: string;
  category: string;
  description: string;
}

export interface ResearchIntent {
  id: string;
  icon: string;
  label: string;
  description: string;
  tags: string[];
  promptModifier: string;
}

export interface SourceFilter {
  id: string;
  label: string;
  url?: string;
  domains: string[];
  description: string;
  isPrimary: boolean;
}

export interface ResearchTemplate {
  id: string;
  label: string;
  subtitle: string;
  domains: string[];
  subdomains: Record<string, string[]>;
  intent: string;
  depth: DepthLevel;
  sources: string[];
  citationStyle: CitationStyle;
  sampleQuery: string;
}

export type DepthLevel = "focused" | "comprehensive" | "exhaustive";
export type OutputFormat = "structured" | "summary" | "bullets";
export type CitationStyle = "vancouver" | "apa" | "mla" | "icmr" | "harvard";

// NOTE: Domain, subdomain, intent, template, and depth definitions follow
// DEEP_RESEARCH_BUILD.md; Universal Search pill IDs follow manthana-universal-search-map.md
// (see DOMAIN_UNIVERSAL_SOURCES).

export const RESEARCH_DOMAINS: ResearchDomain[] = [
  {
    id: "allopathy",
    label: "Allopathy",
    symbol: "⚕",
    subtitle: "Evidence-Based Modern Medicine",
    tradition: "Modern",
    color: "#00C4B0",
    glowColor: "rgba(0, 196, 176, 0.15)",
    bgGradient:
      "radial-gradient(ellipse at 50% 0%, rgba(0,196,176,0.08), transparent 70%)",
    defaultSources: DOMAIN_UNIVERSAL_SOURCES.allopathy,
    subdomains: [
      { id: "general-medicine", label: "General Medicine", category: "Clinical", description: "Broad internal medicine, systemic diseases, clinical management" },
      { id: "cardiology", label: "Cardiology", category: "Clinical", description: "Heart disease, ECG, interventional, heart failure, arrhythmias" },
      { id: "neurology", label: "Neurology", category: "Clinical", description: "CNS/PNS disorders, stroke, epilepsy, neurodegenerative diseases" },
      { id: "pulmonology", label: "Pulmonology", category: "Clinical", description: "Respiratory diseases, COPD, asthma, ILD, TB, critical care" },
      { id: "nephrology", label: "Nephrology", category: "Clinical", description: "Kidney diseases, CKD, AKI, dialysis, electrolytes, transplant" },
      { id: "gastroenterology", label: "Gastroenterology", category: "Clinical", description: "GI tract, liver, pancreas, IBD, hepatology, endoscopy" },
      { id: "hepatology", label: "Hepatology", category: "Clinical", description: "Liver diseases, cirrhosis, viral hepatitis, NAFLD, transplant" },
      { id: "endocrinology", label: "Endocrinology", category: "Clinical", description: "Diabetes, thyroid, adrenal, pituitary, metabolic syndrome" },
      { id: "rheumatology", label: "Rheumatology", category: "Clinical", description: "Autoimmune diseases, arthritis, connective tissue disorders" },
      { id: "haematology", label: "Haematology", category: "Clinical", description: "Blood disorders, anaemia, coagulation, bone marrow, oncology overlap" },
      { id: "infectious-disease", label: "Infectious Disease", category: "Clinical", description: "Tropical diseases, antimicrobials, HIV, emerging infections, sepsis" },
      { id: "immunology-allergy", label: "Immunology & Allergy", category: "Clinical", description: "Immune system, hypersensitivity, autoimmunity, immunodeficiency" },
      { id: "general-surgery", label: "General Surgery", category: "Surgery", description: "Abdominal, GI surgery, hernias, trauma, laparoscopic" },
      { id: "orthopedics", label: "Orthopedics & Trauma", category: "Surgery", description: "Bone, joint, spine, fractures, sports injuries, arthroplasty" },
      { id: "neurosurgery", label: "Neurosurgery", category: "Surgery", description: "Brain and spine surgery, neuro-oncology, vascular neurosurgery" },
      { id: "cardiothoracic-surgery", label: "Cardiothoracic Surgery", category: "Surgery", description: "Cardiac surgery, CABG, valve repair, thoracic procedures" },
      { id: "urology", label: "Urology", category: "Surgery", description: "Urinary tract, prostate, kidney stones, oncourology" },
      { id: "plastic-surgery", label: "Plastic & Reconstructive Surgery", category: "Surgery", description: "Reconstruction, burns, aesthetic, microsurgery, cleft" },
      { id: "vascular-surgery", label: "Vascular Surgery", category: "Surgery", description: "Arterial and venous disease, aneurysms, peripheral vascular" },
      { id: "oncology", label: "Oncology", category: "Specialty", description: "Cancer biology, chemotherapy, targeted therapy, palliative care" },
      { id: "psychiatry", label: "Psychiatry", category: "Specialty", description: "Mental health disorders, psychopharmacology, psychotherapy" },
      { id: "paediatrics", label: "Paediatrics", category: "Specialty", description: "Child health, neonatology, paediatric diseases, growth & development" },
      { id: "neonatology", label: "Neonatology", category: "Specialty", description: "Newborn care, NICU, prematurity, congenital anomalies" },
      { id: "obs-gynae", label: "Obstetrics & Gynaecology", category: "Specialty", description: "Pregnancy, labour, postpartum, female reproductive health, fertility" },
      { id: "dermatology", label: "Dermatology", category: "Specialty", description: "Skin diseases, dermatopathology, cosmetic dermatology, STIs" },
      { id: "ophthalmology", label: "Ophthalmology", category: "Specialty", description: "Eye diseases, surgical ophthalmology, retina, glaucoma" },
      { id: "ent", label: "ENT (Head & Neck Surgery)", category: "Specialty", description: "Ear, nose, throat, head & neck, audiology, laryngology" },
      { id: "anaesthesiology", label: "Anaesthesiology & ICU", category: "Specialty", description: "Anaesthesia, pain management, intensive care, critical care" },
      { id: "emergency-medicine", label: "Emergency Medicine", category: "Specialty", description: "ACLS, trauma, toxicology, acute resuscitation, triage" },
      { id: "radiology", label: "Radiology & Imaging", category: "Diagnostic", description: "X-ray, CT, MRI, USG, nuclear medicine, interventional radiology" },
      { id: "pathology", label: "Pathology & Lab Medicine", category: "Diagnostic", description: "Histopathology, cytology, clinical lab, molecular diagnostics" },
      { id: "microbiology", label: "Microbiology", category: "Diagnostic", description: "Bacteriology, virology, mycology, parasitology, antimicrobial resistance" },
      { id: "pharmacology", label: "Clinical Pharmacology", category: "Basic Science", description: "Drug mechanisms, pharmacokinetics, adverse effects, drug interactions" },
      { id: "physiology", label: "Physiology", category: "Basic Science", description: "Human physiology, organ systems, homeostasis, applied physiology" },
      { id: "anatomy", label: "Anatomy", category: "Basic Science", description: "Gross anatomy, neuroanatomy, embryology, clinical correlates" },
      { id: "biochemistry", label: "Biochemistry & Molecular Biology", category: "Basic Science", description: "Metabolism, genetics, enzymology, molecular medicine" },
      { id: "forensic-medicine", label: "Forensic Medicine & Toxicology", category: "Specialty", description: "Medico-legal, autopsy, clinical toxicology, jurisprudence" },
      { id: "community-medicine", label: "Community Medicine & Public Health", category: "Specialty", description: "Epidemiology, biostatistics, national health programs, preventive medicine" },
      { id: "geriatrics", label: "Geriatrics", category: "Specialty", description: "Elderly care, polypharmacy, frailty, age-related diseases" },
      { id: "palliative-care", label: "Palliative & Supportive Care", category: "Specialty", description: "End-of-life care, pain, symptom control, communication" },
      { id: "sports-medicine", label: "Sports Medicine", category: "Specialty", description: "Athlete health, exercise physiology, musculoskeletal injuries" },
      { id: "nuclear-medicine", label: "Nuclear Medicine", category: "Diagnostic", description: "PET, SPECT, radionuclide therapy, thyroid scintigraphy" },
    ],
  },
  {
    id: "ayurveda",
    label: "Ayurveda",
    symbol: "A",
    subtitle: "Classical Indian Medicine",
    tradition: "Classical Indian",
    color: "#C8922A",
    glowColor: "rgba(200, 146, 42, 0.15)",
    bgGradient:
      "radial-gradient(ellipse at 50% 0%, rgba(200,146,42,0.08), transparent 70%)",
    sanskritName: "आयुर्वेद",
    defaultSources: DOMAIN_UNIVERSAL_SOURCES.ayurveda,
    subdomains: [
      { id: "kayachikitsa", label: "Kayachikitsa", labelNative: "कायचिकित्सा", category: "Clinical", description: "Ayurvedic internal medicine — diseases of the body (Kaya), digestive fire, metabolic disorders" },
      { id: "shalya-tantra", label: "Shalya Tantra", labelNative: "शल्यतन्त्र", category: "Surgery", description: "Sushruta's surgical tradition — 8 types of Shalya, Yantra, Shastra, Kshara, Agni karma" },
      { id: "shalakya-tantra", label: "Shalakya Tantra", labelNative: "शालाक्यतन्त्र", category: "Specialty", description: "Eye, ear, nose, throat diseases — Uttamanga disorders above the clavicle" },
      { id: "prasuti-stri-roga", label: "Prasuti & Stri Roga", labelNative: "प्रसूति-स्त्रीरोग", category: "Specialty", description: "Obstetrics, gynaecology, Garbhini Paricharya (prenatal care), Sutika Paricharya (postnatal)" },
      { id: "kaumarbhritya", label: "Kaumarbhritya", labelNative: "कौमारभृत्य", category: "Specialty", description: "Paediatrics — Balroga, Jatamatra Paricharya, feeding, childhood diseases, Graha Chikitsa" },
      { id: "agada-tantra", label: "Agada Tantra", labelNative: "अगदतन्त्र", category: "Toxicology", description: "Toxicology — plant, animal, mineral poisons; Visha Chikitsa; Sthavara/Jangama Visha" },
      { id: "bhuta-vidya", label: "Bhuta Vidya", labelNative: "भूतविद्या", category: "Specialty", description: "Ayurvedic psychiatry — Unmada, Apasmara, Graha diseases, mental-spiritual disorders" },
      { id: "rasayana", label: "Rasayana", labelNative: "रसायन", category: "Preventive", description: "Rejuvenation — anti-ageing, Vayasthapana, immunomodulation, Acharya Rasayana, Dravya Rasayana" },
      { id: "vajikarana", label: "Vajikarana", labelNative: "वाजीकरण", category: "Specialty", description: "Aphrodisiac and reproductive sciences — Shukra Dhatu, fertility, virility, Vrishya Chikitsa" },
      { id: "panchakarma", label: "Panchakarma", labelNative: "पञ्चकर्म", category: "Therapeutic", description: "Five detox procedures — Vamana, Virechana, Basti (Anuvasana/Niruha), Nasya, Raktamokshana" },
      { id: "dravyaguna", label: "Dravyaguna Vigyana", labelNative: "द्रव्यगुण विज्ञान", category: "Pharmacology", description: "Ayurvedic pharmacology — Rasa, Guna, Virya, Vipaka, Prabhava; herb-drug properties" },
      { id: "rasa-shastra", label: "Rasa Shastra & Bhaishajya Kalpana", labelNative: "रसशास्त्र", category: "Pharmacy", description: "Iatrochemistry — Parada, Dhatu, Bhasma, Asava-Arishta, Ghrita, Churna formulations" },
      { id: "roga-nidana", label: "Roga Nidana & Vikriti Vigyana", labelNative: "रोगनिदान", category: "Diagnostic", description: "Diagnosis & pathology — Nidana Panchaka (Hetu, Purvarupa, Rupa, Samprapti, Upashaya)" },
      { id: "swasthavritta", label: "Swasthavritta & Yoga", labelNative: "स्वस्थवृत्त", category: "Preventive", description: "Preventive medicine — Dinacharya, Ritucharya, Sadvritta, Ashtanga Ahara Vidhi, Yoga integration" },
      { id: "maulik-siddhanta", label: "Maulik Siddhanta & Ashtanga Hridayam", labelNative: "मौलिकसिद्धान्त", category: "Foundations", description: "Fundamental principles — Tridosha, Saptadhatu, Trimala, Panchamahabhuta, Prakriti analysis" },
      { id: "charaka-samhita", label: "Charaka Samhita Studies", labelNative: "चरकसंहिता", category: "Classical Texts", description: "In-depth study of Charaka Samhita — Sutrasthana to Kalpasthana, classical commentaries" },
      { id: "sushruta-samhita", label: "Sushruta Samhita Studies", labelNative: "सुश्रुतसंहिता", category: "Classical Texts", description: "Sushruta Samhita — surgical procedures, wound management, 300+ operations described" },
      { id: "ashtanga-hridayam", label: "Ashtanga Hridayam Studies", labelNative: "अष्टाङ्गहृदयम्", category: "Classical Texts", description: "Vagbhata's synthesis — concise clinical Ayurveda across all 8 branches" },
      { id: "nidra-ahara", label: "Ahara Vigyana (Ayurvedic Nutrition)", labelNative: "आहारविज्ञान", category: "Preventive", description: "Food as medicine — Viruddha Ahara, Pathya-Apathya, seasonal diet, Desha-Kala-based nutrition" },
    ],
  },
  {
    id: "homeopathy",
    label: "Homeopathy",
    symbol: "H",
    subtitle: "Vital Force Medicine",
    tradition: "Hahnemannian",
    color: "#9C6FDE",
    glowColor: "rgba(156, 111, 222, 0.15)",
    bgGradient:
      "radial-gradient(ellipse at 50% 0%, rgba(156,111,222,0.08), transparent 70%)",
    defaultSources: DOMAIN_UNIVERSAL_SOURCES.homeopathy,
    subdomains: [
      { id: "organon", label: "Organon of Medicine", category: "Foundations", description: "Hahnemann's 6 editions — Aphorisms, Similia principle, Vital Force, Miasms, Potentisation theory" },
      { id: "materia-medica", label: "Homoeopathic Materia Medica", category: "Pharmacology", description: "Drug pictures — polychrests, nosodes, sarcodes, imponderable remedies; Allen, Boericke, Clarke, Kent" },
      { id: "repertory", label: "Repertory & Repertorisation", category: "Diagnostic", description: "Kent's Repertory, Boger-Boenninghausen, Synthesis Repertory, software-aided case analysis" },
      { id: "miasmatic-theory", label: "Miasmatic Theory", category: "Theory", description: "Psora, Sycosis, Syphilis — chronic disease theory, anti-miasmatic remedies, mixed miasms" },
      { id: "constitutional-prescribing", label: "Constitutional Prescribing", category: "Clinical", description: "Totality of symptoms, mental generals, physical generals, constitutional remedy selection" },
      { id: "acute-prescribing", label: "Acute Prescribing", category: "Clinical", description: "Acute diseases, acute intercurrents, epidemic remedies, keynote prescribing" },
      { id: "potency-selection", label: "Potency & Dose Selection", category: "Theory", description: "Centesimal, LM/Q potencies, Arndt-Schulz law, susceptibility, posology, repetition" },
      { id: "case-taking", label: "Homoeopathic Case Taking", category: "Diagnostic", description: "Unprejudiced observation, PQRS symptoms, modalities, concomitants, mentals, Hering's Law" },
      { id: "paediatric-homeopathy", label: "Paediatric Homoeopathy", category: "Clinical", description: "Children's remedies, temperament, teething, childhood diseases, growth disorders" },
      { id: "psychiatric-homeopathy", label: "Psychiatric & Mind Remedies", category: "Clinical", description: "Mental symptoms, grief remedies, anxiety, insomnia, addiction, personality types" },
      { id: "obs-gynae-homeopathy", label: "Obstetrics & Gynaecology", category: "Clinical", description: "Pregnancy, labour, infertility, menstrual disorders, menopausal syndrome, PCOS" },
      { id: "dermatology-homeopathy", label: "Dermatological Homoeopathy", category: "Clinical", description: "Skin diseases — eczema, psoriasis, acne, urticaria, based on miasmatic analysis" },
      { id: "surgical-homeopathy", label: "Surgical Conditions & First Aid", category: "Clinical", description: "Pre/post-surgical remedies, injury, abscess, fistula, haemorrhoids, tumours" },
      { id: "clinical-homeopathy", label: "Clinical Practice of Medicine", category: "Clinical", description: "Bridging allopathic pathology with homoeopathic symptomatology, modern disease correlates" },
      { id: "nosodes-sarcodes", label: "Nosodes, Sarcodes & New Remedies", category: "Pharmacology", description: "Disease products (Tuberculinum, Medorrhinum), organ preparations, new provings, isopathy" },
      { id: "research-homeopathy", label: "Homoeopathic Research & EBM", category: "Research", description: "Clinical trials, systematic reviews, meta-analyses, basic research in homeopathy, NHMRC reports" },
      { id: "philosophy-homeopathy", label: "Philosophy & History", category: "Foundations", description: "Neo-Hahnemannian, Kentian, Boenninghausen, Sensation Method (Sankaran), sequential therapy" },
    ],
  },
  {
    id: "siddha",
    label: "Siddha",
    symbol: "S",
    subtitle: "Tamil Classical Medicine",
    tradition: "Tamil Classical",
    color: "#E84393",
    glowColor: "rgba(232, 67, 147, 0.15)",
    bgGradient:
      "radial-gradient(ellipse at 50% 0%, rgba(232,67,147,0.08), transparent 70%)",
    tamilName: "சித்த மருத்துவம்",
    defaultSources: DOMAIN_UNIVERSAL_SOURCES.siddha,
    subdomains: [
      { id: "gunapadam-mooligai", label: "Gunapadam — Mooligai (Herbal)", labelNative: "குணபாடம் — மூலிகை", category: "Pharmacology", description: "Herbal pharmacology — taste (Suvai), potency (Veeriyam), action (Pirivu); 800+ Siddha herbs" },
      { id: "gunapadam-thathu", label: "Gunapadam — Thathu (Inorganic)", labelNative: "குணபாடம் — தாது", category: "Pharmacology", description: "Inorganic Siddha drugs — metals, minerals, salts; Parpam, Chendooram, Sathu preparations" },
      { id: "gunapadam-jangam", label: "Gunapadam — Jangamam (Animal)", labelNative: "குணபாடம் — ஜங்கமம்", category: "Pharmacology", description: "Animal-derived drugs — milk, honey, wax, horns, shells, insect products in Siddha" },
      { id: "sirappu-maruthuvam", label: "Sirappu Maruthuvam", labelNative: "சிறப்பு மருத்துவம்", category: "Clinical", description: "Special clinical Siddha medicine — chronic diseases, rare conditions, specialised treatment protocols" },
      { id: "noi-naadal", label: "Noi Naadal (Diagnosis)", labelNative: "நோய் நாடல்", category: "Diagnostic", description: "Siddha diagnosis — Naadi (pulse), Naa (tongue), Niram (colour), Mozhi, Vizhi, Malam, Neer (urine)" },
      { id: "nanju-maruthuvam", label: "Nanju Maruthuvam (Toxicology)", labelNative: "நஞ்சு மருத்துவம்", category: "Toxicology", description: "Siddha toxicology — plant, mineral, animal poisons; antidote formulations, detox protocols" },
      { id: "kuzhandhai-maruthuvam", label: "Kuzhandhai Maruthuvam (Paediatrics)", labelNative: "குழந்தை மருத்துவம்", category: "Specialty", description: "Siddha paediatrics — neonatal care, childhood diseases, Pillai noi, Bal-Visham treatments" },
      { id: "varma", label: "Varma Therapy", labelNative: "வர்ம சிகிச்சை", category: "Therapeutic", description: "Vital energy points (108 Varmam) — Thaduvithal, Noi Theerthal, Adangal; therapeutic and trauma applications" },
      { id: "thokkanam", label: "Thokkanam (Siddha Massage & Physiotherapy)", labelNative: "தொக்கணம்", category: "Therapeutic", description: "8 types of Siddha manual therapy — Thattal, Irattal, Pirattal, Muriyal, Nookkal, Varutthal, Pizhidal, Uzhidal" },
      { id: "kayakarpam", label: "Kayakarpam (Rejuvenation)", labelNative: "காயகற்பம்", category: "Preventive", description: "Siddha anti-ageing — 18 Siddhars' methods, Karpam drugs, cellular rejuvenation, longevity protocols" },
      { id: "muppu", label: "Muppu & Alchemy", labelNative: "முப்பு", category: "Pharmacology", description: "Siddha alchemy — Muppu (universal salt), transmutation, Savuku, Uppu, Chunnam preparations" },
      { id: "siddha-philosophy", label: "Siddha Philosophy & Cosmology", labelNative: "சித்த தத்துவம்", category: "Foundations", description: "Panchabhoota, Tridosha (Vatham-Pitham-Kabam), 96 Tattvas, 5 Prana Vayus, Shakti philosophy" },
      { id: "naadi-jothidam", label: "Naadi Jothidam (Astro-Medicine)", labelNative: "நாடி ஜோதிடம்", category: "Specialty", description: "Planetary influences on health, Nava Graha impact on body systems, astrological disease prediction" },
      { id: "siddha-diet", label: "Pathiya Murai (Siddha Dietetics)", labelNative: "பத்திய முறை", category: "Preventive", description: "Dietary regulations per disease, Pathiyam-Apathiyam, Kalam-based food, seasonal dietetics" },
      { id: "classical-texts-siddha", label: "Classical Siddha Texts", labelNative: "சித்த நூல்கள்", category: "Classical Texts", description: "Theraiyar Kuzhimunthan, Agasthiyar texts, Bogar 7000, Siddha Vaidya Thirattu, palm-leaf manuscripts" },
    ],
  },
  {
    id: "unani",
    label: "Unani",
    symbol: "☤",
    subtitle: "Greco-Arabic Medicine",
    tradition: "Greco-Arabic",
    color: "#4F9EE8",
    glowColor: "rgba(79, 158, 232, 0.15)",
    bgGradient:
      "radial-gradient(ellipse at 50% 0%, rgba(79,158,232,0.08), transparent 70%)",
    arabicName: "طب يوناني",
    defaultSources: DOMAIN_UNIVERSAL_SOURCES.unani,
    subdomains: [
      { id: "kulliyat", label: "Kulliyat (Unani Fundamentals)", labelNative: "کلیات", category: "Foundations", description: "4 Arkan (elements), 4 Akhlat (humours), Mizaj (temperament), Arwah (vital spirit), Quwa (faculties)" },
      { id: "moalajat", label: "Moalajat (Internal Medicine)", labelNative: "معالجات", category: "Clinical", description: "Unani internal medicine — Juzam (leprosy), Istisqa, Qolanj, Suda, fever management, chronic disease" },
      { id: "jarahat", label: "Jarahat (Surgery)", labelNative: "جراحت", category: "Surgery", description: "Unani surgical procedures — wound healing, Fasd (venesection), Hijama (cupping), Kai (cauterisation)" },
      { id: "ain-uzn-anf-halq", label: "Ain, Uzn, Anf, Halq (ENT & Eye)", labelNative: "عین، اذن، انف، حلق", category: "Specialty", description: "Unani ENT & Ophthalmology — eye diseases (Ramad, Nuzulul Maa), ear/nose/throat disorders" },
      { id: "qabalat-amraze-niswan", label: "Qabalat-o-Amraze Niswan (Obs & Gynae)", labelNative: "قابلات و امراض نسواں", category: "Specialty", description: "Unani obstetrics & gynaecology — Hamal, Wiladat, Nifas, Amraze Rahim, Waram-ul-Rahim, Sailan-ur-Rahim" },
      { id: "amraze-atfal", label: "Amraze Atfal (Paediatrics)", labelNative: "امراض اطفال", category: "Specialty", description: "Unani paediatrics — Suda-ul-Atfal, Humma-e-Atfal, Ishal, Qabz, Dandan, teething, childhood fevers" },
      { id: "amraz-e-jild", label: "Amraz-e-Jild (Dermatology)", labelNative: "امراض جلد", category: "Specialty", description: "Skin diseases in Unani — Baras (vitiligo), Juzam, Quba, Niqris, Humra, Saratan-e-Jild" },
      { id: "ilmul-advia", label: "Ilmul Advia (Pharmacology)", labelNative: "علم الادویہ", category: "Pharmacology", description: "Unani pharmacology — Mizaj of drugs, Mufrid (simple) vs. Murakkab (compound), Khawas (properties)" },
      { id: "ilmul-saidla", label: "Ilmul Saidla (Unani Pharmacy)", labelNative: "علم الصیدلہ", category: "Pharmacy", description: "Drug preparation — Laooq, Majoon, Qurs, Sharbat, Khamira, Itrifal, Zimad, Marham formulations" },
      { id: "mizaj-assessment", label: "Mizaj Assessment (Temperament)", labelNative: "مزاج", category: "Diagnostic", description: "Constitutional analysis — Damawi (sanguine), Safrawi (choleric), Balghami (phlegmatic), Saudawi (melancholic)" },
      { id: "ilaj-bit-tadbeer", label: "Ilaj-bit-Tadbeer (Regimental Therapy)", labelNative: "علاج بالتدبیر", category: "Therapeutic", description: "Non-pharmacological treatments — Riyazat (exercise), Dalak (massage), Hammam (bath), Fasd, Hijama, Ishal" },
      { id: "amraze-asab", label: "Amraze Asab (Neurology)", labelNative: "امراض اعصاب", category: "Clinical", description: "Unani nervous system disorders — Falij (paralysis), Laqwa (facial palsy), Sara (epilepsy), Nisyan (dementia)" },
      { id: "amraze-qalb", label: "Amraze Qalb (Cardiology)", labelNative: "امراض قلب", category: "Clinical", description: "Heart and vascular diseases — Khafqan (palpitation), Waram-ul-Qalb, hypertension in Unani perspective" },
      { id: "tashreehul-badan", label: "Tashreehul Badan (Anatomy)", labelNative: "تشریح البدن", category: "Basic Science", description: "Unani anatomy — Ibn Sina's anatomical descriptions, A'za Raeesa (principal organs), Arwah" },
      { id: "classical-texts-unani", label: "Classical Unani Texts", labelNative: "کلاسیکل نصوص", category: "Classical Texts", description: "Al-Qanun (Ibn Sina), Al-Hawi (Razi), Zakhira Khwarazm Shahi, Tibb-e-Nabawi, Makhzan-ul-Advia" },
    ],
  },
];

export const RESEARCH_INTENTS: ResearchIntent[] = [
  {
    id: "clinical",
    icon: "🏥",
    label: "Clinical Research",
    description:
      "Patient outcomes, treatment protocols, clinical guidelines, case series",
    tags: ["RCTs", "Case Studies", "Guidelines", "Protocols"],
    promptModifier:
      "Focus on clinical evidence, patient outcomes, treatment protocols, and current guidelines. Include level of evidence grading (Oxford LOE / GRADE).",
  },
  {
    id: "thesis",
    icon: "🎓",
    label: "Thesis / Dissertation",
    description:
      "Structured academic research with full literature review and citations",
    tags: ["Literature Review", "Methodology", "References", "Abstract"],
    promptModifier:
      "Structure the output as a thesis-ready literature review with: Abstract, Introduction, Review of Literature, Discussion, Conclusion, and full bibliographic references in the chosen citation style.",
  },
  {
    id: "systematic-review",
    icon: "📊",
    label: "Systematic Review & Meta-Analysis",
    description: "Evidence synthesis, meta-analysis, PRISMA methodology",
    tags: ["PRISMA", "Forest Plot", "Cochrane", "Heterogeneity"],
    promptModifier:
      "Follow PRISMA guidelines. Include PICO framework analysis, search strategy, inclusion/exclusion criteria, study quality assessment, and evidence synthesis with heterogeneity analysis where applicable.",
  },
  {
    id: "drug-herb-research",
    icon: "🌿",
    label: "Drug & Herb Research",
    description:
      "Pharmacology, herb-drug interactions, phytochemistry, formulations",
    tags: ["Mechanism of Action", "Interactions", "Phytochemistry", "Toxicity"],
    promptModifier:
      "Include detailed pharmacology: molecular mechanisms, pharmacokinetics, pharmacodynamics, known interactions, contraindications, and dosage evidence. For herbs, include phytochemical constituents and active compounds.",
  },
  {
    id: "case-report",
    icon: "📋",
    label: "Case Report",
    description:
      "Structured single case documentation, rare presentations, management",
    tags: ["Presentation", "Diagnosis", "Management", "CARE Guidelines"],
    promptModifier:
      "Follow CARE guidelines for case reporting. Structure: Title, Abstract, Introduction (why this case is unique), Patient Information, Clinical Findings, Diagnostic Assessment, Therapeutic Intervention, Follow-up, Discussion, Conclusions.",
  },
  {
    id: "comparative",
    icon: "⚖️",
    label: "Integrative Comparative Study",
    description:
      "Cross-tradition analysis, convergence and divergence between medical systems",
    tags: ["Multi-System", "Convergence", "Divergence", "Integrative"],
    promptModifier:
      "Explicitly analyse the topic through all selected medical traditions in parallel. Identify points of convergence (similar findings across traditions), divergence (contradictions), and opportunities for integrative medicine.",
  },
];

export const SOURCE_FILTERS: SourceFilter[] = [
  {
    id: "pubmed",
    label: "PubMed / MEDLINE",
    url: "https://pubmed.ncbi.nlm.nih.gov",
    domains: ["allopathy", "ayurveda", "homeopathy", "siddha", "unani"],
    description: "US National Library of Medicine biomedical literature database",
    isPrimary: true,
  },
  {
    id: "clinicaltrials",
    label: "ClinicalTrials.gov",
    url: "https://clinicaltrials.gov",
    domains: ["allopathy", "ayurveda", "homeopathy"],
    description: "Registry of clinical studies globally",
    isPrimary: true,
  },
  {
    id: "cochrane",
    label: "Cochrane Library",
    url: "https://cochranelibrary.com",
    domains: ["allopathy", "ayurveda", "homeopathy"],
    description: "Gold-standard systematic reviews and meta-analyses",
    isPrimary: true,
  },
  {
    id: "who",
    label: "WHO / ICMR Guidelines",
    url: "https://who.int",
    domains: ["allopathy"],
    description:
      "World Health Organization and Indian Council of Medical Research",
    isPrimary: true,
  },
  {
    id: "ayush-formulary",
    label: "AYUSH Formulary & CCRAS",
    url: "https://ccras.nic.in",
    domains: ["ayurveda", "siddha", "unani", "homeopathy"],
    description: "Central Council for Research in Ayurvedic Sciences",
    isPrimary: true,
  },
  {
    id: "ccrum",
    label: "CCRUM Database",
    url: "https://ccrum.res.in",
    domains: ["unani"],
    description: "Central Council for Research in Unani Medicine",
    isPrimary: true,
  },
  {
    id: "ccrs",
    label: "CCRCS Siddha Database",
    url: "https://siddhacouncil.org",
    domains: ["siddha"],
    description: "Central Council for Research in Siddha",
    isPrimary: true,
  },
  {
    id: "homeopathy-research",
    label: "Homeopathy Research Institute",
    url: "https://hri-research.org",
    domains: ["homeopathy"],
    description: "HRI global homeopathy research evidence",
    isPrimary: true,
  },
  {
    id: "embase",
    label: "Embase / Scopus",
    url: "https://embase.com",
    domains: ["allopathy", "ayurveda"],
    description: "Biomedical and pharmacological literature",
    isPrimary: false,
  },
  {
    id: "radiopaedia",
    label: "Radiopaedia",
    url: "https://radiopaedia.org",
    domains: ["allopathy"],
    description: "Radiology reference and case repository",
    isPrimary: false,
  },
  {
    id: "uptodate",
    label: "UpToDate / BMJ Best Practice",
    domains: ["allopathy"],
    description: "Clinical decision support guidelines",
    isPrimary: false,
  },
  {
    id: "doaj",
    label: "DOAJ — Open Access Journals",
    url: "https://doaj.org",
    domains: ["ayurveda", "siddha", "unani", "homeopathy"],
    description:
      "Directory of Open Access Journals for AYUSH research",
    isPrimary: false,
  },
  {
    id: "indian-journals",
    label: "Indian Medical Journals (IJAM, AYU)",
    domains: ["ayurveda", "siddha", "unani"],
    description:
      "Indian Journal of Ayurveda, AYU Journal, JRAU",
    isPrimary: false,
  },
  {
    id: "ncbi-books",
    label: "NCBI Bookshelf",
    url: "https://ncbi.nlm.nih.gov/books",
    domains: ["allopathy", "ayurveda"],
    description: "Free medical textbooks and monographs",
    isPrimary: false,
  },
];

export const RESEARCH_TEMPLATES: ResearchTemplate[] = [
  {
    id: "bams-thesis",
    label: "BAMS Final Year Thesis Starter",
    subtitle: "Ayurveda · Thesis · Comprehensive",
    domains: ["ayurveda"],
    subdomains: { ayurveda: ["kayachikitsa", "dravyaguna"] },
    intent: "thesis",
    depth: "comprehensive",
    sources: ["ayush-formulary", "pubmed", "ccras", "doaj"],
    citationStyle: "vancouver",
    sampleQuery:
      "Review of Ashwagandha (Withania somnifera) in the management of stress and anxiety — Ayurvedic and modern perspectives",
  },
  {
    id: "mbbs-clinical",
    label: "MBBS Clinical Case Prep",
    subtitle: "Allopathy · Clinical Research · Focused",
    domains: ["allopathy"],
    subdomains: { allopathy: ["general-medicine", "pharmacology"] },
    intent: "clinical",
    depth: "focused",
    sources: ["pubmed", "clinicaltrials", "who", "uptodate"],
    citationStyle: "vancouver",
    sampleQuery:
      "Current management protocols for community-acquired pneumonia in adults — 2024 guidelines",
  },
  {
    id: "integrative-overview",
    label: "Integrative Medicine Overview",
    subtitle: "Allopathy + Ayurveda · Comparative · Exhaustive",
    domains: ["allopathy", "ayurveda"],
    subdomains: {
      allopathy: ["cardiology", "pharmacology"],
      ayurveda: ["kayachikitsa", "dravyaguna"],
    },
    intent: "comparative",
    depth: "exhaustive",
    sources: ["pubmed", "cochrane", "ayush-formulary", "ccras"],
    citationStyle: "apa",
    sampleQuery:
      "Comparative analysis of Arjuna (Terminalia arjuna) vs. conventional cardiac drugs in heart failure management",
  },
  {
    id: "md-systematic-review",
    label: "MD Postgraduate Systematic Review",
    subtitle: "Allopathy · Systematic Review · Exhaustive",
    domains: ["allopathy"],
    subdomains: {
      allopathy: ["general-medicine", "pharmacology", "community-medicine"],
    },
    intent: "systematic-review",
    depth: "exhaustive",
    sources: ["pubmed", "cochrane", "clinicaltrials", "embase"],
    citationStyle: "vancouver",
    sampleQuery:
      "Systematic review and meta-analysis: Efficacy of GLP-1 receptor agonists in type 2 diabetes with cardiovascular disease",
  },
  {
    id: "bhms-thesis",
    label: "BHMS Thesis — Homoeopathic Research",
    subtitle: "Homeopathy · Thesis · Comprehensive",
    domains: ["homeopathy"],
    subdomains: {
      homeopathy: ["materia-medica", "clinical-homeopathy", "research-homeopathy"],
    },
    intent: "thesis",
    depth: "comprehensive",
    sources: ["pubmed", "homeopathy-research", "doaj"],
    citationStyle: "vancouver",
    sampleQuery:
      "A clinical study on the efficacy of homoeopathic constitutional remedies in PCOS — a randomised controlled trial",
  },
  {
    id: "drug-herb",
    label: "Herb-Drug Interaction Research",
    subtitle: "Multi-tradition · Drug Research · Comprehensive",
    domains: ["allopathy", "ayurveda"],
    subdomains: {
      allopathy: ["pharmacology"],
      ayurveda: ["dravyaguna", "rasa-shastra"],
    },
    intent: "drug-herb-research",
    depth: "comprehensive",
    sources: ["pubmed", "embase", "ayush-formulary", "ncbi-books"],
    citationStyle: "apa",
    sampleQuery:
      "Pharmacokinetic herb-drug interactions of Turmeric (Curcuma longa) with anticoagulants and chemotherapy agents",
  },
];

export const CITATION_STYLES: {
  id: CitationStyle;
  label: string;
  description: string;
}[] = [
  {
    id: "vancouver",
    label: "Vancouver",
    description: "Standard for medical theses in India, ICMR",
  },
  {
    id: "apa",
    label: "APA 7th",
    description: "Psychology, behavioural, social sciences",
  },
  {
    id: "harvard",
    label: "Harvard",
    description: "Used in many Indian universities",
  },
  {
    id: "mla",
    label: "MLA 9th",
    description: "Humanities integration",
  },
  {
    id: "icmr",
    label: "ICMR Format",
    description: "Indian Council of Medical Research specific",
  },
];

export const DEPTH_CONFIG = {
  focused: {
    label: "Focused",
    description: "2–3 core sources, concise synthesis",
    estimatedSeconds: 15,
    icon: "⚡",
  },
  comprehensive: {
    label: "Comprehensive",
    description: "5–8 sources, structured report",
    estimatedSeconds: 35,
    icon: "🔍",
  },
  exhaustive: {
    label: "Exhaustive",
    description: "10+ sources, full systematic synthesis",
    estimatedSeconds: 75,
    warning: "Deep search may take 60–90 seconds",
    icon: "🌊",
  },
};

