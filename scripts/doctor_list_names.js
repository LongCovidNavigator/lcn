// Compact labels for lists; profile names and matching keys remain unchanged.
window.LCNDoctorNames = {
    compact(value) {
        const name = String(value || '').trim();
        if (/\bValentina\s+(?:O\.\s*)?Puntmann\b/i.test(name)) return 'Dr. Valentina Puntmann';
        return name.replace(/^(?:Priv\.-?\s*Doz\.?|Privatdozent(?:in)?|PD)\s+/i, '')
            .replace(/\bDr\.\s+(?:Dr\.\s+)+/g, 'Dr. ');
    }
};
