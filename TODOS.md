# TODOS

Items deferred during `/plan-ceo-review` (SCOPE REDUCTION mode) on 2026-07-18.
See design doc: `~/.gstack/projects/HIMURAw-planoo/zamto-main-design-20260718-141641.md`

## P1 — Figma OAuth app review başvurusu
**What:** Figma'nın OAuth app review/onay sürecine şimdiden başvur.
**Why:** Dış bağımlılık, onay süresi build takvimini etkileyebilir — outside voice review'ın yakaladığı gizli risk. Build'i beklemeden şimdi başlatılmalı.
**Pros:** Build başladığında blocker olmaz.
**Cons:** Yok — düşük efor, yüksek fayda.
**Context:** planoo Figma REST API'ye OAuth üzerinden erişecek; büyük ölçekli/production kullanım için Figma'nın app review sürecinden geçmesi gerekebilir.
**Effort:** S (human: birkaç saat başvuru + bekleme süresi) → CC: S (başvuru formunu doldurmak insan işi, hızlandırılamaz)
**Priority:** P1
**Depends on / blocked by:** Yok — hemen başlatılabilir, spike'tan bağımsız.

## P2 — Canlı/otomatik izleme katmanı (webhook + sürekli agent)
**What:** Design doc'ta onaylanan Approach B'nin tam hali — Figma webhook + DB'ye sürekli/periyodik bağlı agent, otomatik drift tespiti.
**Why:** Bu, ürünün uzun vadeli differentiator'ı (bayatlama riskine karşı asıl çözüm) ama talep + eşleştirme kalitesi doğrulanmadan inşa edilmemeli.
**Pros:** Gerçek "canlı sapma dedektörü" değerini verir, kullanıcı hiçbir şey yapmadan sürekli korunur.
**Cons:** Persistent altyapı, webhook yönetimi, daha yüksek işletim maliyeti.
**Context:** MVP "on-demand check" (manuel `planoo check`) ile başlıyor. Bu madde, o MVP talep görürse ve teknik spike (%70 eşleştirme doğruluğu) geçerse devreye girecek.
**Effort:** L (human: ~3-4 hafta) → CC: ~1 hafta
**Priority:** P2
**Depends on / blocked by:** MVP demand validation + eşleştirme spike başarısı.

## P2 — Agent için tam CI/CD release pipeline (npm publish + signed/provenance release)
**What:** `planoo-agent` için GitHub Actions ile otomatik npm publish + provenance attestation yayın hattı.
**Why:** /plan-eng-review kararı: v0'da agent, `npx github:HIMURAw/planoo-agent` ile doğrudan çalıştırılan tek dosyalık bir script olarak dağıtılıyor (Prisma introspection kullanır) — npm registry publish, signing, ayrı release pipeline YOK. Bu tam paketleme, gerçek kullanıcı adopsiyonu görülünce (ilk kullanıcılar "npm install ile daha rahat kurardım" gibi somut sinyal verince) yapılmalı.
**Pros:** Güvenilir sürümleme, kullanıcı güveni (checksum/npm provenance).
**Cons:** Ek CI/CD kurulum eforu — henüz kimse kullanmadan yatırım yapmak "innovation token" israfı olabilir.
**Context:** Faz 0/spike atlandığı için bu maddenin eski bağımlılığı ("spike başarısı") artık geçersiz — yeni tetikleyici gerçek kullanıcı adopsiyon sinyali.
**Effort:** S-M (human: ~2-3 gün) → CC: ~half day
**Priority:** P2
**Depends on / blocked by:** Faz 1'in canlıya alınması + gerçek kullanıcılardan paketleme talebi sinyali.

## P3 — Pluggable matcher / LLM tabanlı eşleştirme
**What:** Basit heuristik (isim/tip benzerliği) yetersiz kalırsa devreye girecek, değiştirilebilir bir eşleştirme motoru soyutlaması.
**Why:** Section 10 kararı: şimdiden soyutlama eklemek YAGNI riski taşıyor — heuristik yetmezse o zaman ele alınacak.
**Pros:** Heuristik başarısız olursa hızlı pivot imkanı.
**Cons:** Şimdiden inşa etmek spekülatif karmaşıklık.
**Context:** Faz 0 spike atlandığı için heuristiğin doğruluğu artık önceden değil, Faz 1 canlıya alındıktan SONRA gerçek kullanıcı geri bildirimiyle ölçülecek — bu, bilinçli olarak kabul edilmiş bir risk (bkz. design doc Addendum 2 güncellemesi). Kullanıcılar düşük kaliteli önerilerden şikayet ederse bu madde acilen önceliklenmeli.
**Effort:** M (human: ~1 hafta) → CC: ~1-2 gün
**Priority:** P3
**Depends on / blocked by:** Faz 1'de gerçek kullanıcılardan düşük eşleştirme kalitesi geri bildirimi gelmesi.

## P3 — Geniş gözlemlenebilirlik (metrik/alert/dashboard)
**What:** Temel loglamanın (agent çalıştırma sonucu, backend check olayları) ötesinde metrikler, alertler, dashboard panelleri.
**Why:** MVP aşamasında "bozuk mu görebiliyoruz" yeterli; üretim ölçeğine geçince tam gözlemlenebilirlik gerekir.
**Pros:** Operasyonel görünürlük, incident response hızı.
**Cons:** MVP'de erken yatırım, henüz kullanıcı/trafik yok.
**Context:** Section 8 bulgusu — REDUCTION modu standardı "bozuk mu görebiliyoruz" idi, bu tam gözlemlenebilirlik daha sonraki bir olgunluk aşaması.
**Effort:** M (human: ~1 hafta) → CC: ~1-2 gün
**Priority:** P3
**Depends on / blocked by:** Üretim trafiği / ilk gerçek kullanıcılar.

## P3 — Roadmap + planlama birleşimi (uzun vadeli vizyon)
**What:** Roadmap/yapılacaklar listesi, kullanılacak stack kararları gibi proje planlama dokümanlarını da (şu an ayrı `.md` dosyalarında tutulan türden) aynı canvas'a/siteye entegre etmek — sadece UI-DB traceability değil, projenin tüm planlama katmanı.
**Why:** Kurucunun kendi vakası (bu proje) bunu doğruladı: Figma + ayrı .md dosyası + DB şeması arasında hiçbir bağlantı olmaması zaman kaybettirdi ve planlamayı zorlaştırdı. Ürünün nihai vizyonu ("bir projeye başlandığında tüm planlamanın tek bir sitede yapılması") bu.
**Pros:** Faz 1 traceability MVP'sinden çok daha geniş bir problemi çözer; "tek site" vaadini tam karşılar.
**Cons:** Kapsamı önemli ölçüde büyütür — Faz 0/Faz 1'in dar MVP disiplinini bozar. Roadmap/doküman yönetimi kendi başına ayrı bir ürün kategorisi (Notion/Linear benzeri) — rekabet ve karmaşıklık farklı.
**Context:** CEO review (SCOPE REDUCTION) kararı: Faz 0/Faz 1 sınırı (sadece UI-DB traceability) şimdilik sabit kalsın, bu madde ayrı bir vizyon olarak kayıt altına alınsın. Faz 1 talep + spike doğrulanıp gerçek kullanıcılar "UI-DB eşleşmesi yeterli değil, roadmap'i de istiyoruz" dediğinde önceliklendirilmeli — varsayımla değil, kullanıcı talebiyle.
**Effort:** XL (human: aylar) → CC: haftalar — ayrı bir ürün kategorisi kadar büyük.
**Priority:** P3
**Depends on / blocked by:** Faz 1 MVP'nin canlıya alınması + kullanıcılardan gelen açık talep (varsayımla büyütülmemeli — bu tam olarak Section 0'da uyardığımız risk).
