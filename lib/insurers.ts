export const insurerDirectory = {
  verifiedAt: "2026-10-06",
  registerDate: "2026-09-29",
  regulator: "https://www.ia.gov.sa/ar/regulations-and-licenses/licenses",
  register: "https://www.ia.gov.sa/Licenses/الشركات المرخصة 29 سبتمبر.pdf",
  listedDirectory: "https://www.argaam.com/ar/sector/insurance",
};

// IA's licensed insurer register intersected with the public Saudi listed-company directory.
// Rasan (8313) is technology, not an insurer; unlisted insurers and foreign branches are excluded.
export const insurers = [
  { symbol: "8010", name: "التعاونية", argaamId: "33" },
  { symbol: "8012", name: "جزيرة تكافل", argaamId: "2352" },
  { symbol: "8020", name: "ملاذ للتأمين", argaamId: "970" },
  { symbol: "8030", name: "ميدغلف للتأمين", argaamId: "1015" },
  { symbol: "8040", name: "متكاملة", argaamId: "1013" },
  { symbol: "8050", name: "سلامة", argaamId: "823" },
  { symbol: "8060", name: "ولاء", argaamId: "1012" },
  { symbol: "8070", name: "الدرع العربي", argaamId: "879" },
  { symbol: "8100", name: "سايكو", argaamId: "1018" },
  { symbol: "8120", name: "اتحاد الخليج الأهلية", argaamId: "1057" },
  { symbol: "8150", name: "أسيج", argaamId: "876" },
  { symbol: "8160", name: "التأمين العربية", argaamId: "1183" },
  { symbol: "8170", name: "الاتحاد", argaamId: "1010" },
  { symbol: "8180", name: "الصقر للتأمين", argaamId: "963" },
  { symbol: "8190", name: "المتحدة للتأمين", argaamId: "829" },
  { symbol: "8200", name: "الإعادة السعودية", argaamId: "1129" },
  { symbol: "8210", name: "بوبا العربية", argaamId: "878" },
  { symbol: "8230", name: "تكافل الراجحي", argaamId: "870" },
  { symbol: "8240", name: "تشب", argaamId: "1515" },
  { symbol: "8250", name: "جي آي جي", argaamId: "1513" },
  { symbol: "8260", name: "الخليجية العامة", argaamId: "1527" },
  { symbol: "8280", name: "ليفا", argaamId: "871" },
  { symbol: "8300", name: "الوطنية", argaamId: "1891" },
  { symbol: "8310", name: "أمانة للتأمين", argaamId: "1892" },
  { symbol: "8311", name: "عناية", argaamId: "1928" },
] as const;
export type Insurer = typeof insurers[number];
export const insurerSource = (company: Insurer) => `https://www.argaam.com/ar/company/companyoverview/marketid/3/companyid/${company.argaamId}`;
