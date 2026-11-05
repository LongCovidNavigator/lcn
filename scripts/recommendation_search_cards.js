/* Search-card renderers copied from the approved search pages, isolated here. */
window.LCNSearchCards=(()=>{
 const escapeHtml = value => escapeHomepageHtml(value);
 const escapeHtmlAttribute = escapeHtml;
 const selected = {doctor:new Set(),treatment:new Set()};
 const currentDoctorSortKey='name';
 const getDoctorSortShortLabel=()=> 'Rang';
 const isDoctorSelectedForCompare=id=>selected.doctor.has(String(id));
 const isTreatmentSelectedForCompare=id=>selected.treatment.has(String(id));
 const getDoctorDistanceText=doctor=>getHomepageSharedLocation() && doctor.distance_km!=null ? Math.round(Number(doctor.distance_km)).toLocaleString('de-DE')+' km' : '-';
 const getDoctorVoteStats=()=>({});
 const buildTreatmentCategoryHtml=()=>'';
 const buildTreatmentProviderHtml=t=>`<span class="treatment-provider-bubble">${Number(t.provider_count || 0)}</span>`;
 const treatmentDetailUrl=t=>`therapie_detail.html?treat_id=${encodeURIComponent(t.treat_id)}`;
 const formatDistanceKm=value=>Number(value).toLocaleString('de-DE',{maximumFractionDigits:2})+' km';
function buildDoctorCardHtml(doctor, index) {
    const name = escapeHtml(LCNDoctorNames.compact(doctor.dr_display_name || "Unbekannte behandelnde Person"));
    const plz = escapeHtml(doctor.loc_plz || "");
    const city = escapeHtml(doctor.loc_city || "");
    const street = escapeHtml(doctor.loc_street || "");
    const houseNumber = escapeHtml(doctor.loc_housenumber || "");
    const distance = getDoctorDistanceText({...doctor, distance_km: doctor.distance_km == null ? null : Math.round(Number(doctor.distance_km)).toLocaleString("de-DE")});
	const stats = getDoctorVoteStats(doctor);
	const ownVote = ['pro', 'neutral', 'contra'].includes(doctor.own_vote) ? doctor.own_vote : null;
	const specialtyChipsHtml = buildDoctorSpecialtyChipsHtml(doctor, "doctor-card-tag", 4);
	const communityBadge=doctor.is_community_preview?'<span class="community-preview-badge">Community-Vorschlag · noch nicht geprüft</span>':'';
	const doctorTitle=doctor.is_community_preview?`<a href="arzt_detail.html?submission_id=${Number(doctor.community_submission_id)}">${name}</a>`:`<a class="doctor-card-title-link" href="arzt_detail.html?id=${encodeURIComponent(doctor.dr_id)}">${name}</a>`;

    return `
        <article data-doctor-online-managed class="doctor-card doctor-card-v2${doctor.is_community_preview ? " is-community-preview" : ""}" data-dr-id="${escapeHtml(doctor.dr_id)}">
            <div class="doctor-card-accent"></div>

            <div class="doctor-card-main-header">
                <div class="doctor-card-rank-large" aria-label="Platzierung">
                    <strong>#${index + 1}</strong>
                    <span>${escapeHtml(getDoctorSortShortLabel())}</span>
                </div>

                <div class="doctor-card-title-area">
                    <h3 class="doctor-card-title">${doctorTitle}</h3>${communityBadge}

                    <div class="doctor-card-meta">
						${specialtyChipsHtml || '<span class="doctor-card-tag">Fachrichtungen: —</span>'}
                    </div>
                </div>

                <div class="doctor-card-location-summary">
                    <address class="doctor-card-address">${street || houseNumber ? `<span>${street} ${houseNumber}</span>` : ""}${plz || city ? `<span>${plz} ${city}</span>` : ""}</address>
                    <div class="doctor-card-distance">${doctorOnlineLabel(doctor) ? `<span class="doctor-search-online lcn-online-badge">${doctorOnlineLabel(doctor)}</span>` : ""}${!doctor.online_only ? distance : ""}</div>
                </div>
            </div>

            <div class="doctor-card-content-grid">
                <section class="doctor-card-info-panel doctor-card-location-panel">
                    <div class="doctor-card-offer-stat"><span>Therapien</span><strong>${Number(doctor.treatment_count || 0)}</strong></div>
                    <div class="doctor-card-offer-stat"><span>Therapievielfalt</span><strong>${doctor.category_count == null || (Number(doctor.treatment_count) > 0 && Number(doctor.category_count) === 0) ? "–" : Number(doctor.category_count)}</strong></div>
                </section>

                <section class="doctor-card-info-panel doctor-card-rating-panel">
                    <h4 class="doctor-card-section-heading">
                        Erfahrungen
                        <span class="doctor-card-section-count"></span>
                        <a class="doctor-card-rating-link" href="arzt_detail.html?id=${encodeURIComponent(doctor.dr_id)}">(Zur Bewertung)</a>
                    </h4>
                    ${buildDoctorCardRatingHtml(doctor)}
                </section>
            </div>

            <div class="doctor-card-footer doctor-card-footer-with-compare">
                <button type="button" class="doctor-compare-add-button ${isDoctorSelectedForCompare(doctor.dr_id) ? "is-selected" : ""}" data-dr-id="${escapeHtml(doctor.dr_id)}">
                    ${isDoctorSelectedForCompare(doctor.dr_id) ? "Ausgewählt" : "+ vergleichen"}
                </button>
            </div>
        </article>
    `;
}

function buildDoctorCardRatingHtml(doctor) {
    return LCNExperience.html('doctor', doctor.dr_id);
}

function getDoctorSpecialtyLabels(doctor) {
    const rawTerms = Array.isArray(doctor.specialty_terms)
        ? doctor.specialty_terms
        : (Array.isArray(doctor.specialties) ? doctor.specialties : []);

    const labels = [];

    rawTerms.forEach(function (term) {
        const label = typeof term === "string"
            ? term
            : (term.term_label || term.label || term.name || "");

        const normalizedLabel = String(label || "").trim();

        if (normalizedLabel !== "" && !labels.includes(normalizedLabel)) {
            labels.push(normalizedLabel);
        }
    });

    if (labels.length === 0 && doctor.specialty_labels) {
        String(doctor.specialty_labels)
            .split(",")
            .map(function (label) {
                return label.trim();
            })
            .filter(Boolean)
            .forEach(function (label) {
                if (!labels.includes(label)) {
                    labels.push(label);
                }
            });
    }

    return labels;
}

function buildDoctorSpecialtyChipsHtml(doctor, chipClassName = "doctor-card-tag", limit = null, wrapperClassName = "") {
    const labels = getDoctorSpecialtyLabels(doctor);
    const visibleLabels = limit ? labels.slice(0, limit) : labels;
    const hiddenCount = limit && labels.length > limit ? labels.length - limit : 0;

    if (visibleLabels.length === 0) {
        return "";
    }

    const chipsHtml = visibleLabels.map(function (label) {
        return `<span class="${escapeHtml(chipClassName)}">${escapeHtml(label)}</span>`;
    }).join("");

    const moreHtml = hiddenCount > 0
        ? `<span class="${escapeHtml(chipClassName)}">+${hiddenCount}</span>`
        : "";

    if (wrapperClassName) {
        return `<div class="${escapeHtml(wrapperClassName)}">${chipsHtml}${moreHtml}</div>`;
    }

    return chipsHtml + moreHtml;
}


function doctorOnlineLabel(doctor) {
    return doctor.online_only ? "Nur Online-Therapie" : doctor.online_therapy_available ? "Online-Therapie" : "";
}

function buildTreatmentCardHtml(treatment, index) {
    const treatmentName = escapeHtml(treatment.behandlung || "Unbekannte Therapie")+(treatment.review_pending?' <span class="community-preview-badge">Prüfung ausstehend</span>':'');
    const rawTreatmentName = escapeHtmlAttribute(treatment.behandlung || "");
    const categoryHtml = buildTreatmentCategoryHtml(treatment);
    const providerHtml = buildTreatmentProviderHtml(treatment);
    const category = escapeHtml(String(treatment.typ || "").trim() || "Keine Kategorie angegeben");
    const subcategory = escapeHtml(String(treatment.unterkategorie || "").trim() || "Keine Unterkategorie angegeben");
    const providerCount = Number(treatment.total_provider_count ?? treatment.provider_count ?? 0);
    const providerCountLabel = providerCount === 1 ? "1 Behandler:in insgesamt" : `${providerCount} Behandler:innen insgesamt`;

    const totalVotes = Number(treatment.total_votes ?? 0);
    const positiveRatio = Number(treatment.positive_ratio ?? 0);
    const neutralRatio = Number(treatment.neutral_ratio ?? 0);
    const negativeRatio = Number(treatment.negative_ratio ?? 0);

    const pro = Number(treatment.pro ?? 0);
    const neutral = Number(treatment.neutral ?? 0);
    const contra = Number(treatment.contra ?? 0);
    const ownVote = ['pro', 'neutral', 'contra'].includes(treatment.own_vote) ? treatment.own_vote : null;

    const communityBadge=treatment.is_community_preview?'<span class="community-preview-badge">Community-Vorschlag · noch nicht geprüft</span>':'';
    const treatmentTitle=treatment.is_community_preview?treatmentName:`<a class="treatment-card-title-link" href="${treatmentDetailUrl(treatment)}">${treatmentName}</a>`;
    const distanceHtml = treatment.nearest_provider_distance_km == null
        ? ""
        : `<span class="treatment-card-muted">Nächster Behandler: ${escapeHtml(formatDistanceKm(treatment.nearest_provider_distance_km))}</span>`;

    return `
        <article class="treatment-card${treatment.is_community_preview ? " is-community-preview" : ""}" data-treat-id="${treatment.treat_id}">
            <div class="treatment-card-accent"></div>

            <div class="treatment-card-main-header">
                <div class="treatment-card-rank-large">
                    <strong>#${index + 1}</strong>
                    <span>Rang</span>
                </div>

                <div class="treatment-card-title-area">
                    <h3 class="treatment-card-title">${treatmentTitle}</h3>${communityBadge}

                    <div class="treatment-card-meta">
                        ${distanceHtml}
                    </div>
                </div>

                <div class="treatment-card-provider-summary">
                    <span class="treatment-card-provider-summary-label">Behandler:innen</span>
                    <div class="treatment-card-provider-detail">
                        ${providerHtml}
                    </div>
                </div>

            </div>

            <div class="treatment-card-content-grid">
                <section class="treatment-card-info-panel treatment-card-classification-panel">
                    <h4 class="treatment-card-section-heading">Einordnung</h4>

                    <div class="treatment-card-classification-list">
                    <div class="treatment-card-info-block">
                        <div class="treatment-card-mini-label">Kategorie</div>
                        <div class="treatment-card-classification-value">${category}</div>
                    </div>

                    <div class="treatment-card-info-block">
                        <div class="treatment-card-mini-label">Unterkategorie</div>
                        <div class="treatment-card-classification-value">${subcategory}</div>
                    </div>
                    </div>
                </section>

                <section class="treatment-card-info-panel treatment-card-rating-panel"><h4 class="treatment-card-section-heading">Erfahrungen</h4>${LCNExperience.html('treatment', treatment.treat_id)}</section>
            </div>



            <footer class="treatment-card-footer treatment-card-footer-with-compare">
                <button
                    type="button"
                    class="treatment-compare-add-button ${isTreatmentSelectedForCompare(treatment.treat_id) ? "is-selected" : ""}"
                    data-treat-id="${escapeHtml(treatment.treat_id)}"
                >
                    ${isTreatmentSelectedForCompare(treatment.treat_id) ? "Ausgewählt" : "+ vergleichen"}
                </button>
            </footer>
        </article>
    `;
}


 document.addEventListener('click',event=>{
  const button=event.target.closest('.recommendation-search-cards .doctor-compare-add-button,.recommendation-search-cards .treatment-compare-add-button');
  if(!button)return;
  const type=button.dataset.drId?'doctor':'treatment',id=button.dataset.drId || button.dataset.treatId;
  const group=button.closest('.recommendation-search-cards');
  selected[type].has(id)?selected[type].delete(id):selected[type].add(id);
  button.classList.toggle('is-selected',selected[type].has(id));
  button.textContent=selected[type].has(id)?'Ausgewählt':'+ vergleichen';
  let bar=group.previousElementSibling;
  if(!bar?.classList.contains('recommendation-card-compare-bar')){bar=document.createElement('div');bar.className='recommendation-card-compare-bar';group.before(bar);}
  bar.replaceChildren();
  const chosen=[...group.querySelectorAll('article')].filter(card=>selected[type].has(card.dataset.drId || card.dataset.treatId));
  if(!chosen.length)return;
  const status=document.createElement('span');status.textContent=chosen.length+' ausgewählt';bar.append(status);
  const compare=document.createElement('button');compare.type='button';compare.textContent='Auswahl vergleichen';compare.disabled=chosen.length<2;
  compare.onclick=()=>{group.querySelectorAll('article').forEach(card=>card.hidden=!chosen.includes(card));group.classList.add('is-comparing');};
  const reset=document.createElement('button');reset.type='button';reset.textContent='Alle anzeigen';reset.onclick=()=>{group.querySelectorAll('article').forEach(card=>card.hidden=false);group.classList.remove('is-comparing');};
  bar.append(compare,reset);
 });
 return {doctor:buildDoctorCardHtml,treatment:buildTreatmentCardHtml};
})();
