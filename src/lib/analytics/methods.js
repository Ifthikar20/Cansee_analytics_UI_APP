// How a country result was localized (contract 1c). The API sends the
// method key and its label ("Google set to GB, US connection"); this file
// holds the longer note a method chip shows on hover and focus.

export const METHOD_NOTES = Object.freeze({
    proxy: 'Cansee searched Google through a connection in this country.',
    google_setting:
        "Cansee searched Google with its country setting on this country, through a connection elsewhere. Results follow Google's country setting; results tied to a city can differ.",
    searched: "The engine searched the web with this country as the user's location.",
    asked: 'This engine has no location setting here, so it was asked to answer for this country.',
})

/** The note for a method key; '' for a method without one (`default`). */
export function methodNote(method) {
    return METHOD_NOTES[method] || ''
}

/**
 * A country's method label made general: "Google set to GB, US connection"
 * for GB reads "Google set to each country, US connection". The planned
 * labels in the API use the same wording.
 */
export function genericMethodLabel(label, country) {
    const text = String(label || '')
    const code = String(country || '').toUpperCase()
    if (!text || !code) return text
    return text.replace(new RegExp(`\\b${code}\\b`), 'each country')
}
