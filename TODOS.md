# TODOS

Items deferred during `/plan-ceo-review` (SCOPE REDUCTION mode) on 2026-07-18.
See design doc: `~/.gstack/projects/HIMURAw-planoo/zamto-main-design-20260718-141641.md`

## P2 — Live/automatic DB sync (scripts/agent.ts is now optional, not default)
**What:** The onboarding flow's step 3 was originally "run planoo-agent against your real database" — live usage showed this was the single biggest friction point (requires a running DB, credentials, a terminal). Replaced with an in-browser schema builder (`DesignedTable`/`DesignedColumn`, `src/components/canvas/SchemaBuilder.tsx`) that needs zero setup and exports directly to `.sql`. `scripts/agent.ts`, `/api/agent/push`, `/api/agent-key`, and `AgentApiKey` all still work exactly as before — they're just no longer wired into `Dashboard.tsx`'s required setup steps, and `/api/recheck` (via `src/lib/schema-source.ts`) now prefers designed tables and only falls back to an agent-pushed snapshot if no tables were designed.
**Why:** Removing onboarding friction was an explicit, direct instruction — not a scope call made unilaterally.
**Pros:** Anyone who DOES want to track a real, live database (so drift is detected automatically instead of edited by hand) still can — the plumbing is intact, just needs a UI entry point again (e.g. a "Gelişmiş: gerçek veritabanına bağlan" section/settings page).
**Cons:** Right now there's no way to discover the agent path from the UI at all — it's dead code from a user's perspective until re-surfaced somewhere.
**Context:** When re-surfacing, decide whether schema-builder tables and an agent-synced snapshot can coexist for the same user (right now `getDbColumns()` treats them as mutually exclusive: designed tables always win if any exist) — probably fine for v0, but a user who designs a schema AND later connects a real DB would silently stop seeing their designed-table changes reflected.
**Effort:** M (human: ~3-5 days) → CC: ~1 day
**Priority:** P2
**Depends on / blocked by:** User demand — no one has hit this gap yet since the schema builder just shipped.

## P1 — Multi-project data model (needed to actually enforce plan limits)
**What:** The landing page advertises "Free: 1 aktif proje, 10 tablo çizimi" vs. "Solo/Team: sınırsız proje" — but the whole app is still single-Figma-file/single-DB-schema per account (`User.figmaFileKey` is one field, not a list). There is currently NO code enforcing these limits; every signed-in user, regardless of `plan`, has the same one-project capacity.
**Why:** Pricing copy and billing (Lemon Squeezy checkout + webhook, `User.plan`) were built per explicit instruction, but building the actual multi-project data model (and the UI to manage multiple projects) is a materially bigger scope than "set up payment infra" — it touches `SchemaSnapshot`, `Link`, `AgentApiKey`, and most of the dashboard UI. Flagging rather than silently expanding scope to build it unasked, consistent with the SCOPE REDUCTION discipline this project started with.
**Pros:** Once built, the pricing tiers become real product gates instead of just marketing copy.
**Cons:** Meaningful schema migration (Project model, everything keyed by projectId instead of userId) + UI for project switching.
**Context:** Until this lands, `plan` only gates the Lemon Squeezy billing relationship itself (what the user is charged) — it doesn't yet gate any in-app capability. Decide the Project model shape before starting: does a Project own one Figma file + one DB connection (current 1:1:1 assumption generalized), or something looser?
**Effort:** L (human: ~1-2 weeks) → CC: ~2-3 days
**Priority:** P1
**Depends on / blocked by:** Nothing — but should land before actively selling the paid plans, since right now nothing differentiates them functionally.

## P3 — `npm audit` transitive dev-dependency warnings
**What:** `npm audit` reports 6 moderate advisories, both transitive: `@prisma/dev`'s bundled `@hono/node-server` (Prisma's local dev-database tooling) and Next.js's internally-bundled `postcss` copy (separate from our own `tailwindcss`/`postcss` deps, which are unaffected).
**Why:** `npm audit fix --force` would downgrade to `prisma@6.19.3` and `next@9.3.3` — both drastically older majors that would break the Prisma 7 config (`prisma.config.ts`, driver adapters) and Next 16 code (async params, etc.) this project is built on. Not a safe auto-fix.
**Pros:** N/A — this is a "watch and wait" item.
**Cons:** N/A.
**Context:** Re-run `npm audit` after routine `npm update`s — these should clear on their own once upstream Prisma/Next patch releases land, without needing a major-version downgrade.
**Effort:** N/A (monitoring only)
**Priority:** P3
**Depends on / blocked by:** Upstream Prisma/Next.js patch releases.

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
