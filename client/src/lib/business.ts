export const BUSINESS = {
  name: 'P.D.O Classes',
  shortName: 'P.D.O',
  address: 'P&T Colony, Lalpur, Ranchi, Jharkhand 834001',
  city: 'Ranchi',
  phoneDisplay: '083404 06593',
  phoneTel: '+918340406593',
  whatsappNumber: '918340406593',
  email: 'admissions@pdoclasses.in',
  googleRating: '4.9',
  googleReviews: 152,
  instituteSlug: 'pdo-classes',
  mapsUrl:
    'https://www.google.com/maps/place/P.D.O+CLASSES/@23.3742101,85.3362301,16.41z/data=!4m15!1m8!3m7!1s0x39f4e112db28a227:0x53096f8a5931b03c!2sP%26T+Colony,+Lalpur,+Ranchi,+Jharkhand+834001!3b1!8m2!3d23.3763331!4d85.3371538!16s%2Fg%2F11clylk9fx!3m5!1s0x39f4e1bb96a61df3:0xfd388c9c047b636f!8m2!3d23.3763331!4d85.3371538!16s%2Fg%2F11n8x66c4n?entry=ttu&g_ep=EgoyMDI2MTExOC4xIKXMDSoASAFQAw%3D%3D',
} as const;

export function whatsappUrl(message: string): string {
  return `https://wa.me/${BUSINESS.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

export const DEMO_WHATSAPP_MESSAGE =
  'Hello P.D.O Classes, I would like to know more about the free demo class for CAT / Class 12 PCM.';
