/**
 * Single source of truth for the gym's name, address, phone and hours (NAP).
 *
 * These values appear in the footer, the structured data, the 404 page and the
 * booking notification emails. They used to be duplicated, which is how the site
 * shipped two different phone numbers — one in the footer and a different one in
 * the JSON-LD that Google reads. Change them here only.
 */

export const SITE_URL = 'https://xfcgym.com.au';

export const gym = {
  name: 'XFC Carrum Downs',
  /** Display form, used everywhere a human reads it. */
  phone: '(03) 9770 8401',
  /** E.164, for tel: links and structured data. */
  phoneE164: '+61397708401',
  email: 'cd@xfcgym.com.au',
  street: '31 Lathams Road',
  suburb: 'Carrum Downs',
  state: 'VIC',
  postcode: '3201',
  country: 'AU',
  geo: { lat: -38.0885, lng: 145.1748 },
  instagram: 'https://www.instagram.com/xfc3201/',
  instagramHandle: '@xfc3201',
  facebook: 'https://www.facebook.com/XFCCarrumDowns',
  youtube: 'https://www.youtube.com/channel/UCuy6OV8ht31klMjQCq1uMuw',
} as const;

/** `tel:` href — digits only, no spaces or punctuation. */
export const telHref = `tel:${gym.phoneE164}`;

export const mapsUrl =
  `https://maps.google.com/?q=${encodeURIComponent(`${gym.street}, ${gym.suburb} ${gym.state} ${gym.postcode}`)}`;

/**
 * Opening hours. `opens`/`closes` are 24-hour and drive the structured data;
 * `display` is what the footer shows. One entry per day, so the schema can't
 * contradict itself the way a "Mon–Thu" block plus per-day overrides did.
 */
export const hours = [
  { day: 'Mon', schemaDay: 'Monday', opens: '16:30', closes: '20:45', display: '4:30pm – 8:45pm' },
  { day: 'Tue', schemaDay: 'Tuesday', opens: '15:45', closes: '20:45', display: '3:45pm – 8:45pm' },
  { day: 'Wed', schemaDay: 'Wednesday', opens: '16:30', closes: '20:30', display: '4:30pm – 8:30pm' },
  { day: 'Thu', schemaDay: 'Thursday', opens: '15:45', closes: '20:45', display: '3:45pm – 8:45pm' },
  { day: 'Fri', schemaDay: 'Friday', opens: '15:45', closes: '19:30', display: '3:45pm – 7:30pm' },
  { day: 'Sat', schemaDay: 'Saturday', opens: '09:00', closes: '11:00', display: '9:00am – 11:00am' },
  { day: 'Sun', schemaDay: 'Sunday', opens: null, closes: null, display: 'Closed' },
] as const;

/** JSON-LD for the business. Absolute URLs only — relative paths are invalid here. */
export function businessSchema(siteUrl = SITE_URL) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsActivityLocation',
    name: gym.name,
    description:
      'Premier MMA and martial arts gym in Carrum Downs. Classes in MMA, kickboxing, BJJ, boxing, and kids programs for all levels.',
    url: siteUrl,
    telephone: gym.phoneE164,
    email: gym.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: gym.street,
      addressLocality: gym.suburb,
      addressRegion: gym.state,
      postalCode: gym.postcode,
      addressCountry: gym.country,
    },
    geo: { '@type': 'GeoCoordinates', latitude: gym.geo.lat, longitude: gym.geo.lng },
    openingHoursSpecification: hours
      .filter((h) => h.opens && h.closes)
      .map((h) => ({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: h.schemaDay,
        opens: h.opens,
        closes: h.closes,
      })),
    image: `${siteUrl}/images/og-default.jpg`,
    priceRange: '$$',
    sameAs: [gym.instagram, gym.facebook, gym.youtube],
    // NOTE: aggregateRating was deliberately removed. It was previously an invalid
    // standalone node, and the 5.0/47 figures were not substantiated. Self-declared
    // rating markup is a manual-action risk. Re-add it as a property of this object
    // only once the numbers are verified against reviews shown on this site.
  };
}
