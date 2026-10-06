import type { CompanyCoverage as Coverage } from "@/lib/types";
import { insurerDirectory } from "@/lib/insurers";
import { dateLabel } from "@/lib/format";

export function CompanyCoverage({ companies, period, checkedAt }: { companies: Coverage[]; period?: string; checkedAt: string | null }) {
  const covered = companies.filter((c) => period ? c.periods.includes(period) : c.results > 0).length;
  return <>
    <p>التغطية الفعلية: <bdi dir="ltr">{covered} / {companies.length}</bdi> شركة بنتائج موثقة{period ? <> للفترة <bdi dir="ltr">{period}</bdi></> : ""}. غياب بيانات شركة لا يعني أنها لم تفصح.</p>
    <p><a className="text-link" href={insurerDirectory.register} target="_blank" rel="noopener noreferrer">سجل هيئة التأمين · {insurerDirectory.registerDate}</a>{" · "}<a className="text-link" href={insurerDirectory.listedDirectory} target="_blank" rel="noopener noreferrer">دليل الشركات المدرجة</a></p>
    <p>آخر مطابقة آلية لدليل الإدراج: {checkedAt ? dateLabel(checkedAt, true) : "بانتظار التحقق؛ نطاق المطابقة اليدوية بتاريخ " + insurerDirectory.verifiedAt}</p>
    <div className="table-scroll" role="region" aria-label="تغطية شركات التأمين" tabIndex={0}>
      <table><thead><tr><th>الشركة / الرمز</th><th>الفترات المتاحة</th><th>الإفصاحات</th><th>آخر جلب ناجح</th><th>حدود التغطية</th></tr></thead>
        <tbody>{companies.map((c) => <tr key={c.symbol}>
          <th><a className="text-link" href={c.sourceUrl} target="_blank" rel="noopener noreferrer">{c.company} · <bdi dir="ltr">{c.symbol}</bdi></a></th>
          <td>{c.periods.length ? c.periods.map((p) => <div key={p}><bdi dir="ltr">{p}</bdi></div>) : "لا توجد نتائج موثقة بعد"}</td>
          <td>{c.disclosures}</td><td>{c.lastSuccess ? dateLabel(c.lastSuccess, true) : "لم ينجح الجلب بعد"}</td>
          <td>{c.error ? "تعذّر تحديث بعض السجلات؛ المعروض آخر نجاح. " : ""}{period && !c.periods.includes(period) ? "لا تتوفر نتائج هذه الفترة. " : ""}{c.missingComparatives ? `المقارن مفقود في ${c.missingComparatives} سجل. ` : ""}{!c.results ? "لا توجد أرقام مالية قابلة للتحقق. " : ""}{!c.disclosures ? "لا توجد إفصاحات مجلوبة. " : "الإفصاحات المتاحة فقط؛ لا نضمن اكتمال الأرشيف."}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </>;
}
