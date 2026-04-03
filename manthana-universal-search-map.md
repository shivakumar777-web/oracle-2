# Manthana — Universal Search Source Map
### Clinical + Traditional Medicine Research Intelligence
**Version:** 1.0 | **Domains:** Allopathy · Ayurveda · Homeopathy · Siddha · Unani  
**Purpose:** Authoritative, research-grade source registry for query federation, evidence synthesis, and AI-assisted retrieval pipelines.

---

> **Legend**
> - 🔴 **Tradition-Specific** — Exclusively or primarily serves this tradition
> - 🔵 **General Medical** — Broad biomedical/interdisciplinary coverage
> - 🟢 **Cross-Domain** — Relevant to 2+ traditions (canonical home noted)
> - `[API]` — Machine-readable API confirmed available
> - `[BULK]` — Bulk download / FTP / data dump available
> - `[WEB]` — Web-only scraping or manual use
> - `[UNC]` — Connector type uncertain; verify before integration
> - **Open** = Freely accessible; **Sub** = Subscription required; **Partial** = Some open, some gated

---

## 1. ALLOPATHY
*Modern/Western Biomedicine — Peer-reviewed, EBM-grounded, RCT-centric*

---

### Tier S — Must-Have (Core Evidence Infrastructure)

- **PubMed / MEDLINE** — https://pubmed.ncbi.nlm.nih.gov — 🔵 General Medical — The gold-standard index of over 36M biomedical citations from NLM/NIH; covers clinical trials, reviews, case reports across virtually all specialties. Entrez API gives structured JSON/XML retrieval with MeSH term filtering. — **Open** — Global — `[API]` — *Bulk baseline data available via NLM FTP; PMID linkages enable cross-DB joining. Also indexes CAM journals. Cross-domain useful.*

- **Cochrane Library** — https://www.cochranelibrary.com — 🔵 General Medical — Definitive repository for systematic reviews (Cochrane Reviews), meta-analyses, and CENTRAL (Controlled Trials Register). Highest EBM trust tier. — **Partial (Reviews open in LMIC; Sub for full CDSR)** — Global — `[API]` — *Cochrane REST API available. Cochrane Reviews on traditional medicine treatments also appear here.*

- **ClinicalTrials.gov** — https://clinicaltrials.gov — 🔵 General Medical — WHO primary registry; comprehensive database of 500K+ clinical studies globally. Covers Phases I–IV; filter by intervention type, country (India). — **Open** — Global — `[API]` — *Full API v2 (beta) released 2023; JSON responses. Cross-domain: AYUSH/CAM trials also registered here.*

- **CTRI — Clinical Trials Registry India** — https://ctri.nic.in — 🔵 General Medical — ICMR-maintained WHO-recognized primary registry for Indian clinical trials; mandatory for all ICMR-funded and drug approval trials. Essential for India-centric allopathy and AYUSH evidence. — **Open** — India — `[WEB]` — *No formal API; structured search available. Covers Ayurveda, Homeopathy RCTs run in India. Cross-domain critical.*

- **WHO IRIS** — https://iris.who.int — 🔵 General Medical — WHO's institutional repository: technical reports, EML, ICD classifications, global disease surveillance, normative guidance, essential medicines. — **Open** — Global — `[API]` — *OAI-PMH protocol available for metadata harvest. Includes WHO Traditional Medicine Strategy.*

- **Embase** — https://www.embase.com — 🔵 General Medical — Elsevier's biomedical index with superior European and pharmacological coverage vs PubMed alone; drug-safety and adverse event indexing is best-in-class. — **Sub** — Global — `[API]` — *Elsevier Scopus/Embase API commercial license needed. If budget-constrained, deprioritize but note the gap.*

---

### Tier A — Strong Supplementary

- **Europe PMC** — https://europepmc.org — 🔵 General Medical — Open-access full-text repository aggregating PubMed, PMC, preprints (bioRxiv, medRxiv), and patent literature. Excellent for full-text mining. — **Open** — Global — `[API]` — *REST API with full-text search. Strong for CAM integration queries.*

- **Scopus** — https://www.scopus.com — 🔵 General Medical — Elsevier's multi-disciplinary abstract/citation database; broader than Embase; covers 25K+ journals. Best for citation impact and affiliation filtering. — **Sub** — Global — `[API]` — *Scopus Search API (commercial). Use for secondary quality signal.*

- **WHO Global Index Medicus (GIM)** — https://www.globalindexmedicus.net — 🔵 General Medical — WHO platform indexing regional medical literature (LILACS, IMEMR, IndMED, AIM, etc.) invisible to PubMed. Critical for global South research. — **Open** — Global — `[API]` — *Built on VHL platform; API available. Essential for Indian/South Asian Allopathy research.*

- **IndMED** — https://indmed.nic.in — 🔵 General Medical — NIC India's index of 100+ Indian biomedical journals; curated by NLM India. Only authoritative index of Indian clinical literature outside PubMed. — **Open** — India — `[WEB]` — *No known API; includes AYUSH journals. Partially subsumed into WHO GIM.*

- **CDSCO — Central Drugs Standard Control Organisation** — https://cdsco.gov.in — 🔵 General Medical — India's national drug regulator; database of approved drugs, clinical trial approvals, New Drug Applications, pharmacovigilance alerts. — **Open** — India — `[WEB]` — *Machine-readable exports uncertain. Essential for India drug regulatory cross-check.*

- **FDA Drugs@FDA** — https://www.accessdata.fda.gov/scripts/cder/daf — 🔵 General Medical — USFDA approved drug database with labeling, clinical review documents, and safety data. — **Open** — Global/USA — `[API]` — *OpenFDA API available (open.fda.gov). Cross-reference with regulatory approval status.*

- **EMA — European Medicines Agency** — https://www.ema.europa.eu — 🔵 General Medical — EU drug approvals, pharmacovigilance, EPAR reports, and herbal medicine assessments (HMPC Committee). — **Open** — Global/Europe — `[API]` — *EMA API for EPAR data. HMPC herbal monographs relevant for Ayurveda/Unani cross-referencing.*

- **NICE — National Institute for Health and Care Excellence** — https://www.nice.org.uk — 🔵 General Medical — Gold-standard UK clinical practice guidelines; EBM-grounded treatment recommendations. — **Open** — Global/UK — `[API]` — *Evidence Search API; NICE Pathways machine-readable.*

- **UpToDate** — https://www.uptodate.com — 🔵 General Medical — Continuously updated clinical decision support; peer-reviewed editorial synthesis. Highest clinical practice authority. — **Sub** — Global — `[UNC]` — *No public API; used interactively. Consider for editorial benchmarking only.*

- **BMJ Best Practice** — https://bestpractice.bmj.com — 🔵 General Medical — EBM-based point-of-care guidance; diagnostic algorithms and treatment pathways. — **Sub** — Global — `[UNC]` — *Similar profile to UpToDate. Use for clinical practice layer.*

- **ICMR — Indian Council of Medical Research** — https://www.icmr.gov.in — 🔵 General Medical — India's apex biomedical research body; national guidelines, disease surveillance, COVID-19 protocols, NCD data. — **Open** — India — `[WEB]` — *Publication database and guidelines PDFs available. Indispensable for India clinical standards.*

---

### Tier B — Optional / Niche / Regulatory

- **TOXNET → NLM ChemIDplus/LiverTox** — https://www.ncbi.nlm.nih.gov/books/NBK547852 — 🔵 General Medical — Toxicology, drug-induced liver injury (DILI) data. Critical for herb–drug interaction safety flagging. — **Open** — Global — `[API]` — *NLM APIs cover this data now.*

- **OpenTrials (historical)** — https://opentrials.net — 🔵 General Medical — Linked open data project aggregating trial registries. Now partially archived. — **Partial** — Global — `[UNC]` —

- **PAHO IRIS** — https://iris.paho.org — 🔵 General Medical — Pan-American Health Organization repository; Latin America disease and health systems data. — **Open** — Regional (LATAM) — `[API]` —

- **SEARO / WHOIND** — https://apps.who.int/iris/handle/10665/148247 — 🔵 General Medical — WHO South-East Asia Regional Office publications; India-relevant WHO country reports. — **Open** — India/SEARO — `[UNC]` —

- **Drugs.com / RxList** — https://www.drugs.com — 🔵 General Medical — Consumer-facing but clinician-used drug reference; interaction checker. Use only as fallback. — **Open** — Global — `[WEB]` —

---

## 2. AYURVEDA
*Classical Indian system grounded in Tridosha theory, Panchakarma, Dravyaguna, and Rasashastra*

---

### Tier S — Must-Have

- **CCRAS — Central Council for Research in Ayurvedic Sciences** — https://www.ccras.nic.in — 🔴 Tradition-Specific — India's nodal government research council for Ayurveda under MoAYUSH; maintains formulation databases, pharmacognosy, research publications, and clinical monographs. — **Open** — India — `[WEB]` — *No formal API; rich institutional repository. Highest authority for Ayurveda research in India.*

- **AYUSH Research Portal** — https://ayushresearch.gov.in — 🔴 Tradition-Specific — MoAYUSH's unified research gateway; indexes research publications across Ayurveda, Yoga, Unani, Siddha, Homeopathy including CCRAS/CCRUM/CCRH/CCRS research outputs. — **Open** — India — `[WEB]` — *Aggregator for all AYUSH system research; check for API. Cross-domain for all Indian traditional systems.*

- **TKDL — Traditional Knowledge Digital Library** — https://www.tkdl.res.in — 🟢 Cross-Domain — CSIR-NRDC India's defensive patent database documenting traditional formulations from Ayurveda, Unani, Siddha, and Yoga with structured transliteration into international patent classification. Prevents bio-piracy. — **Partial (access agreements for patent offices)** — India — `[UNC]` — *Restricted public access but critical for IP provenance and formulation verification. Cross-domain: Ayurveda + Unani + Siddha.*

- **Ayurvedic Pharmacopoeia of India (API)** — https://pharmacopoeia.ayush.gov.in — 🔴 Tradition-Specific — Official PCIMH-published pharmacopoeial standards for single drugs (Volumes I–VI) and formulations (AFI). Defines identity, purity, and dosage for official Ayurvedic medicines. — **Open** — India — `[WEB]` — *Authoritative normative reference for drug standardization. PDFs available per volume.*

- **Ayurvedic Formulary of India (AFI)** — https://pharmacopoeia.ayush.gov.in — 🔴 Tradition-Specific — Official PCIMH compilation of 444 classical formulations with ingredients, processing, indications, and doses. The legal reference for licensed Ayurvedic manufacturing. — **Open** — India — `[WEB]` — *Often hosted jointly with API on PCIMH portal. Part 1 + Part 2.*

- **PCIMH — Pharmacopoeia Commission for Indian Medicine & Homoeopathy** — https://pcimh.gov.in — 🔴 Tradition-Specific — Statutory body under MoAYUSH that publishes official pharmacopoeias and formularies for Ayurveda, Siddha, Unani, and Homeopathy. Master source for all 4 Indian traditional systems' standards. — **Open** — India — `[WEB]` — *Cross-domain: covers Ayurveda + Siddha + Unani + Homeopathy.*

- **NHP — National Health Portal India (AYUSH section)** — https://www.nhp.gov.in/ayurveda — 🔴 Tradition-Specific — India's citizen health portal with validated AYUSH disease-condition articles, plant profiles, and treatment modalities. — **Open** — India — `[WEB]` — *Curated content; not a primary research database but high-trust for terminology and condition mapping.*

---

### Tier A — Strong

- **Shodhganga — INFLIBNET ETD Repository** — https://shodhganga.inflibnet.ac.in — 🟢 Cross-Domain — INFLIBNET's national ETD (Electronic Theses & Dissertations) repository for Indian universities; largest single repository of Ayurveda, Siddha, and Unani doctoral research in India. — **Open** — India — `[API]` — *OAI-PMH protocol for metadata; full-text search available. Cross-domain: Ayurveda + Siddha + Unani + Homeopathy PhD theses.*

- **J-AIM — Journal of Ayurveda and Integrative Medicine** — https://www.jaim.in — 🔴 Tradition-Specific — Peer-reviewed open-access journal by The Ayurvedic Trust; indexed in PubMed; highest-impact dedicated Ayurveda research journal. — **Open** — India/Global — `[WEB]` — *PubMed-indexed; articles retrievable via Entrez API under NLM. Key for clinical Ayurveda evidence.*

- **AYU Journal** — https://www.ayujournal.org — 🔴 Tradition-Specific — Official journal of IPGT&RA (Gujarat Ayurved University); Scopus/PubMed-indexed; covers pharmacognosy, clinical studies, classical texts, and Rasashastra. — **Open** — India — `[WEB]` — *PubMed-indexed; retrievable via Entrez. Cross-domain: also covers Siddha and Yoga.*

- **Ancient Science of Life** — https://www.ancientscienceoflife.org — 🔴 Tradition-Specific — PMAAI's journal; archives classical Ayurvedic scholarship and ethnobotanical research; PubMed-indexed. — **Open** — India — `[WEB]` — *Entrez-retrievable. Cross-domain: Siddha, Unani research also published.*

- **IMPPAT — Indian Medicinal Plants, Phytochemistry And Therapeutics** — https://cb.imsc.res.in/imppat — 🔴 Tradition-Specific — Curated phytochemical database for 1742 Indian medicinal plants with 9,596 phytochemicals; links plants to diseases via disease-phytochemical associations. Built by IMSc Chennai. — **Open** — India — `[API]` — *Downloadable datasets; REST API for phytochemical queries. Network pharmacology gold mine.*

- **AyurGenomics — IGIB Portal** — https://ayurgenomics.org — 🔴 Tradition-Specific — CSIR-IGIB research portal linking Ayurvedic Prakriti (constitution types) with genomic data; precision Ayurveda resource. — **Open** — India — `[UNC]` — *Research portal; datasets may be downloadable per publication.*

- **NIIMH — National Institute of Indian Medical Heritage** — https://niimh.nic.in — 🔴 Tradition-Specific — MoAYUSH institute preserving classical texts, manuscripts (digitized palm-leaf), and history of Indian medical systems. Namapadam lexicon for Sanskrit medical terms. — **Open** — India — `[WEB]` — *Cross-domain: covers Ayurveda + Siddha + Unani history and manuscript heritage.*

- **NMPB — National Medicinal Plants Board** — https://nmpb.nic.in — 🔴 Tradition-Specific — MoAYUSH board governing medicinal plant cultivation, conservation, and trade; monographs on scheduled plants; GIS-linked cultivation data. — **Open** — India — `[WEB]` — *Plant identity and sustainability data for Dravyaguna researchers.*

- **Ashtanga Ayurveda (eGranth)** — https://niimh.nic.in/ebooks/ayurveda — 🔴 Tradition-Specific — NIIMH's digitized classical Ayurvedic texts (Charaka Samhita, Sushruta Samhita, Ashtanga Hridayam) in Sanskrit + English translation. — **Open** — India — `[WEB]` — *Primary classical text source; essential for formulation provenance lookup.*

---

### Tier B — Optional / Specialist

- **NISCAIR — National Institute of Science Communication** — https://nopr.niscair.res.in — 🔵 General Medical — CSIR's open-access publishing platform hosting journals like Indian Journal of Natural Products (IJNPR), Medicinal Plants (IJMAP), and Natural Product Radiance. — **Open** — India — `[WEB]` — *Cross-domain: CAM, phytochemistry.*

- **eMedicineHealth Ayurveda (WebMD)** — N/A — Consumer-facing; exclude — *Not research grade; note only.*

- **DOAJ — Ayurveda filtered** — https://doaj.org — 🔵 General Medical — Directory of Open Access Journals; filter by subject for tradition-specific open journals not indexed elsewhere. — **Open** — Global — `[API]` — *DOAJ REST API available. Cross-domain utility for finding niche AYUSH journals.*

- **Google Scholar (custom)** — https://scholar.google.com — 🔵 General Medical — Broad academic index; useful for grey literature and conference proceedings but lacks MeSH-controlled vocabulary. — **Open** — Global — `[WEB]` — *No official API; use cautiously for supplementary discovery only.*

---

## 3. HOMEOPATHY
*System based on Law of Similars, potentization, miasmatic theory, and classical constitutional prescribing*

---

### Tier S — Must-Have

- **CCRH — Central Council for Research in Homoeopathy** — https://www.ccrhindia.nic.in — 🔴 Tradition-Specific — India's national apex research body for Homeopathy under MoAYUSH; primary research database, clinical studies, drug provings, monographs, and pharmacovigilance data. — **Open** — India — `[WEB]` — *Publication archive and institutional repository; no confirmed API.*

- **Homoeopathic Pharmacopoeia of India (HPI)** — https://pcimh.gov.in — 🔴 Tradition-Specific — Statutory pharmacopoeia defining standards for 1,293 single drugs; official reference for Indian Homeopathic manufacturing and quality control. Published by PCIMH. — **Open** — India — `[WEB]` — *Available via PCIMH portal in PDFs.*

- **HRI — Homeopathy Research Institute** — https://www.hri-research.org — 🔴 Tradition-Specific — UK-based independent research body; maintains the most comprehensive, critically appraised evidence summary database for Homeopathy including RCT maps, systematic review summaries, and research quality ratings. — **Open** — Global — `[WEB]` — *Best structured evidence portal for Homeopathy worldwide.*

- **CORE-HOM — Cochrane-linked Homeopathy Clinical Trial Database** — https://www.carstens-stiftung.de/core-hom.html — 🔴 Tradition-Specific — Comprehensive clinical study registry specifically for Homeopathy; 1,200+ RCT and observational studies with structured metadata. Maintained by Carstens-Stiftung (Germany). — **Open** — Global — `[WEB]` — *Best clinical evidence database exclusive to Homeopathy. No formal API confirmed.*

- **HomBRex — Homeopathy Bibliography Database** — https://www.carstens-stiftung.de/hombr.html — 🔴 Tradition-Specific — Bibliographic database for Homeopathy literature; 10,000+ references including journals, books, congress proceedings not indexed in PubMed. Maintained by Carstens-Stiftung. — **Open** — Global — `[WEB]` — *Unique coverage of grey literature absent from PubMed.*

---

### Tier A — Strong

- **Homeopathy (formerly British Homoeopathic Journal)** — https://www.sciencedirect.com/journal/homeopathy — 🔴 Tradition-Specific — Faculty of Homeopathy's official peer-reviewed journal; Scopus/PubMed-indexed; highest-impact Homeopathy clinical and laboratory research journal. — **Partial (Elsevier/ScienceDirect)** — Global — `[API]` — *Elsevier API for metadata; PubMed-indexed articles via Entrez.*

- **LMHI — Liga Medicorum Homoeopathica Internationalis** — https://www.lmhi.org — 🔴 Tradition-Specific — Oldest international Homeopathy physician organization; congress abstracts, position papers, and practice guidelines. — **Open** — Global — `[WEB]` — *Primarily organizational; use for international clinical practice context.*

- **ECH — European Committee for Homoeopathy** — https://www.homeopathyeurope.org — 🔴 Tradition-Specific — Regulatory and advocacy body for Homeopathy in EU; position papers, evidence summaries, and regulatory context for European practice. — **Open** — Europe — `[WEB]` — *Policy and regulatory layer; relevant for European market cross-reference.*

- **Faculty of Homeopathy (UK)** — https://www.facultyofhomeopathy.org — 🔴 Tradition-Specific — Professional body; clinical training resources, case series, and evidence summaries. — **Open** — Global/UK — `[WEB]` — *Complementary to HRI for UK clinical practice layer.*

- **AIH — American Institute of Homeopathy** — https://homeopathyusa.org — 🔴 Tradition-Specific — Oldest US medical society; practice guidelines and American Homeopathy clinical publications. — **Open** — USA — `[WEB]` — *Secondary tier for US regulatory context.*

- **Journal of Homeopathic Sciences** — https://www.thejhomeopathic.com — 🔴 Tradition-Specific — India-published peer-reviewed journal covering clinical research and drug provings. — **Open** — India — `[WEB]` — *Less indexed but tradition-primary for India-based clinical research.*

- **NCCIH — National Center for Complementary and Integrative Health** — https://www.nccih.nih.gov — 🔵 General Medical — NIH center for CAM research funding and evidence summaries; Homeopathy fact sheets and evidence maps. — **Open** — Global/USA — `[WEB]` — *Cross-domain: covers all CAM including Ayurveda, Naturopathy, Yoga. Secondary tier.*

- **Carstens-Stiftung Research Foundation** — https://www.carstens-stiftung.de — 🔴 Tradition-Specific — German foundation maintaining CORE-HOM + HomBRex + funding Homeopathy RCTs; central node for European Homeopathy research infrastructure. — **Open** — Global/Germany — `[WEB]` — *Umbrella for CORE-HOM and HomBRex; single institutional relationship unlocks both.*

---

### Tier B — Optional

- **RADAR Opus / ISIS** — https://www.radaropus.com — 🔴 Tradition-Specific — Commercial Homeopathy clinical software with integrated Materia Medica and Repertory (Synthesis, Complete). Essential for practitioners; not a research database per se. — **Sub** — Global — `[UNC]` — *For AI integration into clinical recommendation: materia medica mining potential.*

- **Complementary Therapies in Medicine** — https://www.sciencedirect.com/journal/complementary-therapies-in-medicine — 🔵 General Medical — Elsevier journal covering RCTs and reviews of CAM including Homeopathy. — **Sub** — Global — `[API]` — *Elsevier API; cross-domain for all CAM.*

- **Evidence-Based Complementary and Alternative Medicine (eCAM)** — https://www.hindawi.com/journals/ecam — 🔵 General Medical — Open-access Hindawi/Wiley journal for all CAM traditions; Scopus/PubMed-indexed. — **Open** — Global — `[WEB]` — *Cross-domain: Ayurveda + Homeopathy + Siddha + Unani.*

---

## 4. SIDDHA
*Classical Tamil medical system; Parai, Gunam, Muppu, Naadi diagnosis, heavy-metal formulations (Chendhuram)*

---

### Tier S — Must-Have

- **CCRS — Central Council for Research in Siddha** — https://www.ccrs.gov.in — 🔴 Tradition-Specific — India's nodal government research institute for Siddha medicine under MoAYUSH; institutional research, clinical trials, drug standardization, and monographs specific to Siddha. — **Open** — India — `[WEB]` — *Primary and highest-authority research body for Siddha globally. Most content available in Tamil + English.*

- **Siddha Pharmacopoeia of India (SPI)** — https://pcimh.gov.in — 🔴 Tradition-Specific — Official pharmacopoeial standards for Siddha single drugs (Part I, Volumes I–III) and compound formulations; legally binding reference for licensed Siddha manufacturers. Published by PCIMH. — **Open** — India — `[WEB]` — *Available via PCIMH portal.*

- **Siddha Formulary of India (SFI)** — https://pcimh.gov.in — 🔴 Tradition-Specific — Official PCIMH compilation of classical Siddha compound formulations (Chenduram, Mezhugu, Kuzhambu, Legiyam, etc.) with ingredients and indications. — **Open** — India — `[WEB]` — *Analogous to AFI for Ayurveda; essential for formulation verification.*

- **TKDL — Siddha Section** — https://www.tkdl.res.in — 🟢 Cross-Domain — See Ayurveda Tier S. TKDL includes Siddha formulations documented in Tamil palm-leaf manuscripts with IPC mapping. — **Partial** — India — `[UNC]` — *Siddha coverage is significant; cross-domain entry (canonical home: Ayurveda).*

- **NIIMH — Siddha Classical Texts** — https://niimh.nic.in — 🟢 Cross-Domain — Digitized Siddha classical manuscripts and texts (Agattiyar, Theraiyar, Bhogar 7000) in Tamil and transliterations. — **Open** — India — `[WEB]` — *Cross-domain: canonical home under Ayurveda; also covers Siddha manuscripts.*

---

### Tier A — Strong

- **NIS — National Institute of Siddha, Chennai** — https://nischennai.org — 🔴 Tradition-Specific — Premier Siddha research and clinical institution under MoAYUSH; institutional publications, clinical case archives, and research thesis bank from Tamil Nadu. — **Open** — India — `[WEB]` — *Regional research hub; strongest clinical Siddha data for Tamil Nadu.*

- **Govt. Siddha Medical College, Chennai** — https://www.gsmc.ac.in — 🔴 Tradition-Specific — India's oldest Siddha medical institution; dissertation repository and faculty research publications; deep classical scholarship. — **Open** — India — `[WEB]` — *Institutional ETD library valuable for classical Siddha pharmacology.*

- **RGUHS — Rajiv Gandhi University of Health Sciences** — https://rguhs.ac.in — 🔴 Tradition-Specific — Karnataka university with AYUSH department; BSMS thesis repository for Karnataka Siddha graduates; supplementary to NIS. — **Open** — India — `[WEB]` — *Also covers Ayurveda, Unani, Naturopathy theses; cross-domain.*

- **Shodhganga — Siddha Theses** — https://shodhganga.inflibnet.ac.in — 🟢 Cross-Domain — (Canonical home: Ayurveda Tier A) Holds PhD theses from TNMGRMU (Tamil Nadu Dr. MGR Medical University) for all Siddha disciplines. — **Open** — India — `[API]` —

- **TNMGRMU — Tamil Nadu Dr. MGR Medical University** — https://www.tnmgrmu.ac.in — 🔴 Tradition-Specific — Apex university for health sciences in Tamil Nadu; affiliates all Siddha colleges; thesis registry and research publications important for Siddha evidence. — **Open** — India — `[WEB]` — *BSMS, MD (Siddha) dissertations key for clinical Siddha evidence base.*

- **AYU Journal (Siddha coverage)** — https://www.ayujournal.org — 🟢 Cross-Domain — (Canonical home: Ayurveda Tier A) Publishes Siddha clinical studies and pharmacognosy; PubMed-indexed. — **Open** — India — `[WEB]` —

- **Journal of Traditional Medicine & Clinical Naturopathy** — https://www.omicsonline.org/traditional-medicine-clinical-naturopathy.php — 🔵 General Medical — Open-access journal covering Siddha, Ayurveda, Traditional Chinese Medicine clinical research. — **Open** — Global — `[WEB]` — *Variable quality; verify per article; OMICS publisher concern — use selectively.*

- **CSIR-CLRI / CSIR-IMTECH botanical databases** — https://www.csir.res.in — 🔴 Tradition-Specific — CSIR labs with South Indian botanical and phytochemical research; relevant for Siddha plant pharmacology. — **Open** — India — `[WEB]` —

---

### Tier B — Optional

- **CMPR — Centre for Medicinal Plants Research, Arya Vaidya Sala** — https://www.aryavaidyasala.com — 🔴 Tradition-Specific — Kerala-based; Ayurveda + Siddha crossover for South Indian medicinal plants with pharmacognosy profiles. — **Open** — India — `[WEB]` —

- **Siddha Medicine Wikipedia (Tamil)** — https://ta.wikipedia.org — *Not research grade; note as terminology cross-reference only.*

- **FRLHT — Foundation for Revitalisation of Local Health Traditions** — https://frlht.org — 🔴 Tradition-Specific — ENVIS-linked repository of South Indian medicinal plants used in Ayurveda and Siddha; ethnobotanical field data. — **Open** — India — `[WEB]` — *Cross-domain: Ayurveda + Siddha plant ethnobotany. Medplant database.*

---

## 5. UNANI
*Greco-Arabic system based on Humoral theory (Akhlaat), Mizaj (temperament), and Al-Kulliyat principles*

---

### Tier S — Must-Have

- **CCRUM — Central Council for Research in Unani Medicine** — https://www.ccrum.net — 🔴 Tradition-Specific — India's apex government body for Unani research under MoAYUSH; pharmacognosy, clinical monographs, drug standardization, and institutional research publications. Highest authority for Unani in India. — **Open** — India — `[WEB]` — *Primary institutional source; content available in Urdu, Hindi, and English.*

- **Unani Pharmacopoeia of India (UPI)** — https://pcimh.gov.in — 🔴 Tradition-Specific — Official pharmacopoeial standards for 242 Unani single drugs (Part I) and compound formulations (Part II); published by PCIMH; legally binding reference. — **Open** — India — `[WEB]` — *Available via PCIMH portal.*

- **National Formulary of Unani Medicine (NFUM)** — https://pcimh.gov.in — 🔴 Tradition-Specific — Official PCIMH compilation of 638 classical Unani compound formulations with doses, contraindications, and preparation methods. — **Open** — India — `[WEB]` — *Analogous to AFI for Ayurveda. 5 parts published.*

- **TKDL — Unani Section** — https://www.tkdl.res.in — 🟢 Cross-Domain — (Canonical home: Ayurveda Tier S) Comprehensive documentation of Unani formulations from classical texts (Kitab-al-Hawi, Qarabadin-e-Kabir, etc.) with IPC classification. — **Partial** — India — `[UNC]` —

- **NIUM — National Institute of Unani Medicine, Bengaluru** — https://nium.in — 🔴 Tradition-Specific — Premier Unani research and postgraduate clinical institution; institutional publications, clinical trial data, and BUMS/MD dissertation repository. — **Open** — India — `[WEB]` — *Key institutional ETD source for clinical Unani evidence.*

---

### Tier A — Strong

- **AYUSH Research Portal (Unani)** — https://ayushresearch.gov.in — 🟢 Cross-Domain — (Canonical home: Ayurveda Tier S) Covers CCRUM publications and Unani research outputs from AYUSH system. — **Open** — India — `[WEB]` —

- **Hamdard Medicus** — https://hamdard.edu.pk/medicus — 🔴 Tradition-Specific — Pakistan's longest-running peer-reviewed journal focused on Unani, herbal medicine, and Greco-Arabic medical tradition; unique source for classical Unani clinical scholarship. — **Open** — Pakistan/Global — `[WEB]` — *Unique; not duplicated elsewhere. Essential for Pakistan + South Asia Unani research.*

- **Journal of Traditional Chinese Medicine (cross-referenced)** — https://www.jtcm.net — 🔵 General Medical — While China-focused, publishes humoral and traditional system comparisons including Unani; cross-cultural medical comparison research. — **Open** — Global — `[WEB]` — *Secondary; use for humoral theory cross-cultural comparative studies.*

- **EMRO — WHO Regional Office for Eastern Mediterranean** — https://applications.emro.who.int/EMRJ — 🔴 Tradition-Specific — WHO EMRO's regional publications covering Arab, Persian, and South Asian traditional medicine including Unani; Eastern Mediterranean Health Journal indexed. — **Open** — Regional (MENA/SEARO) — `[API]` — *OAI-PMH available. Critical for Unani's West Asian + South Asian evidence base.*

- **Shodhganga — Unani Theses** — https://shodhganga.inflibnet.ac.in — 🟢 Cross-Domain — (Canonical home: Ayurveda Tier A) Contains Unani BUMS/MD (Unani) dissertations from Aligarh Muslim University, Jamia Hamdard, and other AYUSH institutions. — **Open** — India — `[API]` —

- **Jamia Hamdard — Institutional Repository** — https://ir.jhas.jhamdard.edu.in — 🔴 Tradition-Specific — Jamia Hamdard University's IR; premier Unani academic institution in India; faculty research, PhD theses, and Hamdard Research publications. — **Open** — India — `[WEB]` — *Most important single academic source for Indian Unani research.*

- **AMU — Aligarh Muslim University (Unani Studies)** — https://www.amu.ac.in/department/unani — 🔴 Tradition-Specific — Department of Ilmul Advia (Unani Pharmacology) and KAMC Unani hospital clinical research; institutional publications. — **Open** — India — `[WEB]` — *Second most important Indian academic hub for Unani.*

- **IMEMR — Index Medicus for the Eastern Mediterranean Region** — https://applications.emro.who.int/imemr — 🔴 Tradition-Specific — WHO EMRO regional bibliographic index; covers Arab and Iranian medical journals including traditional medicine; unique literature not indexed in PubMed. — **Open** — Regional (MENA) — `[WEB]` — *Also accessible via WHO Global Index Medicus. Critical for classical Greco-Arabic source texts.*

---

### Tier B — Optional

- **Iran J Med Sci / IJB — Iranian Biomedical Journal** — https://ijms.sums.ac.ir — 🔴 Tradition-Specific — Iranian medical journals with significant Traditional Persian Medicine (Tibb-e-Unani) content; phytochemical and clinical studies relevant to Unani. — **Open** — Regional/Iran — `[WEB]` — *Tibb-e-Unani and Iranian herbal medicine substantially overlap with Unani.*

- **Avicenna Journal of Phytomedicine** — https://ajp.mums.ac.ir — 🔴 Tradition-Specific — Mashhad University journal on herbal medicine; heavy Unani-relevant Persian traditional medicine content. — **Open** — Iran — `[WEB]` —

- **FRLHT Medplant Database (Unani)** — https://frlht.org — 🟢 Cross-Domain — (Canonical home: Siddha Tier B) Ethnobotanical plant database with Unani materia medica cross-referencing. — **Open** — India — `[WEB]` —

- **Al-Qanun fi al-Tibb (Ibn Sina) — Digitized** — https://www.wilayah.net/islamicmedicine/canon.htm (mirror; verify) — 🔴 Tradition-Specific — Digitized version of the foundational Unani classical text; primary source for humoral theory, Mizaj, and Mufradat (single drugs). — **Open** — Global — `[WEB]` — *Classical text; uncertain official digital host. NIIMH and Hamdard archives hold authentic versions.*

---

## 6. CROSS-DOMAIN CORE SET
*Indexes that MUST run for all integrative, multi-tradition, or "universal" queries*

---

These sources are domain-agnostic aggregators that provide evidence on any tradition when queried with appropriate terminology. They form the **universal backbone layer** of every search federation.

| # | Source | URL | Rationale | Connector |
|---|--------|-----|-----------|-----------|
| 1 | **PubMed / MEDLINE** | https://pubmed.ncbi.nlm.nih.gov | Indexes CAM, Ayurveda, Homeopathy, and Siddha journals; the one database that partially covers all 5 systems | `[API]` |
| 2 | **Europe PMC** | https://europepmc.org | Full-text mining + preprints; catches CAM literature not in main PubMed | `[API]` |
| 3 | **Cochrane Library (CENTRAL)** | https://www.cochranelibrary.com | Cross-tradition systematic reviews and RCT registry | `[API]` |
| 4 | **ClinicalTrials.gov** | https://clinicaltrials.gov | All 5 systems have registered trials; global trial registry | `[API]` |
| 5 | **CTRI India** | https://ctri.nic.in | Indian-run trials in all AYUSH systems; ICMR-linked | `[WEB]` |
| 6 | **WHO IRIS** | https://iris.who.int | WHO Traditional Medicine Strategy + disease burden + EML | `[API]` |
| 7 | **TKDL** | https://www.tkdl.res.in | Formulation provenance across Ayurveda, Siddha, Unani simultaneously | `[UNC]` |
| 8 | **AYUSH Research Portal** | https://ayushresearch.gov.in | Unified output aggregator for all 4 Indian traditional systems | `[WEB]` |
| 9 | **Shodhganga** | https://shodhganga.inflibnet.ac.in | Doctoral research for all AYUSH disciplines from Indian universities | `[API]` |
| 10 | **PCIMH Portal** | https://pcimh.gov.in | Publishes pharmacopoeias + formularies for Ayurveda, Siddha, Unani, Homeopathy | `[WEB]` |
| 11 | **eCAM (Evidence-Based CAM)** | https://www.hindawi.com/journals/ecam | Open-access; covers all CAM traditions; PubMed-indexed | `[WEB]` |
| 12 | **NCCIH** | https://www.nccih.nih.gov | NIH CAM evidence summaries and fact sheets across all traditions | `[WEB]` |
| 13 | **DOAJ** | https://doaj.org | Indexes all open-access tradition-specific journals not elsewhere indexed | `[API]` |
| 14 | **WHO Global Index Medicus** | https://www.globalindexmedicus.net | Regional indexes (IndMED, IMEMR, LILACS) in one gateway | `[API]` |
| 15 | **NIIMH** | https://niimh.nic.in | Manuscript + classical text heritage for Ayurveda + Siddha + Unani + Yoga | `[WEB]` |

**Why run all 15 for integrative queries?**
- Tradition-specific queries benefit from PubMed + Cochrane as quality anchors before diving into tradition-specific sources.
- CTRI + ClinicalTrials.gov together catch Indian RCTs missed by global registries alone.
- TKDL + PCIMH provide formulation provenance that no international database offers.
- AYUSH Research Portal + Shodhganga together constitute the largest grey-literature corpus for Indian traditional medicine.
- Cross-domain runs should always include the pharmacopoeia layer (PCIMH) to validate any formulation claim against official standards.

---

## 7. SOURCE → MACHINE ID MAPPING TABLE

*For configuration files, query routers, source registry JSON, and connector manifests*

| Source Name (Display) | Machine ID | Domain(s) | Tier |
|---|---|---|---|
| PubMed / MEDLINE | `pubmed` | ALL | S |
| Cochrane Library | `cochrane` | ALL | S |
| ClinicalTrials.gov | `clinicaltrials` | ALL | S |
| CTRI India | `ctri-india` | ALL (India) | S |
| WHO IRIS | `who-iris` | ALL | S |
| Europe PMC | `europe-pmc` | ALL | A |
| Embase | `embase` | Allopathy | A |
| Scopus | `scopus` | Allopathy | A |
| WHO Global Index Medicus | `who-gim` | ALL | A |
| IndMED | `indmed` | Allopathy / ALL India | A |
| CDSCO India | `cdsco` | Allopathy | A |
| FDA Drugs@FDA | `fda-drugs` | Allopathy | A |
| EMA EPAR | `ema-epar` | Allopathy | A |
| NICE Guidelines | `nice` | Allopathy | A |
| ICMR | `icmr` | Allopathy | A |
| NCCIH | `nccih` | ALL CAM | A |
| DOAJ | `doaj` | ALL | A |
| eCAM Journal | `ecam` | ALL CAM | B |
| CCRAS | `ccras` | Ayurveda | S |
| AYUSH Research Portal | `ayush-portal` | ALL Indian Trad. | S |
| TKDL | `tkdl` | Ayurveda/Siddha/Unani | S |
| Ayurvedic Pharmacopoeia of India | `api-ayurveda` | Ayurveda | S |
| Ayurvedic Formulary of India | `afi-ayurveda` | Ayurveda | S |
| PCIMH | `pcimh` | Ayurveda/Siddha/Unani/Homeo | S |
| Shodhganga | `shodhganga` | ALL Indian Trad. | A |
| J-AIM | `jaim` | Ayurveda | A |
| AYU Journal | `ayu-journal` | Ayurveda/Siddha | A |
| Ancient Science of Life | `ancient-sci-life` | Ayurveda/Siddha | A |
| IMPPAT | `imppat` | Ayurveda | A |
| AyurGenomics | `ayurgenomics` | Ayurveda | A |
| NIIMH | `niimh` | Ayurveda/Siddha/Unani | S |
| NMPB | `nmpb` | Ayurveda | A |
| NISCAIR / NOPR | `niscair-nopr` | Ayurveda/CAM | B |
| FRLHT Medplant | `frlht-medplant` | Ayurveda/Siddha | B |
| CCRH India | `ccrh` | Homeopathy | S |
| Homoeopathic Pharmacopoeia India | `hpi` | Homeopathy | S |
| HRI | `hri-homeopathy` | Homeopathy | S |
| CORE-HOM | `core-hom` | Homeopathy | S |
| HomBRex | `hombr-ex` | Homeopathy | S |
| Homeopathy Journal (Elsevier) | `homeopathy-journal` | Homeopathy | A |
| LMHI | `lmhi` | Homeopathy | A |
| ECH Europe | `ech-europe` | Homeopathy | A |
| Faculty of Homeopathy UK | `faculty-homeopathy-uk` | Homeopathy | A |
| Carstens-Stiftung | `carstens-stiftung` | Homeopathy | A |
| CCRS India | `ccrs` | Siddha | S |
| Siddha Pharmacopoeia India | `spi` | Siddha | S |
| Siddha Formulary India | `sfi` | Siddha | S |
| NIS Chennai | `nis-chennai` | Siddha | A |
| GSMC Chennai | `gsmc-chennai` | Siddha | A |
| TNMGRMU | `tnmgrmu` | Siddha | A |
| RGUHS Bangalore | `rguhs` | Siddha/Ayurveda | A |
| CCRUM India | `ccrum` | Unani | S |
| Unani Pharmacopoeia India | `upi` | Unani | S |
| National Formulary Unani Medicine | `nfum` | Unani | S |
| NIUM Bengaluru | `nium` | Unani | S |
| Hamdard Medicus | `hamdard-medicus` | Unani | A |
| WHO EMRO / EMRJ | `who-emro` | Unani | A |
| Shodhganga Unani | `shodhganga` | Unani (same id) | A |
| Jamia Hamdard IR | `jamia-hamdard-ir` | Unani | A |
| AMU Unani Dept | `amu-unani` | Unani | A |
| IMEMR | `imemr` | Unani | A |
| Avicenna J Phytomedicine | `avicenna-jpm` | Unani | B |
| Iran J Med Sci | `ijms-iran` | Unani | B |

---

## 8. RECOMMENDED QUERY FEDERATION ARCHITECTURE

```
QUERY INPUT
    │
    ├── [Domain Classifier] ──────> domain = {allopathy, ayurveda, homeopathy, siddha, unani, integrative}
    │
    ├── [Cross-Domain Core Layer] ──> pubmed, cochrane, clinicaltrials, ctri-india, who-iris, europe-pmc, ayush-portal, tkdl, shodhganga, pcimh
    │
    ├── [Domain-Specific Layer]
    │       ├── Allopathy:    embase, scopus, cdsco, fda-drugs, ema-epar, nice, icmr, indmed
    │       ├── Ayurveda:     ccras, api-ayurveda, afi-ayurveda, niimh, jaim, ayu-journal, imppat, nmpb, frlht-medplant
    │       ├── Homeopathy:   ccrh, hpi, hri-homeopathy, core-hom, hombr-ex, homeopathy-journal, carstens-stiftung
    │       ├── Siddha:       ccrs, spi, sfi, nis-chennai, tnmgrmu, gsmc-chennai, rguhs
    │       └── Unani:        ccrum, upi, nfum, nium, hamdard-medicus, who-emro, imemr, jamia-hamdard-ir, amu-unani
    │
    ├── [Evidence Ranking Layer] ──> Tier S → A → B; filter by: open-access, API-available, India-relevant
    │
    └── [Result Synthesis] ──────> Evidence quality score + tradition fidelity tag + source provenance
```

---

*Document compiled for Manthana Universal Search Architecture.*  
*Last validated: March 2026. All URLs should be re-verified before production integration.*  
*Sources marked `[UNC]` for connector type require technical API investigation before pipeline inclusion.*

---

## 9. Code implementation (Manthana repo)

| Artifact | Purpose |
|----------|---------|
| `frontend-manthana/manthana/src/lib/universal-search-sources.ts` | `DOMAIN_UNIVERSAL_SOURCES`, `INTEGRATIVE_CROSS_DOMAIN_CORE`, `getUniversalSources()` — must match backend. |
| `services/research-service/orchestrator.py` | `DOMAIN_AUTO_SOURCES`, `INTEGRATIVE_CROSS_DOMAIN_CORE`, `SOURCE_SITE_FRAGMENT` (SearXNG `site:` pills). PubMed / ClinicalTrials.gov use API connectors, not fragments. |
| `frontend-manthana/manthana/src/lib/deep-research-config.ts` | `RESEARCH_DOMAINS[].defaultSources` re-exports per-domain pills from `universal-search-sources.ts` for UI. |

When you revise this document, update **both** TS and Python registries so requests stay consistent.