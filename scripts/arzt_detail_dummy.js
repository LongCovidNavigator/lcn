(function () {
    "use strict";

    const initialParams = new URLSearchParams(location.search);
    const fixtureKey = initialParams.get("fixture") || "example";
    const fixture = window.LCN_DOCTOR_DUMMY_FIXTURES?.[fixtureKey] || null;
    if (!initialParams.has("id")) {
        const initialScenario = initialParams.get("scenario") || "complete";
        const fixtureParam = fixture ? `&fixture=${encodeURIComponent(fixtureKey)}` : "";
        history.replaceState(null, "", `${location.pathname}?id=${fixture?.item?.dr_id || 9001}&scenario=${encodeURIComponent(initialScenario)}${fixtureParam}`);
    }

    const requestedScenario = new URLSearchParams(location.search).get("scenario") || "complete";
    const activeScenario = ["complete", "research", "voting", "hybrid"].includes(requestedScenario) ? requestedScenario : "complete";
    const scenarioDefinitions = {
        complete: {label: "Vollständig", note: "Kombiniert redaktionell recherchierte Stammdaten, aggregierte Abstimmungen und hybrid gepflegte Praxisangaben."},
        research: {label: "Nur Recherche", note: "Zeigt überprüfbare Stammdaten: Identität, Kontakt, Abrechnung, Fachrichtungen und Standort. Patient:innen-Erfahrungen und Community-Angaben fehlen."},
        voting: {label: "Nur Abstimmung", note: "Zeigt ausschließlich aggregierte Patient:innen-Erfahrungen. Kontaktdaten, Praxisorganisation, fachliche Einordnung und Behandlungsspektrum werden nicht aus Abstimmungen abgeleitet."},
        hybrid: {label: "Nur Hybrid", note: "Zeigt strukturierte Angaben, die aus Community-Vorschlägen entstehen und redaktionell geprüft werden: Zugänglichkeit, Terminbewältigung, Leistungen, Diagnosen und Behandlungsspektrum."}
    };

    document.addEventListener("DOMContentLoaded", function () {
        document.querySelectorAll("[data-doctor-scenario]").forEach(function (link) {
            const url = new URL(link.href, location.href);
            url.searchParams.set("id", fixture?.item?.dr_id || "9001");
            if (fixture) url.searchParams.set("fixture", fixtureKey);
            link.href = url;
            const selected = link.dataset.doctorScenario === activeScenario;
            link.classList.toggle("is-active", selected);
            if (selected) link.setAttribute("aria-current", "page");
        });
        const note = document.getElementById("doctor-dummy-scenario-note");
        if (note) note.innerHTML = `<strong>${fixture ? fixture.label : "Dr. med. Mara Beispiel"} · ${scenarioDefinitions[activeScenario].label}</strong> · ${fixture?.researchNote || scenarioDefinitions[activeScenario].note}`;

        const content = document.getElementById("doctor-detail-content");
        if (!content) return;
        const observer = new MutationObserver(function () {
            if (!content.classList.contains("is-hidden")) {
                applyScenarioView(content);
                observer.disconnect();
            }
        });
        observer.observe(content, {attributes: true, attributeFilter: ["class"]});
    });

    function applyScenarioView(content) {
        content.classList.add(`is-${activeScenario}-scenario`);
        const sections = [...content.querySelectorAll(".doctor-detail-guided-section")];
        const visibleSections = {
            complete: [0, 1, 2, 3, 4, 5],
            research: [0, 3],
            voting: [2],
            hybrid: [0, 1, 4, 5]
        }[activeScenario];
        const missingBySection = [
            ["Versicherung & Abrechnung", "Kosten", "Terminlage"],
            ["Terminform", "Hausbesuche", "Rücksichtnahme", "Barrierefreiheit"],
            ["Gesamtbewertung", "Ärztlicher Umgang", "Arbeitsweise", "Praxis-Erfahrungen"],
            ["Fachrichtungen", "Zusatzqualifikationen / Weiterbildungen", "Spezialisierungen", "Fachliche Erfahrung"],
            ["Services", "Medikamentöse Möglichkeiten", "Diagnosen"],
            ["Behandlungsspektrum", "Behandlungsbewertungen", "Angebotsanalyse"]
        ];
        const unavailableReason = activeScenario === "research" ? "Nicht Bestandteil reiner Recherche" : activeScenario === "voting" ? "Nicht aus Abstimmungen ableitbar" : "Benötigt Recherche oder Abstimmungen";

        sections.forEach(function (section, index) {
            if (visibleSections.includes(index)) {
                const tag = document.createElement("span");
                tag.className = "doctor-dummy-source-tag";
                tag.textContent = activeScenario === "complete" ? ([2].includes(index) ? "Abstimmung" : ([0, 1, 4, 5].includes(index) ? "Hybrid" : "Recherche")) : scenarioDefinitions[activeScenario].label.replace("Nur ", "");
                section.querySelector(".doctor-detail-question-intro h2")?.append(tag);
                return;
            }
            section.classList.add("is-dummy-unavailable");
            const grid = document.createElement("div");
            grid.className = "doctor-dummy-missing-grid";
            grid.innerHTML = missingBySection[index].map(function (field) {
                return `<div class="doctor-dummy-missing-field"><strong>${field}</strong><span>○ ${unavailableReason}</span></div>`;
            }).join("");
            section.append(grid);
        });
    }

    window.LCN_DOCTOR_STRUCTURE_DATA = {
        billing: [["Abrechnungsmodell", "GKV, PKV und Selbstzahler"], ["Kassensitz", "Vorhanden"]],
        costs: [["Ersttermin (Sprechstunde)", "ca. 0–85 €"], ["Folgetermin (Sprechstunde)", "ca. 0–55 €"], ["Typische Gesamtkosten der Behandlung (inklusive Therapie)", "Abhängig von Diagnostik und Versicherung"]],
        appointments: [["Wartezeit bis Ersttermin", "4–8 Wochen"], ["Warteliste vorhanden", "Ja"], ["Zuletzt aktualisiert", "August 2026"]],
        appointmentForms: { "Ersttermin": ["yes", "yes", "no"], "Folgetermine": ["yes", "yes", "yes"] },
        homeVisits: "In medizinisch begründeten Ausnahmefällen",
        consideration: [["Belastungsgrenzen / PEM berücksichtigt", {yes: 18, no: 2}], ["Pausen möglich", {yes: 15, no: 1}], ["Termin anpassbar", {yes: 13, no: 3}]],
        waiting: [["Warte- und Behandlungszeit", "Meist 45–70 Minuten"], ["Ruhiger / reizarmer Wartebereich", {yes: 12, no: 4}], ["Warten im Liegen möglich", {yes: 9, no: 5}]],
        accessibility: [["Rollstuhlgerecht", {yes: 17, no: 1}], ["Stufenlos / Aufzug", {yes: 16, no: 0}], ["Liegen möglich", {yes: 11, no: 4}], ["Begleitperson möglich", {yes: 19, no: 1}]],
        doctorExperience: [["Nimmt Beschwerden ernst", {yes: 20, no: 2}], ["Nimmt sich Zeit", {yes: 17, no: 4}], ["Hört zu", {yes: 19, no: 2}], ["Erklärt nachvollziehbar", {yes: 16, no: 3}], ["Respektvoller Umgang", {yes: 21, no: 1}]],
        workExperience: [["Gründlich", {yes: 18, no: 3}], ["Berücksichtigt Vorbefunde", {yes: 16, no: 2}], ["Gemeinsames Entscheiden", {yes: 14, no: 4}]],
        practiceExperience: [["Wohlgefühlt", {yes: 17, no: 3}], ["Respektvoller Umgang", {yes: 20, no: 1}], ["Gender-Erfahrungen", {yes: 8, no: 2}], ["Queer / LGBTQ+", {yes: 7, no: 1}]],
        services: [["Bescheinigungen / Atteste", {yes: 15, no: 3}], ["Sozialmedizinische Unterstützung", {yes: 11, no: 4}], ["Verlaufskontrolle / Nachbetreuung", {yes: 18, no: 1}]],
        medication: [["Reguläre Verordnungen", {yes: 19, no: 1}], ["Off-Label-Therapien", {yes: 13, no: 4}], ["Individuelle Therapieversuche", {yes: 12, no: 3}]],
        diagnoses: [["ME/CFS (G93.3)", {yes: 18, no: 2}], ["Long Covid", {yes: 22, no: 0}], ["POTS / Dysautonomie", {yes: 16, no: 3}], ["MCAS", {yes: 11, no: 5}], ["Impfschaden", {yes: 9, no: 4}]]
        ,expertise: [["Long Covid", {yes: 22, no: 0}], ["ME/CFS", {yes: 18, no: 2}], ["Post-Vac", {yes: 9, no: 4}], ["POTS / Dysautonomie", {yes: 16, no: 3}], ["MCAS", {yes: 11, no: 5}], ["Belastungsintoleranz / PEM", {yes: 20, no: 1}]]
        ,specializations: [{term_code: "post-infectious", term_label: "Postinfektiöse Erkrankungen", term_desc: "Long Covid und ME/CFS"}, {term_code: "dysautonomia", term_label: "Dysautonomie", term_desc: "POTS und orthostatische Intoleranz"}, {term_code: "pacing", term_label: "Pacing", term_desc: "Symptomorientiertes Energiemanagement"}]
    };

    const treatment = (id, name, type, subcategory, pro, neutral, contra, providers) => ({
        treat_id: id, slug: name.toLowerCase().replace(/[^a-z0-9äöüß]+/g, "-"), behandlung: name,
        typ: type, unterkategorie: subcategory, sort_order: id, pro, neutral, contra,
        total_votes: pro + neutral + contra,
        positive_ratio: Math.round(pro / Math.max(1, pro + neutral + contra) * 100),
        neutral_ratio: Math.round(neutral / Math.max(1, pro + neutral + contra) * 100),
        negative_ratio: Math.round(contra / Math.max(1, pro + neutral + contra) * 100), provider_count: providers
    });

    const normalizeTreatmentName = value => String(value || "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/α/g, "alpha")
        .replace(/β/g, "beta")
        .replace(/[^a-zA-Z0-9]+/g, " ")
        .trim()
        .toLowerCase();
    const taxonomyEntries = Object.entries(window.LCN_DOCTOR_TREATMENT_TAXONOMY || {});
    const taxonomyExact = new Map(taxonomyEntries.map(([name, data]) => [normalizeTreatmentName(name), data]));
    const taxonomyBaseCandidates = new Map();
    taxonomyEntries.forEach(([name, data]) => {
        const base = normalizeTreatmentName(name.replace(/\s*\([^)]*\)\s*/g, " "));
        if (!taxonomyBaseCandidates.has(base)) taxonomyBaseCandidates.set(base, []);
        taxonomyBaseCandidates.get(base).push(data);
    });
    const taxonomyAliases = new Map(Object.entries({
        "low dose naltrexon ldn": "Low Dose Naltrexone (LDN)",
        "low dose aripiprazol lda": "Niedrig dosiertes Aripiprazol (LDA)",
        "help apherese": "H.E.L.P.-Apherese",
        "hyperbare sauerstofftherapie hbot": "Hyperbare Sauerstofftherapie (HBO)",
        "n acetylcystein nac": "N-Acetylcystein",
        "nacl 0 9 intravenos": "Kochsalzinfusion",
        "elektrolytlosung": "Elektrolytlösungen",
        "wenig kaffee": "Kaffeekonsum reduzieren",
        "mrt schadel": "MRT"
    }).map(([alias, target]) => [alias, taxonomyExact.get(normalizeTreatmentName(target))]).filter(([, data]) => data));
    const taxonomyOverrides = new Map(Object.entries({
        "10-Minuten passiver Stehtest": ["Diagnostik", "Funktionsdiagnostik"],
        "18F-FDG-PET": ["Diagnostik", "Bildgebung"],
        "25-OH-Vitamin D": ["Diagnostik", "Labordiagnostik"],
        "Abklärung Small Fiber Neuropathy": ["Diagnostik", "Klinische und fachärztliche Untersuchung"],
        "ACTH": ["Diagnostik", "Labordiagnostik"],
        "Alkoholverzicht": ["Selbstmanagement und Alltag", null],
        "ANA": ["Diagnostik", "Labordiagnostik"],
        "Atemfrequenz": ["Diagnostik", "Funktionsdiagnostik"],
        "Basales Cortisol": ["Diagnostik", "Labordiagnostik"],
        "Beta2-Glykoprotein-Antikörper": ["Diagnostik", "Labordiagnostik"],
        "Cardiolipin-Antikörper": ["Diagnostik", "Labordiagnostik"],
        "CK": ["Diagnostik", "Labordiagnostik"],
        "CK-MB": ["Diagnostik", "Labordiagnostik"],
        "COVID-19-Impfung bei Long Covid": ["Arzneimittel", "Weitere Behandlungen"],
        "CRP": ["Diagnostik", "Labordiagnostik"],
        "Daosin": ["Nahrungsergänzungsmittel", "Sonstige Nahrungsergänzungsmittel"],
        "Daridorexant (QUVIVIQ)": ["Arzneimittel", "Neurologie, Psychiatrie, Schmerz und Schlaf"],
        "dsDNA-Antikörper": ["Diagnostik", "Labordiagnostik"],
        "EBV-Serologie": ["Diagnostik", "Labordiagnostik"],
        "Eingehende Anamnese": ["Diagnostik", "Klinische und fachärztliche Untersuchung"],
        "EKG": ["Diagnostik", "Funktionsdiagnostik"],
        "Ernährungsberatung": ["Coaching, Beratung und Schulung", null],
        "fT3": ["Diagnostik", "Labordiagnostik"],
        "fT4": ["Diagnostik", "Labordiagnostik"],
        "Glukose": ["Diagnostik", "Labordiagnostik"],
        "Immunglobuline IgG/IgA/IgM": ["Diagnostik", "Labordiagnostik"],
        "INR": ["Diagnostik", "Labordiagnostik"],
        "Kardiales 3T-MRT": ["Diagnostik", "Bildgebung"],
        "Komplement C3/C4": ["Diagnostik", "Labordiagnostik"],
        "Komprimierender Bauchgurt": ["Hilfsmittel", null],
        "L-Lysin": ["Nahrungsergänzungsmittel", "Aminosäuren und verwandte Stoffe"],
        "L-Tryptophan": ["Nahrungsergänzungsmittel", "Aminosäuren und verwandte Stoffe"],
        "Liposomales Vitamin C": ["Nahrungsergänzungsmittel", "Vitamine"],
        "Mannose-bindendes Lektin (MBL)": ["Diagnostik", "Labordiagnostik"],
        "Mastzell-Histologie CD117": ["Diagnostik", "Labordiagnostik"],
        "Nebivolol": ["Arzneimittel", "Herz-Kreislauf und Dysautonomie"],
        "Neurologische Untersuchung / Neurostatus": ["Diagnostik", "Klinische und fachärztliche Untersuchung"],
        "Neurotransmitter-Rezeptor-Antikörper": ["Diagnostik", "Labordiagnostik"],
        "Niacin no-flush": ["Nahrungsergänzungsmittel", "Vitamine"],
        "NT-pro-BNP": ["Diagnostik", "Labordiagnostik"],
        "pTT": ["Diagnostik", "Labordiagnostik"],
        "Regelmäßiges Lüften": ["Selbstmanagement und Alltag", null],
        "SARS-CoV-2 Nucleocapsid-IgG": ["Diagnostik", "Labordiagnostik"],
        "SARS-CoV-2-Selbsttests vor Treffen": ["Selbstmanagement und Alltag", null],
        "Strukturiertes Riechtraining": ["Bewegung und Rehabilitation", null],
        "Systemische Corticosteroide": ["Arzneimittel", "Entzündung und Immunmodulation"],
        "TSH": ["Diagnostik", "Labordiagnostik"],
        "Venlafaxin": ["Arzneimittel", "Neurologie, Psychiatrie, Schmerz und Schlaf"],
        "VQ-SPECT/CT": ["Diagnostik", "Bildgebung"]
        ,"Antiphospholipid-Syndrom-Abklärung": ["Diagnostik", "Labordiagnostik"]
        ,"Benzodiazepine": ["Arzneimittel", "Neurologie, Psychiatrie, Schmerz und Schlaf"]
        ,"Carotis-Sonographie": ["Diagnostik", "Bildgebung"]
        ,"CH50 (Labor)": ["Diagnostik", "Labordiagnostik"]
        ,"Elektromyographie (EMG)": ["Diagnostik", "Funktionsdiagnostik"]
        ,"H1-Antihistaminika": ["Arzneimittel", "Allergie und Mastzellaktivierung"]
        ,"Hautbiopsie bei Small-Fiber-Neuropathie": ["Diagnostik", "Klinische und fachärztliche Untersuchung"]
        ,"Kompressionshosen": ["Hilfsmittel", null]
        ,"MRT (Wirbelsäule)": ["Diagnostik", "Bildgebung"]
        ,"NASA Lean Test": ["Diagnostik", "Funktionsdiagnostik"]
        ,"Nervenleitgeschwindigkeit (NLG)": ["Diagnostik", "Funktionsdiagnostik"]
        ,"Nervenultraschall": ["Diagnostik", "Bildgebung"]
        ,"TASS": ["Arzneimittel", "Gerinnung und Gefäße"]
        ,"Virostatika": ["Arzneimittel", "Antiviral und antiinfektiv"]
        ,"BC007": ["Arzneimittel", "Entzündung und Immunmodulation"]
        ,"GPCR-Autoantikörper-Untersuchung": ["Diagnostik", "Labordiagnostik"]
        ,"OCT-Angiografie": ["Diagnostik", "Bildgebung"]
        ,"Doppler-Ultraschall": ["Diagnostik", "Bildgebung"]
        ,"Virtual-Reality-Tests": ["Diagnostik", "Funktionsdiagnostik"]
        ,"Real-Time Deformability Cytometry (RT-DC)": ["Diagnostik", "Labordiagnostik"]
        ,"Antikoagulanzientherapie": ["Arzneimittel", "Gerinnung und Gefäße"]
        ,"Heparin": ["Arzneimittel", "Gerinnung und Gefäße"]
        ,"Dabigatran": ["Arzneimittel", "Gerinnung und Gefäße"]
        ,"Fluoreszenzmikroskopische Blutuntersuchung": ["Diagnostik", "Labordiagnostik"]
        ,"Vericiguat": ["Arzneimittel", "Herz-Kreislauf und Dysautonomie"]
        ,"Handkraftmessung": ["Diagnostik", "Funktionsdiagnostik"]
        ,"Reinfektionsprävention": ["Selbstmanagement und Alltag", null]
        ,"Inuspherese Lipids": ["Medizinische Prozeduren", null]
        ,"Partieller Plasmaaustausch (TPPE)": ["Medizinische Prozeduren", null]
        ,"Intravenöse Infusionstherapie": ["Infusionen", null]
        ,"Peptidtherapie": ["Systemische Therapiekonzepte", null]
        ,"Subkutane Immunglobuline (SCIG)": ["Arzneimittel", "Entzündung und Immunmodulation"]
        ,"Monoklonale Antikörper": ["Arzneimittel", "Entzündung und Immunmodulation"]
        ,"Antikoagulationstherapie": ["Arzneimittel", "Gerinnung und Gefäße"]
        ,"Antivirale Therapie": ["Arzneimittel", "Antiviral und antiinfektiv"]
        ,"Mitochondriale Therapie": ["Systemische Therapiekonzepte", null]
        ,"Nutraceutical Therapy": ["Nahrungsergänzungsmittel", "Sonstige Nahrungsergänzungsmittel"]
        ,"Klinische Ernährungsberatung": ["Coaching, Beratung und Schulung", null]
        ,"Health Coaching": ["Coaching, Beratung und Schulung", null]
        ,"Hyperbare Sauerstofftherapie (HBOT)": ["Medizinische Prozeduren", null]
        ,"EBOO-Ozontherapie": ["Medizinische Prozeduren", null]
        ,"Stellatumblockade": ["Medizinische Prozeduren", null]
        ,"Colon-Hydrotherapie": ["Medizinische Prozeduren", null]
        ,"Repetitive transkranielle Magnetstimulation (rTMS)": ["Gerätegestützte Verfahren", null]
        ,"Ketamintherapie intramuskulär": ["Arzneimittel", "Neurologie, Psychiatrie, Schmerz und Schlaf"]
        ,"Vitamin C intravenös": ["Infusionen", null]
        ,"NAD+ intravenös": ["Infusionen", null]
        ,"Magnesium intravenös": ["Infusionen", null]
        ,"L-Carnitin intravenös": ["Infusionen", null]
        ,"Eisen intravenös": ["Infusionen", null]
        ,"Vitamin-B-Komplex intravenös": ["Infusionen", null]
        ,"Multivitamin-Infusion": ["Infusionen", null]
        ,"Umfangreiches Blutbild / Prä-Treatment-Labordiagnostik": ["Diagnostik", "Labordiagnostik"]
        ,"Blutgasanalyse": ["Diagnostik", "Labordiagnostik"]
        ,"Amyloid-Fibrin-Microclots-Test": ["Diagnostik", "Labordiagnostik"]
        ,"Long-Covid-Antikörperspektrum-Test": ["Diagnostik", "Labordiagnostik"]
        ,"MCAS-Labordiagnostik": ["Diagnostik", "Labordiagnostik"]
        ,"Autoantikörperdiagnostik": ["Diagnostik", "Labordiagnostik"]
        ,"Spike-Protein-Diagnostik": ["Diagnostik", "Labordiagnostik"]
        ,"Mitochondriale/T-Zell-Diagnostik": ["Diagnostik", "Labordiagnostik"]
        ,"Zytokin-/Immundiagnostik": ["Diagnostik", "Labordiagnostik"]
    }).map(([name, [category, subcategory]]) => [normalizeTreatmentName(name), {category, subcategory}]));

    function resolveTreatmentTaxonomy(name) {
        const normalized = normalizeTreatmentName(name);
        if (taxonomyExact.has(normalized)) return taxonomyExact.get(normalized);
        if (taxonomyAliases.has(normalized)) return taxonomyAliases.get(normalized);
        if (taxonomyOverrides.has(normalized)) return taxonomyOverrides.get(normalized);
        const base = normalizeTreatmentName(String(name).replace(/\s*\([^)]*\)\s*/g, " "));
        const candidates = taxonomyBaseCandidates.get(base) || [];
        return candidates.length === 1 ? candidates[0] : null;
    }

    const grouped = {
        "Medikamentös": [
            treatment(101, "Low-Dose Naltrexon (LDN)", "Medikamentös", "Immunmodulation", 48, 13, 9, 34),
            treatment(102, "Betablocker", "Medikamentös", "Kreislauf", 31, 10, 7, 27),
            treatment(103, "Antihistaminika H1/H2", "Medikamentös", "MCAS", 44, 16, 8, 29)
        ],
        "Diagnostik": [
            treatment(104, "Schellong-Test", "Diagnostik", "Dysautonomie", 26, 8, 3, 19),
            treatment(105, "Erweiterte Labordiagnostik", "Diagnostik", "Labor", 22, 12, 6, 41),
            treatment(106, "Kipptischuntersuchung", "Diagnostik", "Dysautonomie", 19, 5, 2, 12)
        ],
        "Nicht-medikamentös": [
            treatment(107, "Pacing-Beratung", "Nicht-medikamentös", "Energiemanagement", 61, 9, 4, 52),
            treatment(108, "Kompressionsversorgung", "Nicht-medikamentös", "Kreislauf", 35, 11, 5, 21),
            treatment(109, "Atemtherapie", "Nicht-medikamentös", "Rehabilitation", 18, 14, 8, 46)
        ]
    };

    const payload = {
        ok: true,
        item: {
            dr_id: 9001, dr_display_name: "Dr. med. Mara Beispiel", dr_type: "physician", dr_is_dr: 1,
            dr_title_raw: "Dr. med.", dr_firstname: "Mara", dr_lastname: "Beispiel", dr_org_name: "Praxis am Stadtgarten",
            dr_website: "https://example.org/praxis", dr_accepts_gkv: "yes", dr_accepts_pkv: "yes",
            loc_id: 9901, loc_label: "Praxis am Stadtgarten", loc_is_primary: 1, loc_country: "Deutschland",
            loc_plz: "50667", loc_city: "Köln", loc_street: "Beispielstraße", loc_housenumber: "42",
            loc_phone: "+49 221 1234567", loc_email: "praxis@example.org", loc_website: "https://example.org/praxis",
            loc_lat: 50.9384, loc_lng: 6.9599, has_coordinates: true, pro: 42, neutral: 7, contra: 4,
            total_votes: 53, positive_ratio: 79, neutral_ratio: 13, negative_ratio: 8, own_vote: null
        },
        terms: {
            specialty: [{term_code: "internal-medicine", term_label: "Innere Medizin", term_desc: "Fachärztliche Versorgung"}, {term_code: "general-practice", term_label: "Allgemeinmedizin"}],
            badge: [{term_code: "long-covid", term_label: "Long-Covid-Schwerpunkt"}, {term_code: "mecfs", term_label: "ME/CFS-Erfahrung"}],
            accessibility: [{term_code: "wheelchair-accessible", term_label: "Rollstuhlgerecht"}, {term_code: "telemedicine-video", term_label: "Videosprechstunde"}],
            other: [{term_code: "pacing", term_label: "Pacing-orientiert"}, {term_code: "dysautonomia", term_label: "Dysautonomie / POTS"}]
        },
        treatments_grouped: grouped,
        analysis: {
            profile: {label: "Breites Behandlungsprofil", treatment_count: 9, category_count: 3}, versatile: true,
            specialties: [{name: "Dysautonomie", treatment_count: 3}, {name: "Energiemanagement", treatment_count: 2}],
            ratings: {
                positive_threshold: 70,
                frequent_votes_threshold: 20,
                highly_positive_count: 7,
                frequently_rated_count: 8,
                top_treatments: [
                    {name: "Pacing-Beratung", positive_ratio: 82, total_votes: 74},
                    {name: "Schellong-Test", positive_ratio: 70, total_votes: 37},
                    {name: "Antihistaminika H1/H2", positive_ratio: 65, total_votes: 68}
                ],
                most_rated_treatments: [
                    {name: "Pacing-Beratung", positive_ratio: 82, total_votes: 74},
                    {name: "Antihistaminika H1/H2", positive_ratio: 65, total_votes: 68},
                    {name: "Low-Dose Naltrexon (LDN)", positive_ratio: 69, total_votes: 70}
                ]
            }
        }
    };

    if (fixture) {
        Object.assign(payload.item, fixture.item, {own_vote: null});
        payload.terms = Object.fromEntries(Object.entries(fixture.terms).map(([group, values]) => [group, values.map((value, index) => typeof value === "string" ? {term_code: `${fixtureKey}-${group}-${index}`, term_label: value} : value)]));
        if (fixture.treatments) {
            payload.treatments_grouped = fixture.treatments.reduce(function (groups, row, index) {
                const taxonomy = resolveTreatmentTaxonomy(row.name);
                const category = taxonomy?.category || "Ohne Kategorie";
                const subcategory = taxonomy?.subcategory || "";
                const treatmentItem = treatment(
                    taxonomy?.id || row.fixtureId + index,
                    row.name,
                    category,
                    subcategory,
                    0, 0, 0, 1
                );
                if (taxonomy?.slug) treatmentItem.slug = taxonomy.slug;
                treatmentItem.recommendation_type = row.recommendationType;
                treatmentItem.fundbasis = row.basis;
                treatmentItem.match_status = row.matchStatus;
                (groups[category] ||= []).push(treatmentItem);
                return groups;
            }, {});
            const treatmentCount = fixture.treatments.length;
            const categoryCount = Object.keys(payload.treatments_grouped).length;
            payload.analysis.profile = {label: "Recherchebasiertes Behandlungsspektrum", treatment_count: treatmentCount, category_count: categoryCount};
            payload.analysis.versatile = categoryCount >= 3;
            const specialtyAreas = new Map();
            Object.values(payload.treatments_grouped).flat().forEach(item => {
                const areaName = String(item.unterkategorie || item.typ || "").trim();
                if (!areaName) return;
                if (!specialtyAreas.has(areaName)) specialtyAreas.set(areaName, new Set());
                specialtyAreas.get(areaName).add(item.treat_id);
            });
            payload.analysis.specialties = Array.from(specialtyAreas, ([name, treatmentIds]) => ({
                name,
                treatment_count: treatmentIds.size
            })).filter(specialty => specialty.treatment_count >= 5).sort((a, b) =>
                b.treatment_count - a.treatment_count || a.name.localeCompare(b.name, "de")
            );
        }
        Object.assign(window.LCN_DOCTOR_STRUCTURE_DATA, fixture.structure);
        if (!fixture.treatments) {
            payload.analysis.profile = {label: "Rechercheprofil", treatment_count: 0, category_count: 0};
            payload.analysis.versatile = false;
            payload.analysis.specialties = [];
        }
        payload.analysis.ratings = {positive_threshold: 70, frequent_votes_threshold: 20, highly_positive_count: 0, frequently_rated_count: 0, top_treatments: [], most_rated_treatments: []};
    }

    let ownVote = null;
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async function (resource, options) {
        const url = String(resource);
        if (url.includes("api/doctor_detail.php")) {
            payload.item.own_vote = ownVote;
            return new Response(JSON.stringify(payload), {status: 200, headers: {"Content-Type": "application/json"}});
        }
        if (url.includes("api/inc_doctor_votes.php")) {
            const body = options && options.body ? JSON.parse(options.body) : {};
            ownVote = body.type || null;
            return new Response(JSON.stringify({ok: true, vote: ownVote, own_vote: ownVote}), {status: 200, headers: {"Content-Type": "application/json"}});
        }
        return nativeFetch(resource, options);
    };
}());
