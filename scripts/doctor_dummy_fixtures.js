(function () {
    "use strict";

    const yesNo = value => value ? {yes: 1, no: 0} : {yes: 0, no: 1};
    const treatmentRows = (group, names, recommendationType, aliasNames = [], newNames = []) => names.map((name, index) => ({
        name,
        group,
        recommendationType,
        basis: aliasNames.includes(name) ? "über Alias-/Variantenbezug mitgeführt" : "direkt gefunden",
        matchStatus: newNames.includes(name) ? "kein Match – neuer Treatment-Kandidat" : (aliasNames.includes(name) ? "Alias-/Variantenbezug" : "LCN-Bestandsmatch"),
        fixtureId: 920000 + index,
    }));
    const stinglTreatments = [
        ...treatmentRows("Diagnostik", ["Nervenultraschall", "Nervenleitgeschwindigkeit (NLG)", "Elektromyographie (EMG)", "Carotis-Sonographie", "Schellong-Test", "NASA Lean Test", "Komplementfaktoren C3 und C4 (Labor)", "CH50 (Labor)", "Mannosebindendes Lektin (MBL) (Labor)", "Immunglobuline G, A und M (Labor)", "IgG-Subklassen (Labor)", "Lymphozytensubpopulationen (Labor)", "Antiphospholipid-Syndrom-Abklärung", "MRT (Schädel)", "MRT (Wirbelsäule)", "Hautbiopsie bei Small-Fiber-Neuropathie"], "diagnostic_measure", [], ["Nervenultraschall", "Nervenleitgeschwindigkeit (NLG)", "Elektromyographie (EMG)", "Carotis-Sonographie", "NASA Lean Test", "CH50 (Labor)", "Antiphospholipid-Syndrom-Abklärung", "MRT (Wirbelsäule)", "Hautbiopsie bei Small-Fiber-Neuropathie"]),
        ...treatmentRows("Unterstützend", ["Pacing", "Verwenden einer Pulsuhr", "Kompressionsstrümpfe", "Kompressionshosen", "Kompressionstherapie", "Reha", "Vitamin C", "Zink", "Quercetin", "Daosin", "DAO-Supplemente", "Niacin", "Vitamin D", "Selen", "VSL#3", "Intravenöse Immunglobuline (IVIG)", "Virostatika"], "supportive_recommendation", ["Kompressionstherapie", "DAO-Supplemente"], ["Kompressionshosen", "Daosin", "Virostatika"]),
        ...treatmentRows("Lebensstil & Alltag", ["Erhöhte Flüssigkeitszufuhr", "Erhöhte Salzaufnahme", "Elektrolytlösungen", "Langsames Aufstehen", "Kräftigen der Wadenmuskulatur", "Verzicht auf Alkohol", "Kaffeekonsum reduzieren", "Mehrere kleine Mahlzeiten", "Histaminarme Ernährung"], "lifestyle_recommendation"),
        ...treatmentRows("Lebensstil & Alltag", ["Kalte Fußbäder"], "household_recommendation"),
        ...treatmentRows("Medikamentös", ["Mestinon", "Pyridostigmin", "Ivabradin", "Fludrocortison", "Midodrin", "Catapresan", "Clonidin", "H1-Antihistaminika", "Desloratadin", "Fexofenadin", "Famotidin", "H2-Antihistaminika", "Ketotifen", "Montelukast", "Cromoglicinsäure", "Alpha-Liponsäure", "Benzodiazepine", "Temesta", "Lorazepam", "Dexamethason", "Low Dose Naltrexone (LDN)", "Niedrig dosiertes Aripiprazol (LDA)", "Abilify", "Aripiprazol", "Fluvoxamin", "TASS", "Acetylsalicylsäure", "Atorvastatin", "Lipitor", "Sortis", "Fenofibrat", "Lipanthyl", "Lipidil"], "direct_treatment", ["Pyridostigmin", "Clonidin", "H2-Antihistaminika", "Lorazepam", "Abilify", "Aripiprazol", "Acetylsalicylsäure", "Lipitor", "Sortis", "Lipanthyl", "Lipidil"], ["H1-Antihistaminika", "Benzodiazepine", "TASS"]),
    ];
    const majaTreatments = [
        ...treatmentRows("Diagnostik", ["Eingehende Anamnese", "Neurologische Untersuchung / Neurostatus", "10-Minuten passiver Stehtest", "EKG", "Temperaturmessung", "Atemfrequenz", "Sauerstoffsättigung", "Dermographismus", "Differenzialblutbild", "INR", "pTT", "Fibrinogen", "D-Dimere", "CRP", "Glukose", "Kreatinin", "Elektrolyte", "Transaminasen", "Komplement C3/C4", "Gesamteiweiß", "TSH", "fT3", "fT4", "Basales Cortisol", "ACTH", "Ferritin", "Holotranscobalamin", "25-OH-Vitamin D", "Cardiolipin-Antikörper", "Beta2-Glykoprotein-Antikörper", "ANA", "dsDNA-Antikörper", "Urinstatus", "CK", "CK-MB", "Troponin I (hs)", "NT-pro-BNP", "Gesamt-IgA", "Transglutaminase-IgA-Antikörper", "Calprotectin im Stuhl", "Neurotransmitter-Rezeptor-Antikörper", "Lymphozytensubpopulationen", "Mannose-bindendes Lektin (MBL)", "Cortisol-Tagesprofil im Speichel", "Immunglobuline IgG/IgA/IgM", "IgG-Subklassen", "TNF-alpha", "Interleukin-6", "löslicher Interleukin-2-Rezeptor", "SARS-CoV-2 Spike-IgG", "SARS-CoV-2 Nucleocapsid-IgG", "EBV-Serologie", "Vitamin B1", "Vitamin B6", "Folsäure", "Zink", "Abklärung Small Fiber Neuropathy", "Kardiales 3T-MRT", "VQ-SPECT/CT", "MRT Schädel", "Neuropsychologische Abklärung", "18F-FDG-PET", "Gastroskopie", "Koloskopie", "Mastzell-Histologie CD117"], "diagnostic_measure"),
        ...treatmentRows("Medikamentös", ["COVID-19-Impfung bei Long Covid", "Fexofenadin", "Daosin", "Ketotifen", "Cromoglicinsäure", "Alpha-Liponsäure", "L-Arginin", "L-Lysin", "Liposomales Vitamin C", "Nattokinase", "Niacin no-flush", "Vitamin D", "L-Tryptophan", "N-Acetylcystein (NAC)", "Zink", "Selen", "Quercetin", "Ivabradin", "Bisoprolol", "Nebivolol", "Labetalol", "Pyridostigmin", "Fludrocortison", "Midodrin", "Vericiguat", "Methylphenidat", "Bupropion", "Venlafaxin", "Escitalopram", "Erythropoietin", "Octreotid", "Clonidin", "NaCl 0,9% intravenös", "Low Dose Naltrexon (LDN)", "Low Dose Aripiprazol (LDA)", "Prednisolon", "Systemische Corticosteroide", "Hyperbare Sauerstofftherapie (HBOT)", "Intravenöse Immunglobuline (IVIG)", "HELP-Apherese", "Immunadsorption", "Aspirin", "Clopidogrel", "Apixaban", "Pantoprazol", "Fluticason Nasenspray", "Methylprednisolon", "Vitamin-A-Nasentropfen", "D-Ribose", "Diphenhydramin", "Melatonin", "Daridorexant (QUVIVIQ)", "Montelukast", "Guanfacin + N-Acetylcystein", "Duloxetin", "Amitriptylin", "Trimipramin", "Pregabalin", "Oxcarbazepin", "Lamotrigin", "Topiramat", "Tizanidin", "Tramadol", "Lidocain-Pflaster", "Hydroxychloroquin (Plaquenil)", "Methadon", "MST Continus", "Probiotika"], "direct_treatment"),
        ...treatmentRows("Lebensstil & Alltag", ["FFP2-Masken", "Luftfilter", "Regelmäßiges Lüften", "SARS-CoV-2-Selbsttests vor Treffen", "Erhöhte Flüssigkeitszufuhr", "Erhöhte Salzaufnahme", "Elektrolytlösung"], "household_recommendation"),
        ...treatmentRows("Lebensstil & Alltag", ["Pacing", "Histaminarme Ernährung", "Langsames Aufstehen", "Wechselduschen", "Kalte Fußbäder", "Alkoholverzicht", "Wenig Kaffee", "Mehrere kleine Mahlzeiten"], "lifestyle_recommendation"),
        ...treatmentRows("Unterstützend", ["Physiotherapie", "Ergotherapie", "Ernährungsberatung", "Kompressionsstrümpfe", "Komprimierender Bauchgurt", "Strukturiertes Riechtraining", "Atemphysiotherapie", "Neurofeedback"], "supportive_recommendation"),
    ];
    window.LCN_DOCTOR_DUMMY_FIXTURES = {
        stingl: {
            label: "Dr. Michael Stingl",
            researchNote: "Recherche v0.5 · Module 1, 2, 3 und 5 · geprüft 27.08.2026",
            item: {
                dr_id: 9002, dr_display_name: "Dr. Michael Stingl", dr_title_raw: "Dr.", dr_firstname: "Michael", dr_lastname: "Stingl",
                dr_org_name: "CerePrax", dr_website: "https://www.neurostingl.at/", dr_accepts_gkv: "no", dr_accepts_pkv: "unknown",
                loc_id: 9902, loc_label: "CerePrax", loc_country: "Österreich", loc_plz: "1150", loc_city: "Wien",
                loc_street: "Grenzgasse", loc_housenumber: "4-6/1/17", loc_phone: "+43 676 6359950", loc_email: "ordination@neurostingl.at",
                loc_website: "https://www.neurostingl.at/", loc_lat: 48.1951, loc_lng: 16.3354, has_coordinates: true,
                pro: 0, neutral: 0, contra: 0, total_votes: 0, positive_ratio: 0, neutral_ratio: 0, negative_ratio: 0
            },
            terms: {
                specialty: ["Neurologie"],
                badge: ["ME/CFS", "Long Covid / Post Covid", "Periphere Neurologie", "Hirngesundheit und Demenzprävention"],
                accessibility: ["Stufenlos und Aufzug", "Videosprechstunde"],
                other: ["POTS und Dysautonomie", "MCAS", "Belastungsintoleranz und PEM", "Small-Fiber-Neuropathie"]
            },
            treatments: stinglTreatments,
            structure: {
                billing: [["Sprechstunde", "Selbstzahler / Wahlarzt"], ["Kassenvertrag", "Nein"], ["Rezepte", "als Kassenrezept akzeptiert"]],
                costs: [["Ersttermin", "220 € / 60 Min."], ["Folgetermin", "140 € / 30 Min.; mit Diagnostik 170 €"], ["ME/CFS-Kontrolle", "220 € / 60 Min."]],
                appointments: [["Wartezeit bis Ersttermin", "Nicht recherchiert"], ["Warteliste", "Nicht recherchiert"], ["Recherche geprüft", "27.08.2026"]],
                appointmentForms: {"Ersttermin": ["yes", "yes", "unknown"], "Folgetermine": ["yes", "yes", "unknown"]},
                homeVisits: "Nur in Ausnahmefällen, in Wien",
                consideration: [["Termin an geringe Belastbarkeit anpassbar", yesNo(true)]],
                waiting: [], accessibility: [["Stufenlos / Aufzug", yesNo(true)]], doctorExperience: [], workExperience: [], practiceExperience: [],
                services: [["Bescheinigungen und Atteste", yesNo(true)], ["Verlaufskontrolle und Nachbetreuung", yesNo(true)], ["Folgerezept-Service", yesNo(true)], ["Befundbesprechung", yesNo(true)]],
                medication: [["Reguläre Verordnungen", yesNo(true)], ["Off-Label-Therapien", yesNo(true)], ["Individuelle Therapieversuche", yesNo(true)]],
                diagnoses: [["ME/CFS (G93.3)", yesNo(true)]],
                expertise: ["Long Covid", "ME/CFS", "POTS und Dysautonomie", "MCAS", "Belastungsintoleranz und PEM", "Small-Fiber-Neuropathie"].map(v => [v, yesNo(true)]),
                qualifications: ["DFP-Fortbildungsdiplom", "Manuelle Medizin", "Akupunktur", "Palliativmedizin", "Spezielle Schmerztherapie", "Psychosoziale Medizin", "ÖGUM-Zertifikat für Sonographie der Halsgefäße und intrakraniellen Gefäße", "ÖGKN-Zertifikat für Elektroneurographie und Elektromyographie"].map((v, i) => ({term_code: `stingl-qualification-${i}`, term_label: v})),
                specializations: ["ME/CFS", "Long Covid / Post Covid", "Periphere Neurologie", "Hirngesundheit und Demenzprävention"].map((v, i) => ({term_code: `stingl-${i}`, term_label: v}))
            }
        },
        strasser: {
            label: "Dr. med. Maja Strasser",
            researchNote: "Recherche v0.5 · Module 1, 2, 3 und 5 · geprüft 27.08.2026",
            item: {
                dr_id: 9004, dr_display_name: "Dr. med. Maja Strasser", dr_title_raw: "Dr. med.", dr_firstname: "Maja", dr_lastname: "Strasser",
                dr_org_name: "Neurologische Praxis Solothurn", dr_website: "https://www.neuropraxis-solothurn.ch/", dr_accepts_gkv: "unknown", dr_accepts_pkv: "unknown",
                loc_id: 9904, loc_label: "Neurologische Praxis Solothurn", loc_country: "Schweiz", loc_plz: "4500", loc_city: "Solothurn",
                loc_street: "Hauptgasse", loc_housenumber: "5", loc_phone: "032 623 61 11", loc_email: "maja.strasser@hin.ch",
                loc_website: "https://www.neuropraxis-solothurn.ch/", loc_lat: 47.2066521, loc_lng: 7.5354410, has_coordinates: true,
                pro: 0, neutral: 0, contra: 0, total_votes: 0, positive_ratio: 0, neutral_ratio: 0, negative_ratio: 0
            },
            terms: {
                specialty: ["Neurologie"],
                badge: ["Long Covid / Post Covid", "ME/CFS", "Post-Vac", "Neuropädiatrie", "Kopfschmerzen", "Epileptologie"],
                accessibility: [],
                other: ["POTS und Dysautonomie", "MCAS", "Belastungsintoleranz und PEM", "Multiple Sklerose", "Postpolio-Syndrom"]
            },
            treatments: majaTreatments,
            structure: {
                billing: [["GKV / PKV", "Keine belastbare Zuordnung nach deutscher LCN-Logik; Schweizer Abrechnung"]],
                costs: [["Erst- und Folgetermine", "Keine aktuelle veröffentlichte Preisangabe"]],
                appointments: [["Neue Long-Covid-Patient:innen", "Aktuell Aufnahmestopp"], ["Warteliste", "Nein"], ["Recherche geprüft", "27.08.2026"]],
                appointmentForms: {"Ersttermin": ["unknown", "unknown", "no"], "Folgetermine": ["unknown", "unknown", "unknown"]},
                homeVisits: null, consideration: [], waiting: [], accessibility: [], doctorExperience: [], workExperience: [], practiceExperience: [],
                services: [],
                medication: [["Reguläre Verordnungen", yesNo(true)], ["Off-Label-Therapien", yesNo(true)], ["Individuelle Therapieversuche", yesNo(true)]],
                diagnoses: ["Long Covid", "ME/CFS (G93.3)", "POTS und Dysautonomie"].map(v => [v, yesNo(true)]),
                expertise: ["Long Covid", "ME/CFS", "Post-Vac", "POTS und Dysautonomie", "MCAS", "Belastungsintoleranz und PEM"].map(v => [v, yesNo(true)]),
                qualifications: ["Elektroneuromyographie (EMNG) – Fähigkeitsausweis SGKN", "Elektroenzephalographie (EEG) – Fähigkeitsausweis SGKN"].map((v, i) => ({term_code: `strasser-qualification-${i}`, term_label: v})),
                specializations: ["Long Covid / Post Covid", "ME/CFS", "Post-Vac", "Neuropädiatrie", "Kopfschmerzen", "Epileptologie", "Multiple Sklerose", "Postpolio-Syndrom", "Botulinumtoxin bei neurologischen Krankheitsbildern"].map((v, i) => ({term_code: `strasser-${i}`, term_label: v}))
            }
        },
        kacik: {
            label: "Dr. med. Michael Kacik",
            researchNote: "Älterer Durchstich v0.3 · nicht nach finalem Schema · geprüft 26./27.08.2026",
            item: {
                dr_id: 9003, dr_display_name: "Dr. med. Michael Kacik", dr_title_raw: "Dr. med.", dr_firstname: "Michael", dr_lastname: "Kacik",
                dr_org_name: "Praxis ProVascular", dr_website: "https://www.pro-vascular.de/", dr_accepts_gkv: "no", dr_accepts_pkv: "yes",
                loc_id: 9903, loc_label: "Praxis ProVascular", loc_country: "Deutschland", loc_plz: "48159", loc_city: "Münster",
                loc_street: "Idenbrockplatz", loc_housenumber: "20", loc_phone: "0251 3799 5609", loc_email: "termine@pro-vascular.de",
                loc_website: "https://www.pro-vascular.de/", loc_lat: 51.994, loc_lng: 7.604, has_coordinates: true,
                pro: 0, neutral: 0, contra: 0, total_votes: 0, positive_ratio: 0, neutral_ratio: 0, negative_ratio: 0
            },
            terms: {
                specialty: ["Innere Medizin", "Angiologie", "Allgemeinmedizin"],
                badge: ["Lymphologie", "Mikrozirkulation", "Immunologie", "Inflammation"],
                accessibility: ["Videosprechstunde"],
                other: ["Long Covid", "ME/CFS", "Post-Vac", "POTS / Dysautonomie", "MCAS", "Belastungsintoleranz / PEM", "Small-Fiber-Neuropathie"]
            },
            structure: {
                billing: [["Sprechstunde", "Selbstzahler; PKV"], ["Eingriffe", "Selbstzahler; PKV"], ["Rezepte", "Privatrezept"]],
                costs: [["Kosten", "Nicht belastbar recherchiert"]], appointments: [["Terminlage", "Nicht belastbar recherchiert"], ["Recherche geprüft", "26./27.08.2026"]],
                appointmentForms: {"Ersttermin": ["yes", "yes", "unknown"], "Folgetermine": ["yes", "yes", "yes"]}, homeVisits: null,
                consideration: [], waiting: [], accessibility: [], doctorExperience: [], workExperience: [], practiceExperience: [],
                services: [["Verlaufskontrolle / Nachbetreuung", yesNo(true)], ["Folgerezept-Service", yesNo(true)]],
                medication: [["Reguläre Verordnungen", yesNo(true)], ["Off-Label-Therapien", yesNo(true)], ["Individuelle Therapieversuche", yesNo(true)]],
                diagnoses: ["ME/CFS (G93.3)", "Long Covid", "POTS / Dysautonomie", "Small-Fiber-Neuropathie"].map(v => [v, yesNo(true)]),
                expertise: ["Long Covid", "ME/CFS", "Post-Vac", "POTS / Dysautonomie", "MCAS", "Belastungsintoleranz / PEM", "Small-Fiber-Neuropathie"].map(v => [v, yesNo(true)]),
                specializations: ["Lymphologie", "Mikrozirkulation", "Immunologie", "Inflammation"].map((v, i) => ({term_code: `kacik-${i}`, term_label: v}))
            }
        }
    };
}());
